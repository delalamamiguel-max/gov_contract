const { spawn } = require('child_process');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const tokenMatch = env.match(/APIFY_TOKEN=(.+)/);
if (tokenMatch) {
  const token = tokenMatch[1].trim();
  console.log('Got token, running push...');
  const child = spawn('npx', ['apify-cli', 'push'], { 
    cwd: './apify/caleprocure-listings', 
    stdio: 'pipe',
    env: { ...process.env, APIFY_TOKEN: token }
  });
  child.stdout.on('data', d => console.log('OUT:', d.toString()));
  child.stderr.on('data', d => console.error('ERR:', d.toString()));
  child.on('close', c => console.log('CLOSED:', c));
} else {
  console.error('No APIFY_TOKEN found');
}
