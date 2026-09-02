import { int, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";

/** A survey session — each "class check-in" gets a unique session with its own link */
export const surveySessions = mysqlTable("survey_sessions", {
  id: int("id").autoincrement().primaryKey(),
  /** Short unique code used in the shareable URL, e.g. /s/abc123 */
  code: varchar("code", { length: 32 }).notNull().unique(),
  /** Human-readable label the teacher can set, e.g. "Monday 9am class" */
  label: varchar("label", { length: 255 }),
  /** Whether the session is currently accepting submissions */
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SurveySession = typeof surveySessions.$inferSelect;
export type InsertSurveySession = typeof surveySessions.$inferInsert;

/** Individual student submissions */
export const submissions = mysqlTable("submissions", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  studentName: varchar("studentName", { length: 255 }).notNull(),
  emoji: varchar("emoji", { length: 32 }).notNull(),
  rating: int("rating").notNull(),
  ipAddress: varchar("ipAddress", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Submission = typeof submissions.$inferSelect;
export type InsertSubmission = typeof submissions.$inferInsert;
