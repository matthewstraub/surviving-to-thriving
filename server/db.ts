import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  surveySessions,
  submissions,
  type InsertSurveySession,
  type InsertSubmission,
  type SurveySession,
  type Submission,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import * as memoryDb from "./memoryDb";

/**
 * Local-development escape hatch: serve every query from an in-memory store so the
 * app runs with no database at all. Double-guarded so it can never engage in
 * production, where Render sets NODE_ENV=production.
 */
const USE_MEMORY_DB =
  process.env.USE_MEMORY_DB === "1" && process.env.NODE_ENV !== "production";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ─── Survey Session helpers ─────────────────────────────────────────

export async function createSession(
  data: InsertSurveySession
): Promise<SurveySession> {
  if (USE_MEMORY_DB) return memoryDb.createSession(data);

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(surveySessions).values(data);
  const [row] = await db
    .select()
    .from(surveySessions)
    .where(eq(surveySessions.code, data.code!))
    .limit(1);
  return row;
}

export async function getSessionByCode(
  code: string
): Promise<SurveySession | undefined> {
  if (USE_MEMORY_DB) return memoryDb.getSessionByCode(code);

  const db = await getDb();
  if (!db) return undefined;

  const [row] = await db
    .select()
    .from(surveySessions)
    .where(eq(surveySessions.code, code))
    .limit(1);
  return row;
}

export async function listSessions(): Promise<SurveySession[]> {
  if (USE_MEMORY_DB) return memoryDb.listSessions();

  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(surveySessions)
    .orderBy(desc(surveySessions.createdAt));
}

export async function deactivateSession(id: number): Promise<void> {
  if (USE_MEMORY_DB) return memoryDb.deactivateSession(id);

  const db = await getDb();
  if (!db) return;

  await db
    .update(surveySessions)
    .set({ isActive: 0 })
    .where(eq(surveySessions.id, id));
}

export async function activateSession(id: number): Promise<void> {
  if (USE_MEMORY_DB) return memoryDb.activateSession(id);

  const db = await getDb();
  if (!db) return;

  await db
    .update(surveySessions)
    .set({ isActive: 1 })
    .where(eq(surveySessions.id, id));
}

// ─── Submission helpers ─────────────────────────────────────────────

export async function addSubmission(
  data: InsertSubmission
): Promise<Submission> {
  if (USE_MEMORY_DB) return memoryDb.addSubmission(data);

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(submissions).values(data).$returningId();
  const [row] = await db
    .select()
    .from(submissions)
    .where(eq(submissions.id, result.id))
    .limit(1);
  return row;
}

export async function getSubmissionsBySession(
  sessionId: number
): Promise<Submission[]> {
  if (USE_MEMORY_DB) return memoryDb.getSubmissionsBySession(sessionId);

  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(submissions)
    .where(eq(submissions.sessionId, sessionId))
    .orderBy(desc(submissions.createdAt));
}

export async function clearSubmissionsBySession(
  sessionId: number
): Promise<void> {
  if (USE_MEMORY_DB) return memoryDb.clearSubmissionsBySession(sessionId);

  const db = await getDb();
  if (!db) return;

  await db
    .delete(submissions)
    .where(eq(submissions.sessionId, sessionId));
}

export async function deleteSession(id: number): Promise<void> {
  if (USE_MEMORY_DB) return memoryDb.deleteSession(id);

  const db = await getDb();
  if (!db) return;

  await db.delete(submissions).where(eq(submissions.sessionId, id));
  await db.delete(surveySessions).where(eq(surveySessions.id, id));
}
