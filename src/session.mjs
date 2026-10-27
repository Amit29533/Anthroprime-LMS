import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
const MAX_AGE = 8 * 60 * 60;
export function createSessions({ key, production = false } = {}) {
  if (key && !/^[a-f0-9]{64}$/i.test(key))
    throw new Error("LMS_SESSION_KEY must contain 64 hexadecimal characters.");
  if (production && !key)
    throw new Error("A persistent LMS_SESSION_KEY is required in production.");
  const secret = key ? Buffer.from(key, "hex") : randomBytes(32);
  const name = production ? "__Host-anthroprime" : "anthroprime";
  const cookie = (value, age = MAX_AGE) =>
    `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${production ? "; Secure" : ""}`;
  return {
    issue(token) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", secret, iv);
      const payload = Buffer.concat([
        cipher.update(JSON.stringify({ token, at: Date.now() }), "utf8"),
        cipher.final(),
      ]);
      return cookie(
        Buffer.concat([iv, cipher.getAuthTag(), payload]).toString("base64url"),
      );
    },
    read(header = "") {
      try {
        const value = header
          .split(";")
          .map((part) => part.trim())
          .find((part) => part.startsWith(`${name}=`))
          ?.slice(name.length + 1);
        if (!value || value.length > 4000) return null;
        const bytes = Buffer.from(value, "base64url");
        const decipher = createDecipheriv(
          "aes-256-gcm",
          secret,
          bytes.subarray(0, 12),
        );
        decipher.setAuthTag(bytes.subarray(12, 28));
        const payload = JSON.parse(
          Buffer.concat([
            decipher.update(bytes.subarray(28)),
            decipher.final(),
          ]).toString(),
        );
        if (
          typeof payload.token !== "string" ||
          !/^[a-f0-9]{64}$/i.test(payload.token) ||
          !Number.isFinite(payload.at) ||
          payload.at > Date.now() ||
          Date.now() - payload.at > MAX_AGE * 1000
        )
          return null;
        return payload.token;
      } catch {
        return null;
      }
    },
    clear: () => cookie("", 0),
  };
}
