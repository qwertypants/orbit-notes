# Final fix report: staff panel visibility

## Change

Updated the staff visibility handler so the enclosing `.staff-panel` and `#note-staff` host are hidden and shown together. The staff toggle remains in `.controls`, keeps its existing `Show staff` / `Hide staff` label and `aria-pressed` state, and does not affect the always-visible note circle or shared explorer state.

Added a dependency-free Vitest unit test for hidden and visible states.

## Files

- `src/main.ts`
- `src/visualization/staff-visibility.ts`
- `src/visualization/staff-visibility.test.ts`

## Checks

- `npm test -- src/visualization/staff-visibility.test.ts` — passed (1 test)
- `npm run check` — passed (`tsc --noEmit`)
