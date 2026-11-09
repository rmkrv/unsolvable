import test from "node:test";
import assert from "node:assert/strict";
import { requireAdmin, requireParent, requireRole, requireStudent } from "../lib/server/auth/role-policy.ts";
import { RoleForbidden } from "../lib/server/auth/authorization-errors.ts";

function viewer(role) {
  return {
    authSubject: `${role}-subject`,
    appUserId: `${role}-id`,
    role,
    roleConfirmedAt: Date.now(),
    email: `${role}@example.test`,
    displayName: role,
    fullName: role,
  };
}

test("role policies enforce the customer and admin route matrix", () => {
  assert.equal(requireStudent(viewer("student")).role, "student");
  assert.equal(requireParent(viewer("parent")).role, "parent");
  assert.equal(requireAdmin(viewer("admin")).role, "admin");
  assert.equal(requireRole(viewer("parent"), "student", "parent").role, "parent");

  assert.throws(() => requireStudent(viewer("parent")), RoleForbidden);
  assert.throws(() => requireStudent(viewer("admin")), RoleForbidden);
  assert.throws(() => requireParent(viewer("student")), RoleForbidden);
  assert.throws(() => requireAdmin(viewer("student")), RoleForbidden);
  assert.throws(() => requireAdmin(viewer("parent")), RoleForbidden);
});
