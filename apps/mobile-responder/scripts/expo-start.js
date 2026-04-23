const { spawn } = require('node:child_process');

const cliPath = require.resolve('expo/bin/cli');
const args = ['start', ...process.argv.slice(2)];
const env = {
  ...process.env,
  EXPO_NO_DEPENDENCY_VALIDATION: process.env.EXPO_NO_DEPENDENCY_VALIDATION || '1',
};

const child = spawn(process.execPath, [cliPath, ...args], {
  cwd: process.cwd(),
  env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

