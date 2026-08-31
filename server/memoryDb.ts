/**
 * In-memory stand-in for the MySQL-backed helpers in `db.ts`.
 *
 * Two consumers:
 *   1. `survey.test.ts` mocks `./db` with this, so the suite runs offline and can
 *      never reach the production database.
 *   2. `USE_MEMORY_DB=1 pnpm dev` serves the whole app from this store, so the UI
 *      can be developed and reviewed without a TiDB connection.
 *
 * It is never used in production — see the guard in `db.ts`.
 */
import type {
  InsertSubmission,
  InsertSurveySession,
  Submission,
  SurveySession,
} from "../drizzle/schema";

type Store = {
  sessions: SurveySession[];
  submissions: Submission[];
  nextSessionId: number;
  nextSubmissionId: number;
};

const store: Store = {
  sessions: [],
  submissions: [],
  nextSessionId: 1,
  nextSubmissionId: 1,
};

/** Newest first, matching the `desc(createdAt)` ordering the real queries use.
 *  Ties break on id so ordering stays deterministic when rows share a timestamp. */
function newestFirst<T extends { id: number; createdAt: Date }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id
  );
}

export function resetMemoryDb(): void {
  store.sessions = [];
  store.submissions = [];
  store.nextSessionId = 1;
  store.nextSubmissionId = 1;
}

// ─── Mirrors of the db.ts surface ───────────────────────────────────

export async function getDb() {
  return null;
}

export async function createSession(
  data: InsertSurveySession
): Promise<SurveySession> {
  const row: SurveySession = {
    id: store.nextSessionId++,
    code: data.code,
    label: data.label ?? null,
    isActive: data.isActive ?? 1,
    createdAt: data.createdAt ?? new Date(),
  };
  store.sessions.push(row);
  return row;
}

export async function getSessionByCode(
  code: string
): Promise<SurveySession | undefined> {
  return store.sessions.find((s) => s.code === code);
}

export async function listSessions(): Promise<SurveySession[]> {
  return newestFirst(store.sessions);
}

export async function deactivateSession(id: number): Promise<void> {
  const session = store.sessions.find((s) => s.id === id);
  if (session) session.isActive = 0;
}

export async function activateSession(id: number): Promise<void> {
  const session = store.sessions.find((s) => s.id === id);
  if (session) session.isActive = 1;
}

export async function addSubmission(
  data: InsertSubmission
): Promise<Submission> {
  const row: Submission = {
    id: store.nextSubmissionId++,
    sessionId: data.sessionId,
    studentName: data.studentName,
    emoji: data.emoji,
    rating: data.rating,
    ipAddress: data.ipAddress ?? null,
    createdAt: data.createdAt ?? new Date(),
  };
  store.submissions.push(row);
  return row;
}

export async function getSubmissionsBySession(
  sessionId: number
): Promise<Submission[]> {
  return newestFirst(store.submissions.filter((s) => s.sessionId === sessionId));
}

export async function clearSubmissionsBySession(sessionId: number): Promise<void> {
  store.submissions = store.submissions.filter((s) => s.sessionId !== sessionId);
}

export async function deleteSession(id: number): Promise<void> {
  store.submissions = store.submissions.filter((s) => s.sessionId !== id);
  store.sessions = store.sessions.filter((s) => s.id !== id);
}

/** Demo data for `USE_MEMORY_DB=1 pnpm dev`, so the dashboard and student pages
 *  render with realistic content — including a low outlier to exercise the badge. */
export async function seedMemoryDb(): Promise<void> {
  resetMemoryDb();

  const session = await createSession({ code: "demo1234", label: "Demo — Wednesday 2pm" });
  await createSession({ code: "closed99", label: "Demo — Closed Session", isActive: 0 });

  const responses: Array<[string, string, number]> = [
    ["Ava", "😀", 8],
    ["Ben", "🙂", 7],
    ["Chloe", "😐", 5],
    ["Diego", "😩", 2],
    ["Elena", "🔥", 9],
    ["Farid", "😊", 7],
    ["Grace", "😴", 6],
  ];

  for (const [studentName, emoji, rating] of responses) {
    await addSubmission({
      sessionId: session.id,
      studentName,
      emoji,
      rating,
      ipAddress: "127.0.0.1",
    });
  }
}
