// ============================================================
// InputPane: source text editor with file upload
// ============================================================

import { useRef, useCallback } from 'react';

interface InputPaneProps {
  value:    string;
  onChange: (text: string) => void;
}

export default function InputPane({ value, onChange }: InputPaneProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  // ── File upload ────────────────────────────────────────────

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        onChange(reader.result as string);
      };
      reader.readAsText(file);
      // Reset input so the same file can be re-uploaded
      e.target.value = '';
    },
    [onChange]
  );

  // ── Line numbers (derived from value) ─────────────────────

  const lines = value.split('\n');

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={titleStyle}>Source Logic</span>
        <button
          style={uploadBtnStyle}
          onClick={() => fileRef.current?.click()}
          title="Upload a .txt file"
        >
          ↑ Upload .txt
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.sel,.logic"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {/* Editor area */}
      <div style={editorWrapStyle}>
        {/* Line-number gutter */}
        <div style={gutterStyle} aria-hidden="true">
          {lines.map((_, i) => (
            <div key={i} style={gutterLineStyle}>
              {i + 1}
            </div>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          style={textareaStyle}
          placeholder={PLACEHOLDER}
          aria-label="SEL logic source"
        />
      </div>

      {/* Footer info */}
      <div style={footerStyle}>
        <span>{lines.length} line{lines.length !== 1 ? 's' : ''}</span>
        <span style={{ marginLeft: 'auto', color: '#94a3b8' }}>
          = assign · * AND · + OR · ! NOT
        </span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Styles
// ------------------------------------------------------------------

const containerStyle: React.CSSProperties = {
  display:       'flex',
  flexDirection: 'column',
  height:        '100%',
  background:    '#fff',
  borderRight:   '1px solid #e2e8f0',
};

const headerStyle: React.CSSProperties = {
  display:      'flex',
  alignItems:   'center',
  padding:      '10px 14px',
  borderBottom: '1px solid #e2e8f0',
  background:   '#f8fafc',
  flexShrink:   0,
};

const titleStyle: React.CSSProperties = {
  fontWeight:  600,
  fontSize:    13,
  color:       '#0f172a',
  marginRight: 'auto',
};

const uploadBtnStyle: React.CSSProperties = {
  fontSize:     12,
  padding:      '4px 10px',
  background:   '#eff6ff',
  border:       '1px solid #bfdbfe',
  borderRadius: 5,
  cursor:       'pointer',
  color:        '#1d4ed8',
  fontWeight:   500,
};

const editorWrapStyle: React.CSSProperties = {
  flex:     1,
  display:  'flex',
  overflow: 'auto',
  position: 'relative',
};

const gutterStyle: React.CSSProperties = {
  minWidth:       36,
  paddingTop:     8,
  paddingRight:   6,
  textAlign:      'right',
  fontFamily:     'monospace',
  fontSize:       12,
  color:          '#94a3b8',
  background:     '#f8fafc',
  borderRight:    '1px solid #e2e8f0',
  userSelect:     'none',
  flexShrink:     0,
  lineHeight:     '1.6',
};

const gutterLineStyle: React.CSSProperties = {
  height:     '1.6em',
  paddingRight: 6,
};

const textareaStyle: React.CSSProperties = {
  flex:        1,
  resize:      'none',
  border:      'none',
  outline:     'none',
  fontFamily:  '"Fira Code", "Cascadia Code", "Consolas", monospace',
  fontSize:    13,
  lineHeight:  '1.6',
  padding:     '8px 12px',
  color:       '#0f172a',
  background:  'transparent',
  tabSize:     4,
  whiteSpace:  'pre',
  overflowWrap: 'normal',
  overflowX:   'auto',
};

const footerStyle: React.CSSProperties = {
  display:      'flex',
  alignItems:   'center',
  padding:      '5px 12px',
  borderTop:    '1px solid #e2e8f0',
  fontSize:     11,
  color:        '#64748b',
  background:   '#f8fafc',
  flexShrink:   0,
};

// ------------------------------------------------------------------
// Placeholder text
// ------------------------------------------------------------------

const PLACEHOLDER = `; Paste SEL relay logic here or upload a file
; Example:
TRIP = SV01 + 87T + LOCKOUT
SV01 = 50P1T * !52A + 51PT
ALARM = !DC_OK + FAIL
`;
