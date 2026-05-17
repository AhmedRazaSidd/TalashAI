const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('\x1b[36m%s\x1b[0m', '=====================================================================');
console.log('\x1b[36m%s\x1b[0m', '          TALASH AI LEGAL PLATFORM - SYSTEM INITIALIZER');
console.log('\x1b[36m%s\x1b[0m', '=====================================================================');
console.log('\x1b[33m%s\x1b[0m', 'Initializing all services inside VS Code integrated terminal...\n');

const children = [];

function getPythonCmd() {
  const agentDir = path.join(__dirname, 'talashAgent');
  const venvPaths = [
    path.join(agentDir, '.venv', 'Scripts', 'python.exe'),
    path.join(agentDir, 'venv', 'Scripts', 'python.exe'),
    path.join(agentDir, '.venv', 'bin', 'python'),
    path.join(agentDir, 'venv', 'bin', 'python')
  ];

  for (const venvPath of venvPaths) {
    if (fs.existsSync(venvPath)) {
      return venvPath;
    }
  }
  return 'python';
}

function runService(name, color, cwd, cmd, args) {
  const p = spawn(cmd, args, {
    cwd,
    shell: true,
    env: { ...process.env, FORCE_COLOR: 'true' }
  });

  children.push(p);

  const prefix = `${color}[${name}]\x1b[0m`;

  p.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line) => {
      if (line.trim()) console.log(`${prefix} ${line.trim()}`);
    });
  });

  p.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line) => {
      if (line.trim()) console.error(`${prefix} \x1b[31m${line.trim()}\x1b[0m`);
    });
  });

  p.on('close', (code) => {
    console.log(`${prefix} exited with code ${code}`);
  });
}

// 1. Start Python AI FastAPI Server
const pythonBin = getPythonCmd();
console.log('\x1b[32m%s\x1b[0m', `[+] Booting Python AI Server (using ${pythonBin})...`);
runService('Python AI', '\x1b[32m', path.join(__dirname, 'talashAgent'), pythonBin, ['-m', 'uvicorn', 'api:app', '--port', '8000']);

// 2. Start NestJS Backend
console.log('\x1b[34m%s\x1b[0m', '[+] Booting NestJS Backend Server (Port 3000)...');
runService('NestJS API', '\x1b[36m', path.join(__dirname, 'server'), 'npm', ['run', 'start:dev']);

// 3. Start Expo Mobile Metro
console.log('\x1b[35m%s\x1b[0m', '[+] Booting Expo Metro Bundler (Port 8081)...');
runService('Expo Metro', '\x1b[35m', path.join(__dirname, 'app'), 'npx', ['expo', 'start']);

// Handle termination signals cleanly
process.on('SIGINT', () => {
  console.log('\n\x1b[31m%s\x1b[0m', 'Shutting down all services safely...');
  children.forEach((child) => {
    child.kill('SIGINT');
  });
  setTimeout(() => {
    process.exit();
  }, 1000);
});
