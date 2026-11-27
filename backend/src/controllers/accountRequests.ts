import type { Request, Response } from "express";
import { z } from "zod";

import { conflict, notFound } from "../lib/errors.js";
import { ok } from "../lib/http.js";
import { identityOf } from "../middleware/auth.js";
import { queryOf } from "../middleware/validate.js";
import * as audit from "../models/auditLog.js";
import * as requests from "../models/accountRequests.js";

/**
 * The approval queue: admins deciding who actually gets in.
 *
 * Kept apart from registration on purpose. Registering is something a
 * stranger does and which grants nothing; approving is the moment access
 * begins, and it is admin-only. Two different jobs, two different files.
 */

export const queueQuery = z.object({
  kind: z.enum(["student", "lecturer", "admin"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export async function listQueue(req: Request, res: Response) {
  const options = queryOf<z.infer<typeof queueQuery>>(req);
  ok(res, await requests.listPending(options.kind ?? null, options.limit));
}

export const decisionBody = z.object({
  decision: z.enum(["approve", "reject"]),
  /** Required when rejecting, so the person can be told why. */
  reason: z.string().trim().max(500).optional(),
});

export async function decide(req: Request, res: Response) {
  const me = identityOf(req);
  const id = String(req.params.id ?? "");
  const body = req.body as z.infer<typeof decisionBody>;

  const request = await requests.findById(id);
  if (!request) throw notFound("That request");
  if (request.status !== "pending") {
    throw conflict(`That request has already been ${request.status}.`);
  }

  if (body.decision === "reject") {
    const reason = body.reason?.trim();
    if (!reason) throw conflict("Say why, so the person can be told.");

    await requests.reject(id, me.personId, reason);
    await audit.record(req.actor, {
      action: "account_rejected",
      entity: "account_requests",
      entityId: id,
      summary: `Rejected the ${request.kind} request from ${request.email}: ${reason}`,
    });
    ok(res, { id, status: "rejected" });
    return;
  }

  const result = await requests.approve(id, me.personId, {
    // An admin request becoming an admin is the single most consequential
    // thing in this system, so it is recorded as its own fact rather than
    // implied by the kind of request.
    grantAdmin: request.kind === "admin",
  });

  await audit.record(req.actor, {
    action: "account_approved",
    entity: "account_requests",
    entityId: id,
    summary:
      `Approved the ${request.kind} request from ${request.email}` +
      (request.kind === "admin" ? " AND GRANTED ADMIN." : "."),
    after: { personId: result.personId, kind: request.kind },
  });

  ok(res, { id, status: "approved", personId: result.personId });
}
