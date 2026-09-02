import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, teacherProcedure } from "./_core/trpc";
import { isCorrectPassword, issueTeacherToken } from "./_core/teacherAuth";
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
import { TRPCError } from "@trpc/server";

export const appRouter = router({
  system: systemRouter,
  // ─── Teacher password auth ────────────────────────────────────────
  teacher: router({
    login: publicProcedure
      .input(z.object({ password: z.string() }))
      .mutation(({ input }) => {
        if (!isCorrectPassword(input.password)) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid teacher password",
          });
        }
        // Returns a signed, expiring token rather than the password itself.
        const { token, expiresAt } = issueTeacherToken();
        return { success: true, token, expiresAt };
      }),

    /** The token is read from the Authorization header by createContext. */
    verify: publicProcedure.query(({ ctx }) => ({ valid: ctx.isTeacher })),
  }),

  // ─── Survey Sessions ─────────────────────────────────────────────
  session: router({
    create: teacherProcedure
      .input(
        z.object({
          label: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const code = nanoid(8);
        const session = await createSession({
          code,
          label: input.label || null,
        });
        return session;
      }),

    list: teacherProcedure.query(async () => listSessions()),

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

    deactivate: teacherProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deactivateSession(input.id);
        return { success: true };
      }),

    activate: teacherProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await activateSession(input.id);
        return { success: true };
      }),

    delete: teacherProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteSession(input.id);
        return { success: true };
      }),

    reset: teacherProcedure
      .input(z.object({ id: z.number(), code: z.string() }))
      .mutation(async ({ input }) => {
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

        return submission;
      }),

    listBySession: teacherProcedure
      .input(z.object({ sessionCode: z.string() }))
      .query(async ({ input }) => {
        const session = await getSessionByCode(input.sessionCode);
        if (!session) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return getSubmissionsBySession(session.id);
      }),
  }),
});

export type AppRouter = typeof appRouter;
