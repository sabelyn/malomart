import { ErrorCode } from "@mm/lib";
import type { CurrentUser, GoogleSignInError } from "@mm/lib/auth";
import {
  ACCOUNT_PAGE_PATH,
  completeGoogleSignIn,
  confirmAccountDeletion,
  confirmEmailChange,
  confirmSignUp,
  getCurrentUser,
  GOOGLE_ERROR_PARAM,
  refreshSession,
  requestAccountDeletion,
  requestEmailChange,
  safeReturnTo,
  SIGN_IN_PAGE_PATH,
  signIn,
  signOut,
  signOutEverywhere,
  signUp,
  startGoogleAccountDeletion,
  startGoogleSignIn,
  updateProfile,
  verifySignIn
} from "@mm/lib/auth";
import type { Request, Response } from "express";
import { Router } from "express";
import type { DependencyContainer } from "tsyringe";

import { userFromIssuedToken } from "@/auth/claims";
import {
  clearOAuthState,
  clearPendingAuth,
  clearSessionCookies,
  readAccessToken,
  readOAuthState,
  readPendingAuth,
  readRefreshToken,
  setOAuthState,
  setPendingAuth,
  setSessionCookies
} from "@/auth/cookies";
import type { OAuthState } from "@/auth/cookies";
import { createPkce } from "@/auth/oauth";
import { AUTH_SERVICE, CUSTOMER_SERVICE } from "@/contracts/tokens";
import env from "@/env";
import { badRequest, forbidden, toApiError, unauthorized } from "@/errors/helpers";
import { containerFor, sendCodeLimit, verifyCodeLimit } from "@/middleware";
import { pathAndMiddleware, respond, respondEmpty, validateRequest } from "./helpers";

const router = Router();

const GOOGLE_CALLBACK_URI = `${env.APP_ORIGIN}${completeGoogleSignIn.fullPath}`;
const LINKED_ACCOUNT_ERROR = "Already found an entry for username";

const signedInUser = (req: Request): CurrentUser => {
  if (!req.user) {
    throw unauthorized();
  }
  const { customerData: _, ...user } = req.user;
  return user;
};

const accessTokenFor = (req: Request) => {
  const token = readAccessToken(req);
  if (!token) {
    throw unauthorized();
  }
  return token;
};

const requireSignInMethod = (user: CurrentUser, method: CurrentUser["signInMethod"]) => {
  if (user.signInMethod !== method) {
    throw forbidden();
  }
};

const renewSession = async (req: Request, res: Response, fallback: CurrentUser) => {
  const refreshToken = readRefreshToken(req);
  if (!refreshToken) {
    return fallback;
  }
  try {
    const tokens = await req.container.resolve(AUTH_SERVICE).refresh(refreshToken);
    setSessionCookies(res, tokens);
    return userFromIssuedToken(tokens.accessToken);
  } catch (err) {
    console.warn("Failed to renew the session after an account change.", err);
    return fallback;
  }
};

type GoogleFlow = Omit<OAuthState, "state" | "verifier">;

const googleErrorPath = (flow: GoogleFlow | undefined, error: GoogleSignInError) => {
  const params = new URLSearchParams({ [GOOGLE_ERROR_PARAM]: error });
  if (flow?.purpose === "deleteAccount") {
    return `${ACCOUNT_PAGE_PATH}?${params}`;
  }
  if (flow && flow.returnTo !== "/") {
    params.set("returnTo", flow.returnTo);
  }
  return `${SIGN_IN_PAGE_PATH}?${params}`;
};

const redirectToGoogle = (req: Request, res: Response, flow: GoogleFlow) => {
  try {
    const { state, verifier, challenge } = createPkce();
    const url = req.container.resolve(AUTH_SERVICE).googleSignInUrl(GOOGLE_CALLBACK_URI, state, challenge);
    setOAuthState(res, { ...flow, state, verifier });
    res.redirect(302, url);
  } catch (err) {
    console.error("Failed to start Google sign-in.", err);
    res.redirect(302, googleErrorPath(flow, "failed"));
  }
};

const deleteAccount = async (container: DependencyContainer, accessToken: string) => {
  const customerService = container.resolve(CUSTOMER_SERVICE);
  await customerService.deleteSavedData();
  await container.resolve(AUTH_SERVICE).deleteUser(accessToken);
  await customerService
    .deleteCustomerRecord()
    .catch(err => console.error("Failed to delete the customer record after deleting the account.", err));
};

