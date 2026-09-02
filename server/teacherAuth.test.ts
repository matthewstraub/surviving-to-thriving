import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertTeacherPasswordConfigured,
  isCorrectPassword,
  issueTeacherToken,
  isValidTeacherToken,
  readBearerToken,
} from "./_core/teacherAuth";

const HOUR = 60 * 60 * 1000;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("assertTeacherPasswordConfigured", () => {
  it("refuses to start in production when the password is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TEACHER_PASSWORD", "");
    expect(() => assertTeacherPasswordConfigured()).toThrow(/TEACHER_PASSWORD is not set/);
  });

  it("starts in production when the password is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TEACHER_PASSWORD", "a-real-password");
    expect(() => assertTeacherPasswordConfigured()).not.toThrow();
  });

  it("allows a fallback outside production so local dev needs no config", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("TEACHER_PASSWORD", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => assertTeacherPasswordConfigured()).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("isCorrectPassword", () => {
  it("accepts the configured password and rejects anything else", () => {
    vi.stubEnv("TEACHER_PASSWORD", "correct-horse");
    expect(isCorrectPassword("correct-horse")).toBe(true);
    expect(isCorrectPassword("Correct-Horse")).toBe(false);
    expect(isCorrectPassword("correct-horse ")).toBe(false);
    expect(isCorrectPassword("")).toBe(false);
    expect(isCorrectPassword("a much longer wrong guess")).toBe(false);
  });
});

describe("teacher tokens", () => {
  it("never hands back the password itself", () => {
    vi.stubEnv("TEACHER_PASSWORD", "s3cret");
    const { token } = issueTeacherToken();
    expect(token).not.toBe("s3cret");
    expect(token).not.toContain("s3cret");
  });

  it("accepts a freshly issued token", () => {
    vi.stubEnv("TEACHER_PASSWORD", "s3cret");
    const { token } = issueTeacherToken();
    expect(isValidTeacherToken(token)).toBe(true);
  });

  it("expires after 12 hours", () => {
    vi.stubEnv("TEACHER_PASSWORD", "s3cret");
    const now = Date.now();
    const { token, expiresAt } = issueTeacherToken(now);

    expect(expiresAt - now).toBe(12 * HOUR);
    expect(isValidTeacherToken(token, now + 11 * HOUR)).toBe(true);
    expect(isValidTeacherToken(token, now + 13 * HOUR)).toBe(false);
  });

  it("rejects a token whose expiry has been extended", () => {
    vi.stubEnv("TEACHER_PASSWORD", "s3cret");
    const now = Date.now();
    const { token } = issueTeacherToken(now);
    const signature = token.slice(token.lastIndexOf(".") + 1);
    const forged = `${now + 100 * HOUR}.${signature}`;

    expect(isValidTeacherToken(forged, now)).toBe(false);
  });

  it("rejects a tampered signature", () => {
    vi.stubEnv("TEACHER_PASSWORD", "s3cret");
    const { token } = issueTeacherToken();
    const [payload] = token.split(".");
    expect(isValidTeacherToken(`${payload}.not-a-signature`)).toBe(false);
  });

  it("rejects malformed input", () => {
    vi.stubEnv("TEACHER_PASSWORD", "s3cret");
    for (const bad of ["", ".", "nodot", "..", `${Date.now() + HOUR}.`]) {
      expect(isValidTeacherToken(bad)).toBe(false);
    }
  });

  it("invalidates existing sessions when the password is rotated", () => {
    vi.stubEnv("TEACHER_PASSWORD", "old-password");
    const { token } = issueTeacherToken();
    expect(isValidTeacherToken(token)).toBe(true);

    vi.stubEnv("TEACHER_PASSWORD", "new-password");
    expect(isValidTeacherToken(token)).toBe(false);
  });
});

describe("readBearerToken", () => {
  it("reads a bearer token regardless of scheme casing", () => {
    expect(readBearerToken("Bearer abc123")).toBe("abc123");
    expect(readBearerToken("bearer abc123")).toBe("abc123");
  });

  it("ignores anything that is not a bearer token", () => {
    expect(readBearerToken(undefined)).toBeNull();
    expect(readBearerToken("")).toBeNull();
    expect(readBearerToken("Basic abc123")).toBeNull();
    expect(readBearerToken("Bearer")).toBeNull();
    expect(readBearerToken("Bearer   ")).toBeNull();
  });
});
