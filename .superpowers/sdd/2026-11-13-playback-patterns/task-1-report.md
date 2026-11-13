# Task 1 implementation report

**Status:** DONE

Implemented the exported `PlaybackPattern` type and appended the optional `pattern` argument to `playNotes`, defaulting to `once` so existing calls retain their behavior. Sequential playback now schedules ordered pitch/note events, adds a descending tail without repeating the peak for `bounce`, and schedules each `loop` pass after the preceding pass's final step. Every attack, release, and next pass remains guarded by the playback version and uses `pendingTimers`, so `stopPlayback()` cancels queued work. Together playback is unchanged.

Added focused tests for bounce ordering/timing, loop repetition, and stopping a loop before the next pass.

## Verification

- RED: `npm test -- src/audio/audio-engine.test.ts` initially could not run because dependencies were not installed (`vitest: command not found`). After `npm ci`, the same command showed the expected failures: bounce returned only `[0], [4], [7]`; loop returned only `[0], [4]`.
- GREEN: `npm test -- src/audio/audio-engine.test.ts` — PASS, 19 tests.
- `npm run check` — PASS (`tsc --noEmit`).
- `git diff --check` — PASS.

## Files changed

- `src/audio/audio-engine.ts`
- `src/audio/audio-engine.test.ts`
- `.superpowers/sdd/2026-11-13-playback-patterns/task-1-report.md`

## Self-review

Existing callers remain source-compatible because the new argument is last and optional. Loop starts the next pass at `events.length * sequenceStepMs`, so the first note follows one full step after the prior pass's last event. The same timer/version cancellation path guards those events. No concerns found.
