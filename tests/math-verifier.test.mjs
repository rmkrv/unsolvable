import test from "node:test";
import assert from "node:assert/strict";
import { verifyArithmeticEquation, verifyMathStep } from "../bridge/math-verifier.mjs";

test("rejects the incorrect factorization from scenario A", () => {
  const result = verifyMathStep("x^2 + x - 2 = 0", "(x - 3)(x - 1) = 0");
  assert.equal(result.verdict, "invalid");
  assert.ok(result.confidence > 0.9);
});

test("accepts the correct factorization", () => {
  const result = verifyMathStep("x^2 + x - 2 = 0", "(x + 2)(x - 1) = 0");
  assert.equal(result.verdict, "valid");
});

test("accepts equations that differ by a non-zero scalar", () => {
  const result = verifyMathStep("2x + 4 = 0", "x + 2 = 0");
  assert.equal(result.verdict, "valid");
});

test("checks proposed roots against the preceding polynomial", () => {
  assert.equal(verifyMathStep("x^2 + x - 2 = 0", "x = 1 or x = -2").verdict, "valid");
  assert.equal(verifyMathStep("x^2 + x - 2 = 0", "x = 3 or x = 1").verdict, "invalid");
});

test("expresses uncertainty for unsupported notation", () => {
  const result = verifyMathStep("sin(x) = 0", "x = pi");
  assert.equal(result.verdict, "unknown");
  assert.equal(result.confidence, 0);
});

test("checks standalone numeric equations before a correction is written", () => {
  assert.equal(verifyArithmeticEquation("1 + 2 = 4").verdict, "invalid");
  assert.equal(verifyArithmeticEquation("1 + 2 = 3").verdict, "valid");
  assert.equal(verifyArithmeticEquation("x + 1 = 2").verdict, "unknown");
});

test("evaluates bounded polynomial integrals before writing the result", () => {
  assert.equal(verifyArithmeticEquation("∫_0^2(x^2+x-2)dx=2/3").verdict, "valid");
  assert.equal(verifyArithmeticEquation("∫_0^2(x^2+x-2)dx=0").verdict, "invalid");
  assert.equal(verifyArithmeticEquation("∫(x^2+x-2)dx=x^3/3+x^2/2-2x+C").verdict, "unknown");
});

