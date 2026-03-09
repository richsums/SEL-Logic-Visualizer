// ============================================================
// Unit tests: revision diff engine
// ============================================================

import { describe, it, expect } from 'vitest';
import { parseSource } from '../parser/parser';
import { diffRevisions, exprToCanonical } from '../analysis/diffEngine';

function eqs(src: string) {
  return parseSource(src).equations;
}

// ------------------------------------------------------------------
// Expression serialiser
// ------------------------------------------------------------------

describe('exprToCanonical', () => {
  it('serialises identifier', () => {
    const expr = parseSource('X = A\n').equations[0].expr;
    expect(exprToCanonical(expr)).toBe('A');
  });

  it('serialises NOT', () => {
    const expr = parseSource('X = !A\n').equations[0].expr;
    expect(exprToCanonical(expr)).toBe('!A');
  });

  it('serialises AND', () => {
    const expr = parseSource('X = A * B\n').equations[0].expr;
    expect(exprToCanonical(expr)).toBe('(A*B)');
  });

  it('serialises OR', () => {
    const expr = parseSource('X = A + B\n').equations[0].expr;
    expect(exprToCanonical(expr)).toBe('(A+B)');
  });

  it('serialises nested expression consistently', () => {
    const e1 = parseSource('X = A * B + C\n').equations[0].expr;
    const e2 = parseSource('X = A * B + C\n').equations[0].expr;
    expect(exprToCanonical(e1)).toBe(exprToCanonical(e2));
  });
});

// ------------------------------------------------------------------
// Diff: added
// ------------------------------------------------------------------

describe('diffRevisions — added', () => {
  it('marks new equations as added', () => {
    const a = eqs('TRIP = 87T\n');
    const b = eqs('TRIP = 87T\nALARM = DC_OK\n');
    const diff = diffRevisions(a, b);
    const added = diff.equations.find(d => d.target === 'ALARM');
    expect(added?.status).toBe('added');
    expect(diff.addedSymbols).toContain('ALARM');
  });
});

// ------------------------------------------------------------------
// Diff: removed
// ------------------------------------------------------------------

describe('diffRevisions — removed', () => {
  it('marks removed equations', () => {
    const a = eqs('TRIP = 87T\nALARM = DC_OK\n');
    const b = eqs('TRIP = 87T\n');
    const diff = diffRevisions(a, b);
    const removed = diff.equations.find(d => d.target === 'ALARM');
    expect(removed?.status).toBe('removed');
    expect(diff.removedSymbols).toContain('ALARM');
  });
});

// ------------------------------------------------------------------
// Diff: modified
// ------------------------------------------------------------------

describe('diffRevisions — modified', () => {
  it('marks changed expressions as modified', () => {
    const a = eqs('TRIP = 87T\n');
    const b = eqs('TRIP = 87T + 50P\n');
    const diff = diffRevisions(a, b);
    const mod = diff.equations.find(d => d.target === 'TRIP');
    expect(mod?.status).toBe('modified');
    expect(diff.modifiedSymbols).toContain('TRIP');
    expect(mod?.detail).toContain('Was:');
    expect(mod?.detail).toContain('Now:');
  });
});

// ------------------------------------------------------------------
// Diff: unchanged
// ------------------------------------------------------------------

describe('diffRevisions — unchanged', () => {
  it('marks identical equations as unchanged', () => {
    const a = eqs('TRIP = 87T\n');
    const b = eqs('TRIP = 87T\n');
    const diff = diffRevisions(a, b);
    const unchanged = diff.equations.find(d => d.target === 'TRIP');
    expect(unchanged?.status).toBe('unchanged');
    expect(diff.unchangedSymbols).toContain('TRIP');
  });

  it('recognises same logic regardless of whitespace differences', () => {
    // Parser normalises whitespace — canonical form should match
    const a = eqs('TRIP=87T+50P\n');
    const b = eqs('TRIP = 87T + 50P\n');
    const diff = diffRevisions(a, b);
    const d = diff.equations.find(eq => eq.target === 'TRIP');
    expect(d?.status).toBe('unchanged');
  });
});

// ------------------------------------------------------------------
// Diff: mixed scenario
// ------------------------------------------------------------------

describe('diffRevisions — mixed scenario', () => {
  it('correctly classifies all four statuses in one call', () => {
    const revA = `TRIP = 87T\nSV01 = 50P1T * !52A\nALARM = DC_OK\n`;
    const revB = `TRIP = 87T + 50H\nSV01 = 50P1T * !52A\nBLK_79 = LOCKOUT\n`;
    //           TRIP → modified, SV01 → unchanged, ALARM → removed, BLK_79 → added

    const diff = diffRevisions(eqs(revA), eqs(revB));

    expect(diff.equations.find(d => d.target === 'TRIP')?.status).toBe('modified');
    expect(diff.equations.find(d => d.target === 'SV01')?.status).toBe('unchanged');
    expect(diff.equations.find(d => d.target === 'ALARM')?.status).toBe('removed');
    expect(diff.equations.find(d => d.target === 'BLK_79')?.status).toBe('added');
  });
});
