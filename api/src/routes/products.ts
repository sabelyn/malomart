import { Router } from "express";

import { requireAdmin } from "@/middleware";

const router = Router();

router.get("/", (req, res, next) => res.sendStatus(200));

router.get("/:id", (req, res, next) => res.sendStatus(200));

router.post("/", requireAdmin, (req, res, next) => res.sendStatus(201));

router.put("/:id", requireAdmin, (req, res, next) => res.sendStatus(200));

router.delete("/:id", requireAdmin, (req, res, next) => res.sendStatus(204));

export default router;
