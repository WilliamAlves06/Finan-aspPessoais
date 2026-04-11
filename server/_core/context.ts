import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { jwtVerify } from "jose";
import { parse as parseCookies } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { ENV } from "./env";
import { getUserById } from "../db";
import type { User } from "../../drizzle/schema";

const JWT_SECRET = new TextEncoder().encode(ENV.jwtSecret);

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: User | null = null;
  try {
    const cookies = parseCookies(opts.req.headers.cookie ?? "");
    const token = cookies[COOKIE_NAME];
    if (token) {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      const userId = payload.userId as number | undefined;
      if (userId) {
        user = (await getUserById(userId)) ?? null;
      }
    }
  } catch {
    user = null;
  }
  return { req: opts.req, res: opts.res, user };
}
