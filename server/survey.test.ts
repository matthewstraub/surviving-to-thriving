import { describe, expect, it, beforeEach, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the socket module to avoid actual WebSocket connections
vi.mock("./socket", () => ({
  emitNewSubmission: vi.fn(),
  emitSessionReset: vi.fn(),
}));

// Mock the notification module
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || "thriving2024";

function createMockContext(overrides?: Partial<TrpcContext>): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    } as unknown as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
    ...overrides,
  };
}

describe("teacher.login", () => {
  it("returns success with correct password", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.teacher.login({ password: TEACHER_PASSWORD });
    expect(result.success).toBe(true);
    expect(result.token).toBe(TEACHER_PASSWORD);
  });

  it("throws UNAUTHORIZED with wrong password", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.teacher.login({ password: "wrong-password" })
    ).rejects.toThrow();
  });
});

describe("teacher.verify", () => {
  it("returns valid=true for correct token", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.teacher.verify({ token: TEACHER_PASSWORD });
    expect(result.valid).toBe(true);
  });

  it("returns valid=false for incorrect token", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.teacher.verify({ token: "bad-token" });
    expect(result.valid).toBe(false);
  });
});

describe("session.create", () => {
  it("creates a new session with a unique code", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const session = await caller.session.create({
      label: "Test Session",
      token: TEACHER_PASSWORD,
    });

    expect(session).toBeDefined();
    expect(session.code).toBeTruthy();
    expect(session.code.length).toBe(8);
    expect(session.label).toBe("Test Session");
    expect(session.isActive).toBe(1);
  });

  it("rejects unauthorized session creation", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.session.create({ label: "Test", token: "wrong" })
    ).rejects.toThrow();
  });
});

describe("session.list", () => {
  it("lists sessions for authenticated teacher", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const sessions = await caller.session.list({ token: TEACHER_PASSWORD });
    expect(Array.isArray(sessions)).toBe(true);
  });

  it("rejects unauthorized listing", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.session.list({ token: "wrong" })
    ).rejects.toThrow();
  });
});

describe("session.getByCode", () => {
  it("retrieves a session by its code", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    // First create a session
    const created = await caller.session.create({
      label: "Lookup Test",
      token: TEACHER_PASSWORD,
    });

    // Then look it up by code
    const found = await caller.session.getByCode({ code: created.code });
    expect(found.id).toBe(created.id);
    expect(found.label).toBe("Lookup Test");
  });

  it("throws NOT_FOUND for invalid code", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.session.getByCode({ code: "nonexistent" })
    ).rejects.toThrow();
  });
});

describe("submission.submit", () => {
  it("creates a submission for a valid active session", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    // Create a session first
    const session = await caller.session.create({
      label: "Submit Test",
      token: TEACHER_PASSWORD,
    });

    const submission = await caller.submission.submit({
      sessionCode: session.code,
      studentName: "Alice",
      emoji: "😊",
      rating: 7,
    });

    expect(submission).toBeDefined();
    expect(submission.studentName).toBe("Alice");
    expect(submission.emoji).toBe("😊");
    expect(submission.rating).toBe(7);
    expect(submission.sessionId).toBe(session.id);
  });

  it("rejects submission for nonexistent session", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.submission.submit({
        sessionCode: "nonexistent",
        studentName: "Bob",
        emoji: "😐",
        rating: 5,
      })
    ).rejects.toThrow();
  });

  it("validates rating range (1-10)", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.submission.submit({
        sessionCode: "test",
        studentName: "Charlie",
        emoji: "😊",
        rating: 0,
      })
    ).rejects.toThrow();

    await expect(
      caller.submission.submit({
        sessionCode: "test",
        studentName: "Charlie",
        emoji: "😊",
        rating: 11,
      })
    ).rejects.toThrow();
  });

  it("validates student name is not empty", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.submission.submit({
        sessionCode: "test",
        studentName: "",
        emoji: "😊",
        rating: 5,
      })
    ).rejects.toThrow();
  });
});

describe("submission.listBySession", () => {
  it("lists submissions for a session", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    // Create session and add submissions
    const session = await caller.session.create({
      label: "List Test",
      token: TEACHER_PASSWORD,
    });

    await caller.submission.submit({
      sessionCode: session.code,
      studentName: "Dave",
      emoji: "🔥",
      rating: 9,
    });

    await caller.submission.submit({
      sessionCode: session.code,
      studentName: "Eve",
      emoji: "😐",
      rating: 5,
    });

    const subs = await caller.submission.listBySession({
      sessionCode: session.code,
      token: TEACHER_PASSWORD,
    });

    expect(subs.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects unauthorized listing", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.submission.listBySession({
        sessionCode: "test",
        token: "wrong",
      })
    ).rejects.toThrow();
  });
});

describe("session.reset", () => {
  it("clears all submissions for a session", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    // Create session and add a submission
    const session = await caller.session.create({
      label: "Reset Test",
      token: TEACHER_PASSWORD,
    });

    await caller.submission.submit({
      sessionCode: session.code,
      studentName: "Frank",
      emoji: "😊",
      rating: 8,
    });

    // Verify submission exists
    let subs = await caller.submission.listBySession({
      sessionCode: session.code,
      token: TEACHER_PASSWORD,
    });
    expect(subs.length).toBeGreaterThanOrEqual(1);

    // Reset
    const result = await caller.session.reset({
      id: session.id,
      code: session.code,
      token: TEACHER_PASSWORD,
    });
    expect(result.success).toBe(true);

    // Verify submissions are cleared
    subs = await caller.submission.listBySession({
      sessionCode: session.code,
      token: TEACHER_PASSWORD,
    });
    expect(subs.length).toBe(0);
  });
});

describe("session.delete", () => {
  it("deletes a session and its submissions", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const session = await caller.session.create({
      label: "Delete Test",
      token: TEACHER_PASSWORD,
    });

    await caller.submission.submit({
      sessionCode: session.code,
      studentName: "Grace",
      emoji: "✨",
      rating: 10,
    });

    const result = await caller.session.delete({
      id: session.id,
      token: TEACHER_PASSWORD,
    });
    expect(result.success).toBe(true);

    // Session should no longer be found
    await expect(
      caller.session.getByCode({ code: session.code })
    ).rejects.toThrow();
  });
});
