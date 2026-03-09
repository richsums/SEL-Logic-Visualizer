// ============================================================
// Sample 2: Distance protection with supervision
// ============================================================

export const SAMPLE_2_NAME = 'Distance Protection with Supervision';

export const SAMPLE_2 = `; ============================================================
; SEL-421 Line Distance Protection — Sample Logic
; ============================================================

; ── Zone 1 Trip ────────────────────────────────────────────
; Instantaneous trip on Zone 1 reach
Z1TRIP = 21Z1G + 21Z1PH

; ── Zone 2 Trip (supervised, time-delayed) ─────────────────
Z2TRIP = Z2PU * !BLOCK_Z2

; Zone 2 pickup — phase or ground distance
Z2PU = 21Z2G + 21Z2PH

; ── Zone 3 Trip ────────────────────────────────────────────
Z3TRIP = 21Z3PH * !BLOCK_Z3

; ── Overall Trip ───────────────────────────────────────────
TRIP = Z1TRIP + Z2TRIP + Z3TRIP + 50P1T * !52A

; ── Directional Supervision ────────────────────────────────
; Block Zone 2 if direction is reverse or load encroachment
BLOCK_Z2 = !32F + LOAD_ENC

; Block Zone 3 if load encroachment is active
BLOCK_Z3 = LOAD_ENC

; ── Load Encroachment ──────────────────────────────────────
LOAD_ENC = !MHOA * !MHOB

; ── Alarm ──────────────────────────────────────────────────
ALARM = !DC_OK + CT_SAT + VT_FAIL
`;
