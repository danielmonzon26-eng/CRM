import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for Microsoft refresh tokens at rest, keyed by MAIL_TOKEN_KEY (32 bytes,
 * base64; generate with `openssl rand -base64 32`). Stored as "v1.<iv>.<tag>.<data>".
 */
function key(): Buffer {
  const raw = process.env.MAIL_TOKEN_KEY;
  if (!raw) throw new Error("MAIL_TOKEN_KEY not set");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("MAIL_TOKEN_KEY must be 32 bytes, base64-encoded");
  return buf;
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}

export function decryptToken(stored: string): string {
  const [version, iv, tag, data] = stored.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unrecognized token format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
