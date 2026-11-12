/**
 * Guards for the public contact form (POST /api/send-mail).
 *
 * - Honeypot: the form carries a `website` field hidden from people and out of
 *   the tab order. A filled one means a bot; the route drops the message and
 *   answers like a success, so the bot learns nothing.
 * - Length caps on `name` and `content`, and a format check on `email` before
 *   it goes into `replyTo`.
 * - At most CONTACT_SENDS_PER_IP sends per IP per hour.
 *
 * The per-IP limit lives in the memory of the serverless instance. That is a
 * first barrier, not a global count: each warm instance keeps its own map and a
 * cold start empties it, so a spread-out flood can get more than 5 per hour
 * through. The honeypot and the caps do most of the work against bots; a shared
 * store (a Convex table, a KV) can replace `createIpLimiter` without touching
 * the route.
 */

export const CONTACT_NAME_MAX = 100;
export const CONTACT_CONTENT_MAX = 5000;
export const CONTACT_EMAIL_MAX = 254;
export const CONTACT_SENDS_PER_IP = 5;
export const CONTACT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** Name of the honeypot field in the JSON body. */
export const HONEYPOT_FIELD = "website";

// Deliberately plain: one @, no spaces, no characters that could break a
// header, and a dot in the domain.
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/;

export const isValidEmail = (value: string): boolean =>
  value.length <= CONTACT_EMAIL_MAX && EMAIL_RE.test(value);

export interface ContactMessage {
  name: string;
  email: string;
  content: string;
}

export type ContactCheck =
  | { kind: "ok"; message: ContactMessage }
  | { kind: "honeypot" }
  | { kind: "invalid"; error: string };

export const checkContactBody = (body: unknown): ContactCheck => {
  if (!body || typeof body !== "object") {
    return { kind: "invalid", error: "Faltan datos" };
  }
  const raw = body as Record<string, unknown>;

  const trap = raw[HONEYPOT_FIELD];
  if (typeof trap === "string" ? trap.trim() !== "" : trap != null) {
    return { kind: "honeypot" };
  }

  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const email = typeof raw.email === "string" ? raw.email.trim() : "";
  const content = typeof raw.content === "string" ? raw.content.trim() : "";

  if (!name || !email || !content) {
    return { kind: "invalid", error: "Faltan datos" };
  }
  if (name.length > CONTACT_NAME_MAX) {
    return { kind: "invalid", error: "El nombre es demasiado largo" };
  }
  if (content.length > CONTACT_CONTENT_MAX) {
    return { kind: "invalid", error: "El mensaje es demasiado largo" };
  }
  if (!isValidEmail(email)) {
    return { kind: "invalid", error: "El email no es válido" };
  }
  return { kind: "ok", message: { name, email, content } };
};

/** Sliding-window counter per key, in memory. */
export const createIpLimiter = (
  max: number = CONTACT_SENDS_PER_IP,
  windowMs: number = CONTACT_WINDOW_MS
) => {
  const hits = new Map<string, number[]>();

  const prune = (now: number) => {
    for (const [key, times] of hits) {
      const kept = times.filter((t) => t > now - windowMs);
      if (kept.length === 0) hits.delete(key);
      else hits.set(key, kept);
    }
  };

  return {
    /** Records a send for `key` and returns false when it is over the limit. */
    allow(key: string, now: number = Date.now()): boolean {
      if (hits.size > 10_000) prune(now);
      const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
  };
};

/** Client IP as Vercel reports it. */
export const clientIp = (headers: Headers): string =>
  headers.get("x-real-ip")?.trim() ||
  headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  "unknown";
