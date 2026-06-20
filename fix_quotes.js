const fs = require('fs');

const path = 'src/lib/onboardingSession.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/case 'Yes, we\\\\'re California-based':/g, "case 'Yes, we\\'re California-based':");
code = code.replace(/case 'Yes, we\\\\'re registered but headquartered elsewhere':/g, "case 'Yes, we\\'re registered but headquartered elsewhere':");

fs.writeFileSync(path, code);

console.log("Fixed!");
