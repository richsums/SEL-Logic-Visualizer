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
  /** The assignment target (left-hand side). */
  target: string;
  /** The parsed expression (right-hand side). */
  expr: ExprNode;
  /** Where in the source this equation lives. */
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
// Diagnostics (parse errors, semantic warnings, etc.)
// ------------------------------------------------------------------

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

/** A diagnostic code that callers can match on. */
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
  /** Source location if available. */
  loc?: SourceLocation;
  /** Extra context, e.g. the cycle path. */
  detail?: string;
}

// ------------------------------------------------------------------
// Symbol table
// ------------------------------------------------------------------

/** A single entry in the symbol table. */
export interface SymbolEntry {
  /** Symbol name as it appears in source. */
  name: string;
  /**
   * The equation that defines this symbol (assigns it).
   * Null when the symbol is referenced but never defined (external input).
   */
  definedBy: Equation | null;
  /**
   * All equations whose RHS reference this symbol.
   */
  referencedBy: Equation[];
  /** True when this symbol is referenced but never defined in the document. */
  isExternalInput: boolean;
  /**
   * True when this symbol is defined but never used by any other equation's
   * right-hand side.  These are candidate "outputs" of the logic sheet.
   */
  isUnreferenced: boolean;
}

// ------------------------------------------------------------------
// Semantic analysis result
// ------------------------------------------------------------------

export interface AnalysisResult {
  /** Map from symbol name → entry. */
  symbols: Map<string, SymbolEntry>;
  /** Symbol names referenced but never defined. */
  undefinedReferences: string[];
  /** Symbol names defined but never referenced. */
  unusedVariables: string[];
  /** Each inner array is one detected cycle, expressed as a list of names. */
  cycles: string[][];
  /** All diagnostics produced during analysis. */
  diagnostics: Diagnostic[];
}

// ------------------------------------------------------------------
// Gate-level intermediate representation (IR)
// ------------------------------------------------------------------

/** The logical function implemented by a gate node. */
export type GateType = 'AND' | 'OR' | 'NOT' | 'SIGNAL';

/**
 * A node in the gate-level IR graph.
 *
 * Signal nodes represent named wires (either external inputs or defined
 * variables).  Gate nodes represent logical operations.
 *
 * Edges are encoded as `inputs`: each entry is the ID of another GateIRNode
 * that feeds data INTO this node.
 */
export interface GateIRNode {
  id: string;
  gateType: GateType;
  /** Human-readable label (variable name or gate type). */
  label: string;
  /** If this node represents a named symbol, this is that name. */
  symbolName?: string;
  /** Provenance back to source. */
  loc?: SourceLocation;
  /** IDs of upstream nodes that are inputs to this node. */
  inputs: string[];
}

/** The complete gate-level IR graph. */
export interface GateGraph {
  /** All nodes keyed by their unique ID. */
  nodes: Map<string, GateIRNode>;
  /**
   * Signal node IDs that are external inputs (no driver equation).
   * Useful for layout seeding.
   */
  inputSignalIds: string[];
  /**
   * Signal node IDs that are unreferenced outputs.
   */
  outputSignalIds: string[];
}

// ------------------------------------------------------------------
// Symbol dependency graph (symbol-level, used for analysis)
// ------------------------------------------------------------------

export interface DepGraphNode {
  name: string;
  /** Symbol names that this symbol depends on (its RHS references). */
  dependsOn: string[];
  /** Symbol names that depend on this symbol. */
  dependedOnBy: string[];
}

export interface DependencyGraph {
  nodes: Map<string, DepGraphNode>;
}

// ------------------------------------------------------------------
// Analysis engine output (per selected node)
// ------------------------------------------------------------------

export interface NodeDetail {
  symbolName: string;
  nodeType: GateType;
  /** Human-readable equation text, if this is a defined signal. */
  equationText?: string;
  loc?: SourceLocation;
}

export interface UpstreamTrace {
  /** IDs of all gate graph nodes reachable upstream from the selected node. */
  nodeIds: Set<string>;
  /** IDs of all edges that are part of the upstream subgraph. */
  edgeIds: Set<string>;
}

export interface EnglishExplanation {
  /** The symbol being explained. */
  target: string;
  /** Human-readable English description. */
  text: string;
}
