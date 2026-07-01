import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTagStatAlias } from "./tagAliases";

test("normalizeTagStatAlias folds draw aliases into one display bucket", () => {
  assert.equal(normalizeTagStatAlias("draw"), "Draw");
  assert.equal(normalizeTagStatAlias("card_draw"), "Draw");
  assert.equal(normalizeTagStatAlias("direct-draw"), "Draw");
  assert.equal(normalizeTagStatAlias("repeatable_advantage"), "Repeatable Draw");
});
