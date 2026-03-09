// ============================================================
// Sample 3: Minimal test fixture with known properties
// Used directly in unit tests.
// ============================================================

export const SAMPLE_3_NAME = 'Minimal Test Fixture';

/** Simple three-equation logic with one intermediate and two outputs. */
export const SAMPLE_3 = `TRIP = SV01 + 87T + LOCKOUT
SV01 = 50P1T * !52A + 51PT
ALARM = !DC_OK + FAIL
`;

/** Logic that contains a direct cycle: A = B, B = A */
export const CYCLE_FIXTURE = `A = B + C
B = A * D
C = E
`;

/** Logic with duplicate target */
export const DUPLICATE_FIXTURE = `TRIP = 87T + 50P
TRIP = 51P + LOCK
ALARM = !DC_OK
`;

/** Logic with no equations — empty input */
export const EMPTY_FIXTURE = `; Just a comment
; Another comment
`;

/** Logic with parenthesis grouping to test precedence */
export const PRECEDENCE_FIXTURE = `OUT = A * (B + C)
IN = (X + Y) * Z + W
`;
