import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { isValidTeacherToken, readBearerToken } from "./teacherAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  /** Whether this request carried a valid teacher session token. */
  isTeacher: boolean;
};

export function createContext(opts: CreateExpressContextOptions): TrpcContext {
  // The token travels in the Authorization header rather than the procedure
  // input, so it never appears in a URL or an HTTP access log.
  const token = readBearerToken(opts.req.headers.authorization);

  return {
    req: opts.req,
    res: opts.res,
    isTeacher: token !== null && isValidTeacherToken(token),
  };
}
