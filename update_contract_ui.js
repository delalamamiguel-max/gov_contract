const fs = require('fs');
let code = fs.readFileSync('src/components/ContractRow.tsx', 'utf8');

// Hide the match score % if not expanded
code = code.replace(
  /<span style=\{\{ fontSize: '0.95rem', fontWeight: 700, color: chip\.fg \}\}>\{a\.matchScore\}%<\/span>/,
  `{expanded && <span style={{ fontSize: '0.95rem', fontWeight: 700, color: chip.fg }}>{a.matchScore}%</span>}`
);

// Update tabs to look like buttons
const oldTabsRegex = /<div style=\{\{ display: 'flex', gap: '0\.5rem', borderBottom: '1px solid rgba\(42, 51, 61,0\.08\)' \}\} onClick=\{\(e\) => e\.stopPropagation\(\)\}>\s*\{\(\[\['assessment', 'Assessment'\], \['readiness', 'Proposal Readiness'\], \['rfp', 'RFP Workflow'\], \['attachments', 'Attachments'\]\] as \[Tab, string\]\[\]\)\.map\(\(\[key, label\]\) => \(\s*<button\s*key=\{key\}\s*onClick=\{\(\) => selectTab\(key\)\}\s*style=\{\{\s*background: 'transparent',\s*border: 'none',\s*borderBottom: tab === key \? '2px solid var\(--accent-primary\)' : '2px solid transparent',\s*color: tab === key \? 'var\(--accent-primary\)' : 'var\(--text-secondary\)',\s*fontWeight: 600,\s*fontSize: '0\.85rem',\s*padding: '0\.5rem 0\.25rem',\s*cursor: 'pointer',\s*\}\}\s*>\s*\{label\}\s*<\/button>\s*\)\)\s*<\/div>/g;

const newTabs = `<div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
            {([['assessment', 'Assessment'], ['readiness', 'Proposal Readiness'], ['rfp', 'RFP Workflow'], ['attachments', 'Attachments']] as [Tab, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => selectTab(key)}
                style={{
                  background: tab === key ? 'var(--accent-primary)' : 'rgba(42, 51, 61, 0.05)',
                  border: '1px solid',
                  borderColor: tab === key ? 'var(--accent-primary)' : 'rgba(42, 51, 61, 0.1)',
                  color: tab === key ? '#ffffff' : 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {label}
              </button>
            ))}
          </div>`;

code = code.replace(oldTabsRegex, newTabs);
fs.writeFileSync('src/components/ContractRow.tsx', code);
