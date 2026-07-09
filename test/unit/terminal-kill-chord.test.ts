import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DOUBLE_ESCAPE_WINDOW_MS,
  isDoubleEscape,
  isEscape
} from "../../src/shared/terminalKillChord";

const ESC = String.fromCharCode(27);

void test("isEscape matches only a bare Escape byte, not escape sequences", () => {
  assert.equal(isEscape(ESC), true);
  assert.equal(isEscape(`${ESC}[A`), false); // up arrow
  assert.equal(isEscape("a"), false);
  assert.equal(isEscape(""), false);
});

void test("a first Escape never triggers the kill chord", () => {
  assert.equal(isDoubleEscape(ESC, 1000, 0), false);
});

void test("a second Escape within the window triggers the chord", () => {
  const firstAt = 1000;
  assert.equal(isDoubleEscape(ESC, firstAt + 200, firstAt), true);
  assert.equal(isDoubleEscape(ESC, firstAt + DOUBLE_ESCAPE_WINDOW_MS, firstAt), true);
});

void test("a second Escape after the window does not trigger the chord", () => {
  const firstAt = 1000;
  assert.equal(
    isDoubleEscape(ESC, firstAt + DOUBLE_ESCAPE_WINDOW_MS + 1, firstAt),
    false
  );
});

void test("non-Escape input never triggers the chord even inside the window", () => {
  const firstAt = 1000;
  assert.equal(isDoubleEscape("a", firstAt + 100, firstAt), false);
  assert.equal(isDoubleEscape(`${ESC}[A`, firstAt + 100, firstAt), false);
});
