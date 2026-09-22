/**
 * Staff authentication, replacing Supabase Auth (GoTrue).
 *
 * The model is deliberately the same shape as what it replaces, so the rest of
 * the application did not have to change:
 *
 *   - a user record in auth.users, identified by a uuid,
 *   - an opaque session token held in an HttpOnly cookie,
 *   - single-use invitation and password-reset links.
 *
 * What changed is that the token is now an opaque random string checked
 * against auth.sessions, rather than a JWT verified by a remote service. That
 * removes the need for the browser to attach a bearer token to every server
 * function call: the cookie travels automatically, and CSRF is already handled
 * by the middleware registered in src/start.ts.
 *
 * Passwords use scrypt, which is in the Node standard library -- no extra
 * dependency, and deliberately expensive to brute-force.
 *
 * Server-only.
 */
import {
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { asServiceRole } from "./db";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const SESSION_COOKIE = "elev8_session";
const SESSION_TTL_DAYS = 14;
const TOKEN_TTL_HOURS = 72;
const KEY_LENGTH = 64;

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
};

// --- passwords --------------------------------------------------------------

/** Stored as scrypt$<salt hex>$<key hex>, so the format can evolve later. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Session and link tokens are stored hashed, so a database dump is not a key ring. */
const digest = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

// --- users ------------------------------------------------------------------

export async function findUserByEmail(email: string): Promise<AuthUser | null> {
  return asServiceRole(async (client) => {
    const { rows } = await client.query(
      `SELECT id, email, raw_user_meta_data->>'full_name' AS full_name
         FROM auth.users
        WHERE lower(email) = lower($1)`,
      [email],
    );
    const row = rows[0];
    return row ? { id: row.id, email: row.email, fullName: row.full_name ?? "" } : null;
  });
}

export async function getUser(userId: string): Promise<AuthUser | null> {
  return asServiceRole(async (client) => {
    const { rows } = await client.query(
      `SELECT id, email, raw_user_meta_data->>'full_name' AS full_name
         FROM auth.users
        WHERE id = $1`,
      [userId],
    );
    const row = rows[0];
    return row ? { id: row.id, email: row.email, fullName: row.full_name ?? "" } : null;
  });
}

/**
 * Creates the account if the address is new, otherwise returns the existing
 * one. Mirrors the invite flow's tolerance of a repeated invitation.
 */
export async function upsertUser(email: string, fullName: string): Promise<{ user: AuthUser; created: boolean }> {
  return asServiceRole(async (client) => {
    const existing = await client.query(
      `SELECT id, email, raw_user_meta_data->>'full_name' AS full_name
         FROM auth.users WHERE lower(email) = lower($1)`,
      [email],
    );
    if (existing.rows[0]) {
      const row = existing.rows[0];
      return {
        user: { id: row.id, email: row.email, fullName: row.full_name ?? "" },
        created: false,
      };
    }

    const { rows } = await client.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data)
       VALUES ($1, $2, jsonb_build_object('full_name', $3::text))
       RETURNING id, email, raw_user_meta_data->>'full_name' AS full_name`,
      [randomUUID(), email, fullName],
    );
    const row = rows[0];
    return {
      user: { id: row.id, email: row.email, fullName: row.full_name ?? "" },
      created: true,
    };
  });
}

export async function setPassword(userId: string, password: string): Promise<void> {
  const encrypted = await hashPassword(password);
  await asServiceRole(async (client) => {
    await client.query(
      `UPDATE auth.users
          SET encrypted_password = $2,
              email_confirmed_at = COALESCE(email_confirmed_at, now()),
              updated_at = now()
        WHERE id = $1`,
      [userId, encrypted],
    );
    // A password change ends every existing session for that account, so a
    // session opened with the old password cannot outlive it.
    await client.query(`DELETE FROM auth.sessions WHERE user_id = $1`, [userId]);
  });
}

// --- sessions ---------------------------------------------------------------

/** Verifies credentials and opens a session. Null means "no match", without saying which half failed. */
export async function signIn(email: string, password: string): Promise<{ token: string; user: AuthUser } | null> {
  const row = await asServiceRole(async (client) => {
    const { rows } = await client.query(
      `SELECT id, email, encrypted_password, raw_user_meta_data->>'full_name' AS full_name
         FROM auth.users WHERE lower(email) = lower($1)`,
      [email],
    );
    return rows[0] ?? null;
  });

  // Hash even when the account is missing, so a wrong address and a wrong
  // password take the same amount of time.
  const ok = await verifyPassword(password, row?.encrypted_password ?? null);
  if (!row || !ok) return null;

  const token = await createSession(row.id);
  return { token, user: { id: row.id, email: row.email, fullName: row.full_name ?? "" } };
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  await asServiceRole(async (client) => {
    await client.query(
      `INSERT INTO auth.sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [userId, digest(token), expiresAt],
    );
    await client.query(`UPDATE auth.users SET last_sign_in_at = now() WHERE id = $1`, [userId]);
    // Opportunistic cleanup; cheap and keeps the table from growing forever.
    await client.query(`DELETE FROM auth.sessions WHERE expires_at < now()`);
  });
  return token;
}

