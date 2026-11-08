import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

test("the app Zod version supports Better Auth session schemas", () => {
  assert.equal(typeof z.object({}).loose, "function");
});
