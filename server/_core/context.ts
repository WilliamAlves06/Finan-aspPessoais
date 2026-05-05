import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { jwtVerify } from "jose";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { getUserById } from "../db";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "seu-secret-super-seguro"
);

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    const cookieHeader = opts.req.headers.cookie ?? "";
    const cookies = parseCookieHeader(cookieHeader);
    const token = cookies[COOKIE_NAME];

    if (token) {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      const userId = payload.userId as number | undefined;

      if (userId) {
        const found = await getUserById(userId);
        user = found ?? null;
      }
    }
  } catch {
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}