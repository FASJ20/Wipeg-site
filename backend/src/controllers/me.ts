import type { Request, Response } from "express";

import { ok } from "../lib/http.js";
import { identityOf, } from "../middleware/auth.js";
import { primaryRole } from "../models/identity.js";

/**
 * Who am I? The first call every signed-in page makes, and the only way the
 * frontend learns which menu to draw.
 *
 * It returns what the caller is, never what they may do. The frontend uses
 * it to hide buttons; the server decides access per route regardless, so a
 * tampered response buys nothing.
 */
export function whoAmI(req: Request, res: Response): void {
  const me = identityOf(req);

  ok(res, {
    personId: me.personId,
    name: `${me.givenNames} ${me.surname}`.trim(),
    surname: me.surname,
    givenNames: me.givenNames,
    schoolEmail: me.schoolEmail,
    photoKey: me.photoKey,
    preferredLanguage: me.preferredLanguage,
    role: primaryRole(me),
    roles: {
      admin: me.isAdmin,
      lecturer: me.isStaff,
      student: me.isStudent,
    },
    matricule: me.matricule,
    staffNumber: me.staffNumber,
    jobTitle: me.jobTitle,
  });
}
