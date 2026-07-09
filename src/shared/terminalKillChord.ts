// A bare Escape keypress arrives as a single ESC byte (char code 27 / U+001B).
// Escape *sequences* (arrow keys, function keys) arrive as ESC followed by more
// bytes, so an exact match is what distinguishes an Escape press from those.
const ESCAPE = String.fromCharCode(27);

// Two Escape presses within this window count as the kill chord. Wide enough for
// a deliberate double-tap, short enough that two unrelated Escapes are unlikely
// to be mistaken for a kill.
export const DOUBLE_ESCAPE_WINDOW_MS = 500;

export function isEscape(data: string): boolean {
  return data === ESCAPE;
}

// True when `data` is an Escape press that lands within the chord window after a
// previous Escape recorded at `lastEscapeAtMs`. `lastEscapeAtMs` of 0 means no
// prior Escape is pending, so a first Escape never triggers the chord.
export function isDoubleEscape(
  data: string,
  nowMs: number,
  lastEscapeAtMs: number
): boolean {
  return (
    isEscape(data) &&
    lastEscapeAtMs > 0 &&
    nowMs - lastEscapeAtMs <= DOUBLE_ESCAPE_WINDOW_MS
  );
}
