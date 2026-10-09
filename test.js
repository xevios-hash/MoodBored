const { join, dirname, resolve, isAbsolute } = require('path');
const { homedir } = require('os');

const WORKSPACE_DIR = join(homedir(), 'MoodBored-Workspace');

function resolveWorkspacePath(path) {
  if (!path) return null;
  const expanded = path.startsWith('~') ? join(homedir(), path.slice(2)) : path;
  const full = isAbsolute(expanded) ? expanded : join(WORKSPACE_DIR, expanded);
  const resolved = resolve(full);
  console.log('Path:', path);
  console.log('Expanded:', expanded);
  console.log('Full:', full);
  console.log('Resolved:', resolved);
  console.log('WORKSPACE_DIR:', WORKSPACE_DIR);
  console.log('Starts with WORKSPACE_DIR:', resolved.startsWith(WORKSPACE_DIR));
  return resolved.startsWith(WORKSPACE_DIR) ? resolved : null;
}

console.log('Test 1:', resolveWorkspacePath('test/hello.ts'));
console.log('Test 2:', resolveWorkspacePath(''));
console.log('Test 3:', resolveWorkspacePath(null));
