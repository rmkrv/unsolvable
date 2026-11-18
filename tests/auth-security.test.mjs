import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("login prefers Google and verifies email registrations", () => {
  const source = readFileSync(join(process.cwd(), "components", "auth", "auth-form.tsx"), "utf8");

  assert.match(source, /signIn\.social\(\{\s*provider: "google"/);
  assert.match(source, /emailOtp\.verifyEmail\(\{ email: verificationEmail, otp \}\)/);
  assert.match(source, /emailOtp\.sendVerificationOtp\(/);
  assert.match(source, /@\/components\/ui\/input-otp/);
  assert.doesNotMatch(source, /className="(?:btn|input|alert|divider|fieldset|otp|loading)(?:\s|-")/);
  assert.ok(source.indexOf("Continue with Google") < source.indexOf("Create account with email"));
});

test("registration omits the removed marketing copy", () => {
  const source = readFileSync(join(process.cwd(), "app", "auth", "sign-up", "page.tsx"), "utf8");

  assert.match(source, /Create new account/);
  assert.doesNotMatch(source, /Create your workspace/);
  assert.doesNotMatch(source, /Admin access is never available/);
});

test("sign-in omits dashboard routing copy and keeps Google contrast on hover", () => {
  const page = readFileSync(join(process.cwd(), "app", "auth", "sign-in", "page.tsx"), "utf8");
  const form = readFileSync(join(process.cwd(), "components", "auth", "auth-form.tsx"), "utf8");

  assert.doesNotMatch(page, /We will send you to the dashboard for your account role/);
  assert.match(form, /hover:text-primary-foreground/);
});

test("protected application identity rejects unverified email sessions", () => {
  const source = readFileSync(join(process.cwd(), "lib", "server", "auth", "current-user.ts"), "utf8");

  assert.match(source, /!user\.emailVerified/);
});