router.get(...pathAndMiddleware(startGoogleSignIn), (req, res) => {
  redirectToGoogle(req, res, { purpose: "signIn", returnTo: safeReturnTo(req.query.returnTo), retried: false });
});

router.get(...pathAndMiddleware(startGoogleAccountDeletion), (req, res, next) => {
  try {
    const user = signedInUser(req);
    requireSignInMethod(user, "google");
    return redirectToGoogle(req, res, { purpose: "deleteAccount", returnTo: "/", retried: false, userId: user.id });
  } catch (err) {
    return next(err);
  }
});

router.get(...pathAndMiddleware(completeGoogleSignIn), async (req, res) => {
  const oauth = readOAuthState(req);
  const returnTo = oauth?.returnTo ?? "/";
  const fail = (error: GoogleSignInError) => {
    clearOAuthState(res);
    res.redirect(302, googleErrorPath(oauth, error));
  };

  try {
    const {
      query: { code, state, error, error_description }
    } = validateRequest(completeGoogleSignIn, req);

    if (error) {
      if (oauth && !oauth.retried && error_description?.includes(LINKED_ACCOUNT_ERROR)) {
        return redirectToGoogle(req, res, { ...oauth, retried: true });
      }
      if (error === "access_denied") {
        return fail("cancelled");
      }
      console.warn("Cognito returned a Google sign-in error.", { error, error_description });
      return fail("failed");
    }

    if (!oauth || !code || state !== oauth.state) {
      console.warn("Google sign-in callback had a missing or mismatched state.");
      return fail("failed");
    }

    const service = req.container.resolve(AUTH_SERVICE);
    const tokens = await service.exchangeAuthorizationCode(code, GOOGLE_CALLBACK_URI, oauth.verifier);

    if (oauth.purpose === "deleteAccount") {
      const user = userFromIssuedToken(tokens.accessToken);
      if (user.id !== oauth.userId) {
        return fail("wrongAccount");
      }
      await deleteAccount(containerFor({ ...user, customerData: {} }), tokens.accessToken);
      clearOAuthState(res);
      clearSessionCookies(res);
      return res.redirect(302, returnTo);
    }

    clearOAuthState(res);
    setSessionCookies(res, tokens);
    return res.redirect(302, returnTo);
  } catch (err) {
    console.error("Failed to complete Google sign-in.", err);
    return fail("failed");
  }
});

router.post(...pathAndMiddleware(signUp, sendCodeLimit), async (req, res, next) => {
  try {
    const {
      body: { email, name }
    } = validateRequest(signUp, req);

    const service = req.container.resolve(AUTH_SERVICE);
    const pending = await service.signUp(email, name);
    if (pending) {
      setPendingAuth(res, pending);
    }
    return respondEmpty(res, signUp);
  } catch (err) {
    return next(err);
  }
});

router.post(...pathAndMiddleware(confirmSignUp, verifyCodeLimit), async (req, res, next) => {
  try {
    const {
      body: { email, code }
    } = validateRequest(confirmSignUp, req);
    const pending = readPendingAuth(req);
    const session = pending?.email === email ? pending.session : undefined;

    const service = req.container.resolve(AUTH_SERVICE);
    const tokens = await service.confirmSignUp(email, code, session);
    clearPendingAuth(res);
    if (!tokens) {
      return respond(res, confirmSignUp, { user: null });
    }

    setSessionCookies(res, tokens);
    return respond(res, confirmSignUp, { user: userFromIssuedToken(tokens.accessToken) });
  } catch (err) {
    return next(err);
  }
});

router.post(...pathAndMiddleware(signIn, sendCodeLimit), async (req, res, next) => {
  try {
    const {
      body: { email }
    } = validateRequest(signIn, req);

    const service = req.container.resolve(AUTH_SERVICE);
    setPendingAuth(res, await service.startSignIn(email));
    return respondEmpty(res, signIn);
  } catch (err) {
    return next(err);
  }
});

router.post(...pathAndMiddleware(verifySignIn, verifyCodeLimit), async (req, res, next) => {
  try {
    const {
      body: { code }
    } = validateRequest(verifySignIn, req);
    const pending = readPendingAuth(req);
    if (!pending) {
      throw unauthorized(undefined, ErrorCode.NoPendingSignIn);
    }

    const service = req.container.resolve(AUTH_SERVICE);
    const tokens = await service.verifySignIn(pending, code);
    clearPendingAuth(res);
    setSessionCookies(res, tokens);
    return respond(res, verifySignIn, userFromIssuedToken(tokens.accessToken));
  } catch (err) {
    if (toApiError(err).statusCode === 401) {
      clearPendingAuth(res);
    }
    return next(err);
  }
});

