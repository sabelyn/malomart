import { ErrorCode } from "@mm/lib";
import { confirmSignUp, getCurrentUser, refreshSession, signIn, signOut, signUp, verifySignIn } from "@mm/lib/auth";
import { Router } from "express";

import { userFromIssuedToken } from "@/auth/claims";
import {
  clearPendingAuth,
  clearSessionCookies,
  readPendingAuth,
  readRefreshToken,
  setPendingAuth,
  setSessionCookies
} from "@/auth/cookies";
import { AUTH_SERVICE } from "@/contracts/tokens";
import { toApiError, unauthorized } from "@/errors/helpers";
import { sendCodeLimit, verifyCodeLimit } from "@/middleware";
import { pathAndMiddleware, respond, respondEmpty, validateRequest } from "./helpers";

const router = Router();

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
    if (!req.user) {
      throw unauthorized();
    }
    const { customerData: _, ...user } = req.user;
    return respond(res, getCurrentUser, user);
  } catch (err) {
    return next(err);
  }
});

export default router;
