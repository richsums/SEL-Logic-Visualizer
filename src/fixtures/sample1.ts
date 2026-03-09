// ============================================================
// Sample 1: Typical overcurrent + differential protection
// ============================================================

export const SAMPLE_1_NAME = 'Overcurrent + Differential Protection';

export const SAMPLE_1 = `; ============================================================
; SEL-387 Transformer Differential Protection — Sample Logic
; ============================================================

; ── Trip Output ────────────────────────────────────────────
TRIP = SV01 + 87T + LOCKOUT

; ── Supervision / Time-Delayed Overcurrent ─────────────────
; SV01 asserts when phase overcurrent picks up AND breaker
; is closed, OR when time-overcurrent phase element trips.
SV01 = 50P1T * !52A + 51PT

; ── Alarm ──────────────────────────────────────────────────
ALARM = !DC_OK + TRIP_FAIL + COMM_FAIL

; ── Lockout Latch ──────────────────────────────────────────
; Latched by differential or high-set overcurrent
LOCKOUT = 87T + 50H1

; ── Reclose Block ──────────────────────────────────────────
BLK_79 = LOCKOUT + !52A * 27PT
`;
