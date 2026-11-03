const EPSILON = 1e-9;

function clean(input) {
  return input
    .toLowerCase()
    .replaceAll("−", "-")
    .replaceAll("×", "*")
    .replaceAll("·", "*")
    .replaceAll("²", "^2")
    .replaceAll("³", "^3")
    .replace(/\s+/g, "")
    .replace(/(\d|x|\))(?=x|\()/g, "$1*")
    .replace(/x(?=\d)/g, "x*");
}

function add(a, b, factor = 1) {
  const result = Array.from({ length: Math.max(a.length, b.length) }, () => 0);
  for (let i = 0; i < result.length; i += 1) {
    result[i] = (a[i] ?? 0) + factor * (b[i] ?? 0);
  }
  while (result.length > 1 && Math.abs(result.at(-1)) < EPSILON) result.pop();
  return result;
}

function multiply(a, b) {
  const result = Array.from({ length: a.length + b.length - 1 }, () => 0);
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) result[i + j] += a[i] * b[j];
  }
  return add(result, []);
}

function power(poly, exponent) {
  if (!Number.isInteger(exponent) || exponent < 0 || exponent > 8) {
    throw new Error("Only small non-negative integer powers are supported");
  }
  let result = [1];
  for (let i = 0; i < exponent; i += 1) result = multiply(result, poly);
  return result;
}

function tokenize(expression) {
  const source = clean(expression);
  const tokens = source.match(/\d+(?:\.\d+)?|x|[()+\-*/^]/g) ?? [];
  if (tokens.join("") !== source) throw new Error("Unsupported mathematical notation");
  return tokens;
}

function parsePolynomial(expression) {
  const tokens = tokenize(expression);
  let index = 0;

  const parsePrimary = () => {
    const token = tokens[index];
    if (token === "-") {
      index += 1;
      return multiply([-1], parsePrimary());
    }
    if (token === "+") {
      index += 1;
      return parsePrimary();
    }
    if (token === "(") {
      index += 1;
      const value = parseSum();
      if (tokens[index] !== ")") throw new Error("Unbalanced parentheses");
      index += 1;
      return value;
    }
    if (token === "x") {
      index += 1;
      return [0, 1];
    }
    if (token && /^\d/.test(token)) {
      index += 1;
      return [Number(token)];
    }
    throw new Error("Expected a number, x, or parentheses");
  };

  const parseExponent = () => {
    let value = parsePrimary();
    if (tokens[index] === "^") {
      index += 1;
      const exponentToken = tokens[index];
      if (!exponentToken || !/^\d+$/.test(exponentToken)) {
        throw new Error("Exponent must be an integer");
      }
      index += 1;
      value = power(value, Number(exponentToken));
    }
    return value;
  };

  const parseProduct = () => {
    let value = parseExponent();
    while (tokens[index] === "*" || tokens[index] === "/") {
      const operator = tokens[index++];
      const right = parseExponent();
      if (operator === "/") {
        if (right.length !== 1 || Math.abs(right[0]) < EPSILON) {
          throw new Error("Division is only supported by non-zero constants");
        }
        value = multiply(value, [1 / right[0]]);
      } else value = multiply(value, right);
    }
    return value;
  };

  const parseSum = () => {
    let value = parseProduct();
    while (tokens[index] === "+" || tokens[index] === "-") {
      const operator = tokens[index++];
      value = add(value, parseProduct(), operator === "+" ? 1 : -1);
    }
    return value;
  };

  const result = parseSum();
  if (index !== tokens.length) throw new Error(`Unexpected token ${tokens[index]}`);
  return result;
}

function equationPolynomial(input) {
  const parts = clean(input).split("=");
  if (parts.length === 1) return parsePolynomial(parts[0]);
  if (parts.length !== 2) throw new Error("Expected at most one equals sign");
  return add(parsePolynomial(parts[0]), parsePolynomial(parts[1]), -1);
}

