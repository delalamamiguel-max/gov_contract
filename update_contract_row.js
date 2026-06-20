const fs = require('fs');

let code = fs.readFileSync('src/components/ContractRow.tsx', 'utf8');

// Replace the line showing agency and estimated value to also show the due date
code = code.replace(
  /<p style=\{\{ color: 'var\(--text-secondary\)' \}\}>\s*\{opp.agency\} &bull; Est. Value: \{opp.value\}\s*<\/p>/,
  `<p style={{ color: 'var(--text-secondary)' }}>
            {opp.agency} &bull; Est. Value: {opp.value} &bull; Due: {opp.responseDeadline ? new Date(opp.responseDeadline).toLocaleDateString() : 'TBD'}
          </p>`
);

// Add the brief overview snippet below the agency line
code = code.replace(
  /<div style=\{\{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.15rem' \}\}>/,
  `{/* Brief gist shown on unexpanded card */}
          {!expanded && (a.kimiReason || opp.description) && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.3rem 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {a.kimiReason ? (
                <span><strong style={{color: 'var(--accent-primary)'}}>AI Note:</strong> {a.kimiReason}</span>
              ) : (
                <span>{opp.description?.substring(0, 150)}...</span>
              )}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.15rem' }}>`
);

fs.writeFileSync('src/components/ContractRow.tsx', code);