router.post(...pathAndMiddleware(refreshSession), async (req, res, next) => {
  try {
    const refreshToken = readRefreshToken(req);
    if (!refreshToken) {
      throw unauthorized();
    }

    const service = req.container.resolve(AUTH_SERVICE);
    setSessionCookies(res, await service.refresh(refreshToken));
    return respondEmpty(res, refreshSession);
  } catch (err) {
    if (toApiError(err).statusCode === 401) {
      clearSessionCookies(res);
    }
    return next(err);
  }
});

router.post(...pathAndMiddleware(signOut), async (req, res, next) => {
  try {
    const refreshToken = readRefreshToken(req);
    if (refreshToken) {
      const service = req.container.resolve(AUTH_SERVICE);
      await service
        .signOut(refreshToken)
        .catch(err => console.warn("Failed to revoke refresh token on sign-out.", err));
    }

    clearSessionCookies(res);
    return respondEmpty(res, signOut);
  } catch (err) {
    return next(err);
  }
});

router.get(...pathAndMiddleware(getCurrentUser), (req, res, next) => {
  try {
    return respond(res, getCurrentUser, signedInUser(req));
  } catch (err) {
    return next(err);
  }
});

router.post(...pathAndMiddleware(signOutEverywhere), async (req, res, next) => {
  try {
    signedInUser(req);

    const service = req.container.resolve(AUTH_SERVICE);
    await service.signOutEverywhere(accessTokenFor(req));
    clearSessionCookies(res);
    return respondEmpty(res, signOutEverywhere);
  } catch (err) {
    return next(err);
  }
});

router.put(...pathAndMiddleware(updateProfile), async (req, res, next) => {
  try {
    const {
      body: { name }
    } = validateRequest(updateProfile, req);
    const user = signedInUser(req);

    const service = req.container.resolve(AUTH_SERVICE);
    await service.updateName(accessTokenFor(req), name);
    return respond(res, updateProfile, await renewSession(req, res, { ...user, name }));
  } catch (err) {
    return next(err);
  }
});

router.post(...pathAndMiddleware(requestEmailChange, sendCodeLimit), async (req, res, next) => {
  try {
    const {
      body: { email }
    } = validateRequest(requestEmailChange, req);
    const user = signedInUser(req);
    requireSignInMethod(user, "email");
    if (email.toLowerCase() === user.email.toLowerCase()) {
      throw badRequest("That's already your email.");
    }

    const service = req.container.resolve(AUTH_SERVICE);
    await service.requestEmailChange(accessTokenFor(req), email);
    return respondEmpty(res, requestEmailChange);
  } catch (err) {
    return next(err);
  }
});

router.post(...pathAndMiddleware(confirmEmailChange, verifyCodeLimit), async (req, res, next) => {
  try {
    const {
      body: { code }
    } = validateRequest(confirmEmailChange, req);
    const user = signedInUser(req);
    requireSignInMethod(user, "email");

    const service = req.container.resolve(AUTH_SERVICE);
    await service.confirmEmailChange(accessTokenFor(req), code);
    return respond(res, confirmEmailChange, await renewSession(req, res, user));
  } catch (err) {
    return next(err);
  }
});

router.post(...pathAndMiddleware(requestAccountDeletion, sendCodeLimit), async (req, res, next) => {
  try {
    const user = signedInUser(req);
    requireSignInMethod(user, "email");

    const service = req.container.resolve(AUTH_SERVICE);
    setPendingAuth(res, await service.startSignIn(user.email));
    return respondEmpty(res, requestAccountDeletion);
  } catch (err) {
    return next(err);
  }
});

router.post(...pathAndMiddleware(confirmAccountDeletion, verifyCodeLimit), async (req, res, next) => {
  try {
    const {
      body: { code }
    } = validateRequest(confirmAccountDeletion, req);
    const user = signedInUser(req);
    requireSignInMethod(user, "email");
    const pending = readPendingAuth(req);
    if (pending?.email !== user.email) {
      throw unauthorized(undefined, ErrorCode.NoPendingSignIn);
    }

    const tokens = await req.container.resolve(AUTH_SERVICE).verifySignIn(pending, code);
    clearPendingAuth(res);

    await deleteAccount(req.container, tokens.accessToken);

    clearSessionCookies(res);
    return respondEmpty(res, confirmAccountDeletion);
  } catch (err) {
    if (toApiError(err).statusCode === 401) {
      clearPendingAuth(res);
    }
    return next(err);
  }
});

export default router;
