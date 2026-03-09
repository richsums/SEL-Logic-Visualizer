# SEL Logic Visualizer

A browser-based tool that accepts raw SEL-style relay logic equations and
renders them as an interactive, left-to-right gate-level diagram for
engineering analysis.

---

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Supported Syntax

Each line contains one assignment statement:

```
TARGET = expression
```

| Operator | Meaning | Precedence |
|----------|---------|------------|
| `!`      | NOT     | Highest    |
| `*`      | AND     |            |
| `+`      | OR      | Lowest     |
| `(  )`   | Grouping — overrides precedence | |
| `;` `//` `--` | Line comments | |

SEL element names may start with digits (`50P1T`, `87T`, `52A` are valid identifiers).

### Example

```
; Overcurrent + Differential Protection
TRIP    = SV01 + 87T + LOCKOUT
SV01    = 50P1T * !52A + 51PT
ALARM   = !DC_OK + TRIP_FAIL
LOCKOUT = 87T + 50H1
```

---

## Architecture

```
src/
├── domain/
│   └── models.ts              # All TypeScript types / interfaces
│
├── parser/
│   ├── tokenizer.ts           # Lexer → Token[]
│   ├── parser.ts              # Recursive-descent parser → Equation[] + Diagnostics
│   └── index.ts               # Public re-exports
│
├── analysis/
│   ├── semanticAnalyzer.ts    # Symbol table, undefined refs, unused vars
│   ├── cycleDetector.ts       # Dependency graph + cycle detection (iterative DFS)
│   ├── graphBuilder.ts        # Equation[] → GateGraph IR
│   ├── explanationGenerator.ts # GateGraph + symbols → English explanation
│   └── index.ts               # runAnalysis() convenience pipeline
│
├── visualization/
│   ├── layoutEngine.ts        # GateGraph → x/y positions (longest-path rank)
│   ├── flowBuilder.ts         # GateGraph + layout → React Flow nodes/edges
│   └── index.ts
│
├── components/
│   ├── App.tsx                # Three-panel root component + pipeline orchestration
│   ├── InputPane/
│   │   └── InputPane.tsx      # Source text editor with file upload + line numbers
│   ├── DiagramPane/
│   │   ├── DiagramPane.tsx    # React Flow canvas wrapper
│   │   └── nodeTypes/
│   │       ├── SignalNode.tsx  # Custom node: named signal / variable
│   │       └── GateNode.tsx   # Custom node: AND / OR / NOT gate
│   └── DiagnosticsPane/
│       └── DiagnosticsPane.tsx # Errors, symbol summary, node detail, explanation
│
├── fixtures/
│   ├── sample1.ts             # Overcurrent + differential protection
│   ├── sample2.ts             # Distance protection with supervision
│   └── sample3.ts             # Minimal test fixtures (incl. cycle/duplicate/empty)
│
└── __tests__/
    ├── parser.test.ts
    ├── semanticAnalyzer.test.ts
    ├── cycleDetector.test.ts
    └── graphBuilder.test.ts
```

### Key Design Principles

1. **Separation of concerns** — the parser knows nothing about React Flow;
   the visualization layer knows nothing about SEL syntax.

2. **Domain IR as source of truth** — `GateGraph` (in `domain/models.ts`) is the
   intermediate representation that all consumers (layout, React Flow, explanation
   generator) read from.

3. **Full provenance** — every `Equation`, `SymbolEntry`, and `GateIRNode` carries
   a `SourceLocation` with the original line number and raw source text.

4. **Future-proof module boundaries** — the following features can be added without
   touching existing modules:
   - Signal tracing / highlighting (extend `traceUpstream` in `graphBuilder.ts`)
   - Logic state simulation (add `simulationEngine.ts` in `analysis/`)
   - Revision comparison (diff two `GateGraph` objects in `analysis/`)
   - SVG/PNG export (add `exportService.ts` in `visualization/`)
   - Node tagging (extend `GateIRNode` with a `tags` field)

---

## Analysis Pipeline

```
source text
    │
    ▼
parseSource()          → ParseResult { equations[], diagnostics[] }
    │
    ▼
analyzeSemantics()     → symbols Map, undefinedRefs[], unusedVars[]
buildDependencyGraph() → DependencyGraph
detectCycles()         → cycles[][]
    │
    ▼
buildGateGraph()       → GateGraph (gate-level IR)
    │
    ▼
computeLayout()        → Map<nodeId, {x,y}>
buildFlowGraph()       → React Flow Node[] + Edge[]
    │
    ▼
ReactFlow renderer
```

---

## UI Features

| Feature | How to use |
|---------|------------|
| Paste logic | Type or paste in the left panel |
| Upload file | Click **↑ Upload .txt** in the left panel |
| Zoom / pan | Mouse wheel and drag on the diagram |
| Highlight upstream | Click any node — all upstream paths turn orange |
| Clear highlight | Click empty canvas area |
| Node detail | Click a node — details appear in the right panel |
| Logic explanation | Click a defined signal — English explanation appears |
| Diagnostics | Right panel always shows errors / warnings / info |

### Node colour coding

| Colour | Meaning |
|--------|---------|
| Green  | External input (referenced but not defined in document) |
| Blue   | Intermediate signal (defined and referenced by another equation) |
| Orange | Output (defined but not referenced by any other equation) |
| Yellow | AND gate |
| Pink   | OR gate |
| Purple | NOT gate |

---

## Running Tests

```bash
npm test                # run all tests once
npm run test:watch      # re-run on file changes
```

Tests cover:
- Tokenizer (all token types, comment stripping, line tracking)
- Parser (AST shape, operator precedence, error recovery)
- Semantic analyzer (undefined refs, unused vars, duplicate targets)
- Cycle detector (direct cycles, indirect cycles, acyclic graphs)
- Gate graph builder (node creation, edge wiring, upstream tracing)

---

## Technology Stack

| Library | Purpose |
|---------|---------|
| [React 18](https://react.dev) | UI framework |
| [TypeScript 5](https://www.typescriptlang.org) | Type safety |
| [Vite 6](https://vite.dev) | Build tool + dev server |
| [@xyflow/react](https://reactflow.dev) | Interactive graph renderer |
| [Vitest](https://vitest.dev) | Unit test runner |

---

## Contributing

1. Fork and clone
2. `npm install`
3. Create a feature branch
4. Write tests for new logic in `src/__tests__/`
5. `npm test` must pass
6. Open a PR with a description of the change