/** Resolves a session token to its user, or null if it is unknown or expired. */
export async function userFromSession(token: string | null | undefined): Promise<AuthUser | null> {
  if (!token) return null;
  return asServiceRole(async (client) => {
    const { rows } = await client.query(
      `SELECT u.id, u.email, u.raw_user_meta_data->>'full_name' AS full_name
         FROM auth.sessions s
         JOIN auth.users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [digest(token)],
    );
    const row = rows[0];
    return row ? { id: row.id, email: row.email, fullName: row.full_name ?? "" } : null;
  });
}

export async function signOut(token: string | null | undefined): Promise<void> {
  if (!token) return;
  await asServiceRole((client) =>
    client.query(`DELETE FROM auth.sessions WHERE token_hash = $1`, [digest(token)]),
  );
}

// --- invitation and recovery links -----------------------------------------

/**
 * Issues a single-use link token. Any unused token of the same purpose is
 * invalidated first, so only the newest email in someone's inbox works.
 */
export async function issueToken(userId: string, purpose: "invite" | "recovery"): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 3_600_000);
  await asServiceRole(async (client) => {
    await client.query(
      `UPDATE auth.tokens SET used_at = now()
        WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`,
      [userId, purpose],
    );
    await client.query(
      `INSERT INTO auth.tokens (user_id, purpose, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
      [userId, purpose, digest(token), expiresAt],
    );
  });
  return token;
}

/**
 * Spends a link token and sets the new password in one transaction, so a
 * token cannot be redeemed twice by two concurrent requests.
 */
export async function redeemToken(
  token: string,
  newPassword: string,
): Promise<{ token: string; user: AuthUser } | null> {
  const encrypted = await hashPassword(newPassword);

  const user = await asServiceRole(async (client) => {
    const { rows } = await client.query(
      `UPDATE auth.tokens
          SET used_at = now()
        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
        RETURNING user_id`,
      [digest(token)],
    );
    const claimed = rows[0];
    if (!claimed) return null;

    const updated = await client.query(
      `UPDATE auth.users
          SET encrypted_password = $2,
              email_confirmed_at = COALESCE(email_confirmed_at, now()),
              updated_at = now()
        WHERE id = $1
        RETURNING id, email, raw_user_meta_data->>'full_name' AS full_name`,
      [claimed.user_id, encrypted],
    );
    const row = updated.rows[0];
    if (!row) return null;

    // Setting a password ends every other session for that account.
    await client.query(`DELETE FROM auth.sessions WHERE user_id = $1`, [row.id]);
    return { id: row.id, email: row.email, fullName: row.full_name ?? "" } as AuthUser;
  });

  if (!user) return null;
  return { token: await createSession(user.id), user };
}

// --- cookie helpers ---------------------------------------------------------

export const sessionCookieName = SESSION_COOKIE;

export function readSessionCookie(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function sessionCookie(token: string): string {
  const secure = process.env["NODE_ENV"] === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${
    SESSION_TTL_DAYS * 86_400
  }${secure}`;
}

export function clearedSessionCookie(): string {
  const secure = process.env["NODE_ENV"] === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