function proportional(a, b) {
  const length = Math.max(a.length, b.length);
  const aa = Array.from({ length }, (_, index) => a[index] ?? 0);
  const bb = Array.from({ length }, (_, index) => b[index] ?? 0);
  const pivot = bb.findIndex((value) => Math.abs(value) > EPSILON);
  if (pivot === -1) return aa.every((value) => Math.abs(value) < EPSILON);
  const ratio = aa[pivot] / bb[pivot];
  if (Math.abs(ratio) < EPSILON) return false;
  return aa.every((value, index) => Math.abs(value - ratio * bb[index]) < EPSILON);
}

function evaluate(poly, x) {
  return poly.reduceRight((sum, coefficient) => sum * x + coefficient, 0);
}

function parseSolutions(input) {
  const matches = [...clean(input).matchAll(/x=([-+]?\d+(?:\.\d+)?)/g)];
  return matches.map((match) => Number(match[1]));
}

export function verifyMathStep(from, to) {
  try {
    const fromPoly = equationPolynomial(from);
    const solutions = parseSolutions(to);
    if (solutions.length > 0) {
      const invalid = solutions.filter((value) => Math.abs(evaluate(fromPoly, value)) > 1e-7);
      return invalid.length === 0
        ? {
            verdict: "valid",
            confidence: 0.98,
            reason: "Every stated value satisfies the preceding equation.",
          }
        : {
            verdict: "invalid",
            confidence: 0.99,
            reason: `${invalid.map((value) => `x=${value}`).join(", ")} does not satisfy the preceding equation.`,
          };
    }

    const toPoly = equationPolynomial(to);
    const valid = proportional(fromPoly, toPoly);
    return {
      verdict: valid ? "valid" : "invalid",
      confidence: valid ? 0.99 : 0.97,
      reason: valid
        ? "Both equations reduce to proportional polynomial forms."
        : "The two equations reduce to different polynomial forms.",
      normalized: { from: fromPoly, to: toPoly },
    };
  } catch (error) {
    return {
      verdict: "unknown",
      confidence: 0,
      reason: error instanceof Error ? error.message : "Unsupported notation",
    };
  }
}

export function verifyArithmeticEquation(input) {
  try {
    if (input.trim().startsWith("∫")) {
      const normalized = input.toLowerCase().replaceAll("−", "-").replaceAll("²", "^2").replaceAll("³", "^3").replace(/\s+/g, "");
      const integral = /^∫_([+-]?\d+(?:\.\d+)?)\^([+-]?\d+(?:\.\d+)?)\((.+)\)dx=(.+)$/.exec(normalized);
      if (!integral) throw new Error("Unsupported definite-integral notation");
      const lower = Number(integral[1]);
      const upper = Number(integral[2]);
      const integrand = parsePolynomial(integral[3]);
      const right = parsePolynomial(integral[4]);
      if (right.length !== 1) throw new Error("Expected a numeric result for the definite integral");
      const value = integrand.reduce(
        (sum, coefficient, exponent) => sum + coefficient * (upper ** (exponent + 1) - lower ** (exponent + 1)) / (exponent + 1),
        0,
      );
      const valid = Math.abs(value - right[0]) < EPSILON;
      return {
        verdict: valid ? "valid" : "invalid",
        confidence: 0.99,
        reason: valid ? "The definite integral equals the stated result." : `The definite integral is ${value}, not ${right[0]}.`,
        values: { left: value, right: right[0] },
      };
    }
    const parts = clean(input).split("=");
    if (parts.length !== 2) throw new Error("Expected one equals sign");
    const left = parsePolynomial(parts[0]);
    const right = parsePolynomial(parts[1]);
    if (left.length !== 1 || right.length !== 1) {
      return { verdict: "unknown", confidence: 0, reason: "The equation contains variables." };
    }
    const valid = Math.abs(left[0] - right[0]) < EPSILON;
    return {
      verdict: valid ? "valid" : "invalid",
      confidence: 0.99,
      reason: valid ? "Both sides have the same value." : `The left side is ${left[0]}, but the right side is ${right[0]}.`,
      values: { left: left[0], right: right[0] },
    };
  } catch (error) {
    return { verdict: "unknown", confidence: 0, reason: error instanceof Error ? error.message : "Unsupported notation" };
  }
}

