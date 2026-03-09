// ============================================================
// Core domain models for the SEL Logic Visualizer
// Every entity preserves provenance back to source line/text.
// ============================================================

// ------------------------------------------------------------------
// Source provenance
// ------------------------------------------------------------------

/** Location in the original source file. Line is 1-indexed. */
export interface SourceLocation {
  line: number;
  rawSource: string;
}

/** The raw source document loaded from the user. */
export interface SourceDocument {
  rawText: string;
  lines: string[];
}

// ------------------------------------------------------------------
// Expression AST
// ------------------------------------------------------------------

export type ExprNode =
  | IdentifierExpr
  | NotExpr
  | AndExpr
  | OrExpr;

export interface IdentifierExpr {
  tag: 'identifier';
  name: string;
  loc?: SourceLocation;
}

export interface NotExpr {
  tag: 'not';
  operand: ExprNode;
  loc?: SourceLocation;
}

export interface AndExpr {
  tag: 'and';
  left: ExprNode;
  right: ExprNode;
  loc?: SourceLocation;
}

export interface OrExpr {
  tag: 'or';
  left: ExprNode;
  right: ExprNode;
  loc?: SourceLocation;
}

// ------------------------------------------------------------------
// Parsed equation: LHS = RHS
// ------------------------------------------------------------------

export interface Equation {
  target: string;
  expr: ExprNode;
  loc: SourceLocation;
}

// ------------------------------------------------------------------
// Parser output
// ------------------------------------------------------------------

export interface ParseResult {
  equations: Equation[];
  diagnostics: Diagnostic[];
}

// ------------------------------------------------------------------
// Diagnostics
// ------------------------------------------------------------------

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export type DiagnosticCode =
  | 'PARSE_ERROR'
  | 'DUPLICATE_TARGET'
  | 'UNDEFINED_REF'
  | 'UNUSED_VAR'
  | 'CYCLE_DETECTED';

export interface Diagnostic {
  severity: DiagnosticSeverity;
  code: DiagnosticCode;
  message: string;
  loc?: SourceLocation;
  detail?: string;
}

// ------------------------------------------------------------------
// Symbol table
// ------------------------------------------------------------------

export interface SymbolEntry {
  name: string;
  definedBy: Equation | null;
  referencedBy: Equation[];
  isExternalInput: boolean;
  isUnreferenced: boolean;
}

// ------------------------------------------------------------------
// Semantic analysis result
// ------------------------------------------------------------------

export interface AnalysisResult {
  symbols: Map<string, SymbolEntry>;
  undefinedReferences: string[];
  unusedVariables: string[];
  cycles: string[][];
  diagnostics: Diagnostic[];
}

// ------------------------------------------------------------------
// Gate-level IR
// ------------------------------------------------------------------

export type GateType = 'AND' | 'OR' | 'NOT' | 'SIGNAL';

export interface GateIRNode {
  id: string;
  gateType: GateType;
  label: string;
  symbolName?: string;
  loc?: SourceLocation;
  inputs: string[];
}

export interface GateGraph {
  nodes: Map<string, GateIRNode>;
  inputSignalIds: string[];
  outputSignalIds: string[];
}

// ------------------------------------------------------------------
// Symbol dependency graph
// ------------------------------------------------------------------

export interface DepGraphNode {
  name: string;
  dependsOn: string[];
  dependedOnBy: string[];
}

export interface DependencyGraph {
  nodes: Map<string, DepGraphNode>;
}

// ------------------------------------------------------------------
// Boolean circuit simulation
// ------------------------------------------------------------------

export interface SimulationState {
  enabled: boolean;
  /** User-controlled values: external inputs and optional overrides. */
  inputValues: Map<string, boolean>;
}

export interface SimulationResult {
  /**
   * Computed truth value for every signal.
   * null = the signal is in a cycle (undefined).
   */
  values: Map<string, boolean | null>;
}

// ------------------------------------------------------------------
// Asserting paths & blocking conditions
// ------------------------------------------------------------------

/**
 * A minimal conjunction of signal values that asserts an output.
 * Each path corresponds to one route through the OR tree of an equation.
 */
export interface PathCondition {
  /** Signals that MUST be true. */
  asserted: string[];
  /** Signals that MUST be false (blocking conditions). */
  negated: string[];
}

export interface AssertingPath {
  index: number;
  conditions: PathCondition;
  /** Set when simulation result is available. */
  isActive?: boolean;
}

export interface BlockingCondition {
  /** The signal whose assertion blocks a path. */
  signal: string;
  pathIndices: number[];
}

// ------------------------------------------------------------------
// Node tags (protection-function classification)
// ------------------------------------------------------------------

export type ProtectionTag =
  | 'trip'
  | 'block'
  | 'supervise'
  | 'alarm'
  | 'reclose'
  | 'other';

export const PROTECTION_TAG_META: Record<
  ProtectionTag,
  { label: string; bg: string; text: string; border: string }
> = {
  trip:      { label: 'TRIP',    bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' },
  block:     { label: 'BLOCK',   bg: '#fffbeb', text: '#d97706', border: '#fcd34d' },
  supervise: { label: 'SUPV',    bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  alarm:     { label: 'ALARM',   bg: '#faf5ff', text: '#7c3aed', border: '#c4b5fd' },
  reclose:   { label: 'RCLOSE',  bg: '#f0fdf4', text: '#16a34a', border: '#86efac' },
  other:     { label: 'OTHER',   bg: '#f8fafc', text: '#64748b', border: '#cbd5e1' },
};

/** Map from symbol name → assigned protection tags. */
export type NodeTags = Map<string, ProtectionTag[]>;

// ------------------------------------------------------------------
// Revision comparison (diff)
// ------------------------------------------------------------------

export type DiffStatus = 'added' | 'removed' | 'modified' | 'unchanged';

export interface EquationDiff {
  target: string;
  status: DiffStatus;
  before?: Equation;
  after?: Equation;
  detail?: string;
}

export interface RevisionDiff {
  equations: EquationDiff[];
  addedSymbols: string[];
  removedSymbols: string[];
  modifiedSymbols: string[];
  unchangedSymbols: string[];
}

// ------------------------------------------------------------------
// Application mode
// ------------------------------------------------------------------

export type AppMode = 'visualize' | 'simulate' | 'compare';
