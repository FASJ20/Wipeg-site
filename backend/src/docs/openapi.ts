import { env } from "../lib/env.js";

/**
 * The OpenAPI description, served as JSON and rendered by Swagger UI at
 * /api/docs so every endpoint can be tried in a browser.
 *
 * Written by hand rather than generated from the zod schemas. Generating it
 * would keep the shapes in step automatically, but the useful part of a
 * document like this is the sentence explaining what an endpoint is FOR and
 * who may call it, and a generator cannot write that.
 *
 * Sign-in note for anyone trying this: the session is an httpOnly cookie, so
 * "Authorize" is not needed. Call POST /auth/login first and the browser
 * holds the cookie for every call afterwards.
 */

const ERROR = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: {
        code: {
          type: "string",
          enum: [
            "validation_failed",
            "not_authenticated",
            "not_authorised",
            "not_found",
            "conflict",
            "rate_limited",
            "upstream_failed",
            "internal_error",
          ],
        },
        message: { type: "string" },
        details: {
          type: "array",
          items: {
            type: "object",
            properties: {
              field: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
  },
} as const;

const wrapped = (schema: unknown) => ({
  type: "object",
  properties: { data: schema },
});

const json = (schema: unknown) => ({
  "application/json": { schema },
});

const errors = {
  "400": { description: "Something in the request was wrong", content: json(ERROR) },
  "401": { description: "Not signed in", content: json(ERROR) },
  "403": { description: "Signed in, but not allowed to do this", content: json(ERROR) },
  "404": { description: "Not found", content: json(ERROR) },
  "409": { description: "Clashes with something that already exists", content: json(ERROR) },
  "429": { description: "Too many attempts", content: json(ERROR) },
};

const REGISTER_BASE = {
  surname: { type: "string", example: "MBOM" },
  givenNames: { type: "string", example: "Eric" },
  email: { type: "string", format: "email", example: "eric.mbom@example.com" },
  phone: { type: "string", example: "+237655596057" },
  password: {
    type: "string",
    minLength: 10,
    description: "At least 10 characters. A short sentence works well.",
    example: "garoua rain season",
  },
};

export function openApiDocument() {
  return {
    openapi: "3.0.3",
    info: {
      title: "WIPEG API",
      version: "0.1.0",
      description: [
        "The API behind the WIPEG website and the staff tools.",
        "",
        "**How to sign in here.** The session is a cookie, so there is no token to paste.",
        "Run `POST /auth/login` with an email and password, and every call after that",
        "is signed in automatically. `POST /auth/sign-out` ends it.",
        "",
        "Signing in with Google cannot be tried from this page, because it redirects",
        "to Google and back. Open `/api/auth/google` in a browser tab instead.",
        "",
        "**Three kinds of user.** Admin can do everything. A lecturer sees the classes",
        "they teach. A student sees their own record. Registering never grants any of",
        "these — it adds a request an admin has to approve.",
      ].join("\n"),
    },
    servers: [{ url: `http://localhost:${env.PORT}/api`, description: "Local" }],
    tags: [
      { name: "Health", description: "Is it up" },
      { name: "Signing in", description: "Password and Google" },
      { name: "Registering", description: "Asking for an account" },
      { name: "Reviewing", description: "Admin: approving those requests" },
      { name: "Catalogue", description: "Public. Campuses, departments, programmes" },
      { name: "Booking", description: "Public. Booking a call, via Google Calendar" },
      { name: "Classroom", description: "Admin: Google Classroom sync" },
      { name: "Audit", description: "Admin: who did what" },
    ],
    paths: {
      "/health": {
        get: {
          tags: ["Health"],
          summary: "Is the server up, and can it reach the database",
          security: [],
          responses: {
            "200": { description: "Up" },
            "503": { description: "Up, but the database is unreachable" },
          },
        },
      },

      "/auth/login": {
        post: {
          tags: ["Signing in"],
          summary: "Sign in with an email and password",
          description:
            "Sets the session cookie. A wrong password and an unknown address give the same answer on purpose — telling them apart would reveal who has an account.",
          security: [],
          requestBody: {
            required: true,
            content: json({
              type: "object",
              required: ["email", "password"],
              properties: {
                email: { type: "string", format: "email" },
                password: { type: "string" },
              },
            }),
          },
          responses: {
            "200": {
              description: "Signed in; the cookie is set",
              content: json(
                wrapped({
                  type: "object",
                  properties: {
                    personId: { type: "string", format: "uuid" },
                    name: { type: "string" },
                    role: { type: "string", enum: ["admin", "lecturer", "student"] },
                  },
                }),
              ),
            },
            ...errors,
          },
        },
      },

      "/auth/sign-out": {
        post: {
          tags: ["Signing in"],
          summary: "Sign out",
          responses: { "200": { description: "Cookie cleared" } },
        },
      },

      "/auth/google": {
        get: {
          tags: ["Signing in"],
          summary: "Start signing in with Google",
          description:
            "Redirects to Google. Cannot be tried from this page — open it in a browser tab.",
          security: [],
          responses: { "302": { description: "Redirect to Google" } },
        },
      },

      "/me": {
        get: {
          tags: ["Signing in"],
          summary: "Who am I",
          description: "What the signed-in caller is. The first call every portal page makes.",
          responses: {
            "200": { description: "The signed-in person" },
            ...errors,
          },
        },
      },

      "/auth/register/student": {
        post: {
          tags: ["Registering"],
          summary: "A student asks for an account",
          description:
            "Writes a request to a queue. Grants nothing until an admin approves it.",
          security: [],
          requestBody: {
            required: true,
            content: json({
              type: "object",
              required: [
                "surname",
                "givenNames",
                "email",
                "phone",
                "password",
                "campusId",
                "departmentId",
                "levelApplied",
              ],
              properties: {
                ...REGISTER_BASE,
                campusId: {
                  type: "string",
                  format: "uuid",
                  description: "From GET /catalogue/campuses",
                },
                departmentId: {
                  type: "string",
                  format: "uuid",
                  description: "From GET /catalogue/departments",
                },
                levelApplied: { type: "integer", minimum: 1, maximum: 5, example: 1 },
                message: { type: "string" },
              },
            }),
          },
          responses: { "201": { description: "Request received" }, ...errors },
        },
      },

      "/auth/register/lecturer": {
        post: {
          tags: ["Registering"],
          summary: "A lecturer asks for an account",
          description: "For the lecturer portal. Always needs an admin to approve.",
          security: [],
          requestBody: {
            required: true,
            content: json({
              type: "object",
              required: ["surname", "givenNames", "email", "phone", "password"],
              properties: {
                ...REGISTER_BASE,
                departmentId: { type: "string", format: "uuid" },
                message: {
                  type: "string",
                  description: "What they teach",
                  example: "I teach Software Engineering at the Garoua campus.",
                },
              },
            }),
          },
          responses: { "201": { description: "Request received" }, ...errors },
        },
      },

      "/auth/register/admin": {
        post: {
          tags: ["Registering"],
          summary: "An administrator asks for an account",
          description:
            "For the admin portal. Approving one of these grants full access to every student record, so it is the most consequential decision in the system and is recorded as such in the audit log.",
          security: [],
          requestBody: {
            required: true,
            content: json({
              type: "object",
              required: ["surname", "givenNames", "email", "phone", "password"],
              properties: { ...REGISTER_BASE, message: { type: "string" } },
            }),
          },
          responses: { "201": { description: "Request received" }, ...errors },
        },
      },

      "/account-requests": {
        get: {
          tags: ["Reviewing"],
          summary: "The queue of people waiting to be approved",
          parameters: [
            {
              name: "kind",
              in: "query",
              schema: { type: "string", enum: ["student", "lecturer", "admin"] },
            },
            { name: "limit", in: "query", schema: { type: "integer", default: 100 } },
          ],
          responses: { "200": { description: "Oldest first" }, ...errors },
        },
      },

      "/account-requests/{id}/decide": {
        post: {
          tags: ["Reviewing"],
          summary: "Approve or reject one request",
          description:
            "Approving creates the real person record, and for an admin request also grants admin. All in one transaction.",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: json({
              type: "object",
              required: ["decision"],
              properties: {
                decision: { type: "string", enum: ["approve", "reject"] },
                reason: {
                  type: "string",
                  description: "Required when rejecting, so the person can be told why",
                },
              },
            }),
          },
          responses: { "200": { description: "Decided" }, ...errors },
        },
      },

      "/catalogue": {
        get: {
          tags: ["Catalogue"],
          summary: "Everything at once",
          description: "Campuses, departments, programmes and levels. What the website loads first.",
          security: [],
          responses: { "200": { description: "The whole catalogue" } },
        },
      },
      "/catalogue/campuses": {
        get: { tags: ["Catalogue"], summary: "The five campuses", security: [], responses: { "200": { description: "OK" } } },
      },
      "/catalogue/departments": {
        get: { tags: ["Catalogue"], summary: "The ten departments", security: [], responses: { "200": { description: "OK" } } },
      },
      "/catalogue/departments/{slug}": {
        get: {
          tags: ["Catalogue"],
          summary: "One department and its programmes",
          security: [],
          parameters: [
            {
              name: "slug",
              in: "path",
              required: true,
              schema: { type: "string" },
              example: "computer-engineering",
            },
          ],
          responses: { "200": { description: "OK" }, "404": errors["404"] },
        },
      },
      "/catalogue/specialisations": {
        get: {
          tags: ["Catalogue"],
          summary: "All 51 programmes, or one department's",
          security: [],
          parameters: [
            {
              name: "department",
              in: "query",
              schema: { type: "string" },
              example: "business-and-finance",
            },
          ],
          responses: { "200": { description: "OK" } },
        },
      },
      "/catalogue/levels": {
        get: { tags: ["Catalogue"], summary: "Levels 1 to 5 and what each awards", security: [], responses: { "200": { description: "OK" } } },
      },

      "/booking/slots": {
        get: {
          tags: ["Booking"],
          summary: "Free times on a day",
          description:
            "Read straight from the WIPEG Google Calendar. Needs the Google settings to be configured.",
          security: [],
          parameters: [
            {
              name: "date",
              in: "query",
              required: true,
              schema: { type: "string", example: "2026-12-01" },
            },
          ],
          responses: { "200": { description: "Open slots" }, ...errors },
        },
      },
      "/booking": {
        post: {
          tags: ["Booking"],
          summary: "Book a call",
          description:
            "Writes the event onto the WIPEG calendar. Online gets a Meet link; onsite gets the campus address. Nothing is stored in this database.",
          security: [],
          requestBody: {
            required: true,
            content: json({
              type: "object",
              required: ["name", "phone", "mode", "startsAt"],
              properties: {
                name: { type: "string", example: "Eric MBOM" },
                phone: { type: "string", example: "+237655596057" },
                email: { type: "string", format: "email" },
                mode: { type: "string", enum: ["online", "onsite"] },
                department: { type: "string" },
                topic: { type: "string" },
                startsAt: {
                  type: "string",
                  format: "date-time",
                  description: "One of the slots from /booking/slots",
                },
              },
            }),
          },
          responses: { "201": { description: "Booked" }, ...errors },
        },
      },

      "/classroom/sync": {
        post: {
          tags: ["Classroom"],
          summary: "Create Classrooms and add students",
          description:
            "Safe to run as often as you like — it never duplicates and never removes anybody.",
          requestBody: {
            content: json({
              type: "object",
              properties: {
                offeringId: {
                  type: "string",
                  format: "uuid",
                  description: "Leave out to do every active subject",
                },
                limit: { type: "integer", default: 200 },
              },
            }),
          },
          responses: { "200": { description: "What it did" }, ...errors },
        },
      },

      "/audit": {
        get: {
          tags: ["Audit"],
          summary: "Who did what",
          description:
            "With one Admin role, this is the control that replaces separation of duties.",
          parameters: [
            { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
            { name: "entity", in: "query", schema: { type: "string" } },
            { name: "before", in: "query", schema: { type: "integer" } },
          ],
          responses: { "200": { description: "Most recent first" }, ...errors },
        },
      },
    },
    components: {
      securitySchemes: {
        session: {
          type: "apiKey",
          in: "cookie",
          name: "wipeg_session",
          description:
            "Set by POST /auth/login. The browser sends it automatically — there is nothing to paste.",
        },
      },
    },
    security: [{ session: [] }],
  };
}
