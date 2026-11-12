/**
 * Unit tests for requireServerSecret (convex/model/auth.ts).
 *
 * The gate in front of every public mutation that returns a raw token. Every
 * failure mode must surface the same generic AuthError, so a caller cannot tell
 * "env var missing" from "wrong secret".
 */
import { describe, it, expect, afterEach } from "vitest";
import { AuthError, requireServerSecret } from "../../../../convex/model/auth";

const SECRET = process.env.SERVER_ACTION_SECRET as string;

afterEach(() => {
  process.env.SERVER_ACTION_SECRET = SECRET;
});

describe("requireServerSecret", () => {
  it("accepts the configured secret", async () => {
    await expect(requireServerSecret(SECRET)).resolves.toBeUndefined();
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["wrong", "not-the-secret"],
    ["prefix", SECRET.slice(0, -1)],
    ["longer", `${SECRET}x`],
    ["non-string", 42],
  ])("rejects a %s value with the generic error", async (_label, value) => {
    const err = await requireServerSecret(value).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect((err as Error).message).toBe("no autorizado");
  });

  it("rejects everything when SERVER_ACTION_SECRET is unset", async () => {
    delete process.env.SERVER_ACTION_SECRET;
    const err = await requireServerSecret(SECRET).catch((e: unknown) => e);
    expect((err as Error).message).toBe("no autorizado");
  });

  it("rejects an empty provided value when the env var is empty too", async () => {
    process.env.SERVER_ACTION_SECRET = "";
    const err = await requireServerSecret("").catch((e: unknown) => e);
    expect((err as Error).message).toBe("no autorizado");
  });
});
