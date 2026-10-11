import { ErrorCode } from "@mm/lib";
import type { CurrentUser } from "@mm/lib/auth";
import {
  confirmAccountDeletion,
  confirmEmailChange,
  confirmSignUp,
  getCurrentUser,
  refreshSession,
  requestAccountDeletion,
  requestEmailChange,
  signIn,
  signOut,
  signUp,
  updateProfile,
  verifySignIn
} from "@mm/lib/auth";
import type { Request, Response } from "express";
import { Router } from "express";

import { userFromIssuedToken } from "@/auth/claims";
import {
  clearPendingAuth,
  clearSessionCookies,
  readAccessToken,
  readPendingAuth,
  readRefreshToken,
  setPendingAuth,
  setSessionCookies
} from "@/auth/cookies";
import { AUTH_SERVICE, CUSTOMER_SERVICE } from "@/contracts/tokens";
import { badRequest, forbidden, toApiError, unauthorized } from "@/errors/helpers";
import { sendCodeLimit, verifyCodeLimit } from "@/middleware";
import { pathAndMiddleware, respond, respondEmpty, validateRequest } from "./helpers";

const router = Router();

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

const requireEmailSignIn = (user: CurrentUser) => {
  if (user.signInMethod !== "email") {
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
    requireEmailSignIn(user);
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
    requireEmailSignIn(user);

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
    const pending = readPendingAuth(req);
    if (pending?.email !== user.email) {
      throw unauthorized(undefined, ErrorCode.NoPendingSignIn);
    }

    const authService = req.container.resolve(AUTH_SERVICE);
    const customerService = req.container.resolve(CUSTOMER_SERVICE);
    const tokens = await authService.verifySignIn(pending, code);
    clearPendingAuth(res);

    await customerService.deleteSavedData();
    await authService.deleteUser(tokens.accessToken);
    await customerService
      .deleteCustomerRecord()
      .catch(err => console.error("Failed to delete the customer record after deleting the account.", err));

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
