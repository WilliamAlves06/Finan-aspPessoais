import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { users } from "../drizzle/schema";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createUser(email: string, password: string, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const hashedPassword = await hashPassword(password);
  await db.insert(users).values({
    email,
    password: hashedPassword,
    name,
    role: "user",
  });
}
