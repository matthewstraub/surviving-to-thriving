import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { nanoid } from "nanoid";
import {
  createSession,
  getSessionByCode,
  listSessions,
  addSubmission,
  getSubmissionsBySession,
  clearSubmissionsBySession,
  deleteSession,
  deactivateSession,
  activateSession,
} from "./db";
import { emitNewSubmission, emitSessionReset } from "./socket";
import { notifyOwner } from "./_core/notification";
import { TRPCError } from "@trpc/server";

// In-memory teacher password — set via env or default
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || "thriving2024";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Teacher password auth (simple, no OAuth needed) ──────────────
  teacher: router({
    login: publicProcedure
      .input(z.object({ password: z.string() }))
      .mutation(({ input }) => {
        if (input.password === TEACHER_PASSWORD) {
          return { success: true, token: TEACHER_PASSWORD };
        }
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid teacher password",
        });
      }),
    verify: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(({ input }) => {
        return { valid: input.token === TEACHER_PASSWORD };
      }),
  }),

  // ─── Survey Sessions ─────────────────────────────────────────────
  session: router({
    create: publicProcedure
      .input(
        z.object({
          label: z.string().optional(),
          token: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        if (input.token !== TEACHER_PASSWORD) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }
        const code = nanoid(8);
        const session = await createSession({
          code,
          label: input.label || null,
        });
        return session;
      }),

    list: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        if (input.token !== TEACHER_PASSWORD) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }
        return listSessions();
      }),

    getByCode: publicProcedure
      .input(z.object({ code: z.string() }))
      .query(async ({ input }) => {
        const session = await getSessionByCode(input.code);
        if (!session) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Survey session not found",
          });
        }
        return session;
      }),

    deactivate: publicProcedure
      .input(z.object({ id: z.number(), token: z.string() }))
      .mutation(async ({ input }) => {
        if (input.token !== TEACHER_PASSWORD) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }
        await deactivateSession(input.id);
        return { success: true };
      }),

    activate: publicProcedure
      .input(z.object({ id: z.number(), token: z.string() }))
      .mutation(async ({ input }) => {
        if (input.token !== TEACHER_PASSWORD) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }
        await activateSession(input.id);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number(), token: z.string() }))
      .mutation(async ({ input }) => {
        if (input.token !== TEACHER_PASSWORD) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }
        await deleteSession(input.id);
        return { success: true };
      }),

    reset: publicProcedure
      .input(z.object({ id: z.number(), code: z.string(), token: z.string() }))
      .mutation(async ({ input }) => {
        if (input.token !== TEACHER_PASSWORD) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }
        await clearSubmissionsBySession(input.id);
        emitSessionReset(input.code);
        return { success: true };
      }),
  }),

  // ─── Submissions ──────────────────────────────────────────────────
  submission: router({
    submit: publicProcedure
      .input(
        z.object({
          sessionCode: z.string(),
          studentName: z.string().min(1).max(100),
          emoji: z.string().min(1).max(32),
          rating: z.number().int().min(1).max(10),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const session = await getSessionByCode(input.sessionCode);
        if (!session) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Survey session not found",
          });
        }
        if (!session.isActive) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This survey session is no longer accepting responses",
          });
        }

        // Get IP address
        const ip =
          (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
          ctx.req.socket?.remoteAddress ||
          null;

        const submission = await addSubmission({
          sessionId: session.id,
          studentName: input.studentName,
          emoji: input.emoji,
          rating: input.rating,
          ipAddress: ip,
        });

        // Emit via WebSocket
        emitNewSubmission(input.sessionCode, submission);

        // Check for outlier and notify teacher
        const allSubmissions = await getSubmissionsBySession(session.id);
        if (allSubmissions.length >= 3) {
          const ratings = allSubmissions.map((s) => s.rating);
          const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
          const stdDev = Math.sqrt(
            ratings.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) /
              ratings.length
          );
          const isOutlier = Math.abs(input.rating - avg) > 2 * stdDev;

          if (isOutlier && (input.rating <= 2 || input.rating >= 9)) {
            try {
              await notifyOwner({
                title: `⚠️ Outlier Alert: ${input.studentName}`,
                content: `${input.studentName} rated ${input.rating}/10 ${input.emoji} (class avg: ${avg.toFixed(1)}). Session: ${session.label || session.code}`,
              });
            } catch (e) {
              console.warn("[Notification] Failed to send outlier alert:", e);
            }
          }
        }

        return submission;
      }),

    listBySession: publicProcedure
      .input(z.object({ sessionCode: z.string(), token: z.string() }))
      .query(async ({ input }) => {
        if (input.token !== TEACHER_PASSWORD) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }
        const session = await getSessionByCode(input.sessionCode);
        if (!session) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return getSubmissionsBySession(session.id);
      }),
  }),
});

export type AppRouter = typeof appRouter;
