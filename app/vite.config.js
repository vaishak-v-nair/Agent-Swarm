import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import path from 'node:path';

function gitBridgePlugin() {
  return {
    name: 'agentswarm-dev-bridge',
    configureServer(server) {
      server.middlewares.use('/api/bridge', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end('Method not allowed');
        }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const { cmd, payload } = JSON.parse(body || '{}');
            const cwd = process.cwd();
            const rootDir = path.resolve(cwd, '..');

            let responseData = null;

            if (cmd === 'default_cwd') {
              responseData = rootDir;
            } else if (cmd === 'available_profiles') {
              responseData = ['powershell', 'cmd', 'pwsh', 'claude'];
            } else if (cmd === 'git_changes') {
              try {
                const branch = execSync('git branch --show-current', { cwd: rootDir, encoding: 'utf8' }).trim() || 'main';
                const statusOut = execSync('git status --porcelain=v1', { cwd: rootDir, encoding: 'utf8' });
                const files = statusOut.split('\n').filter(Boolean).map(line => {
                  const status = line.slice(0, 2);
                  const filePath = line.slice(3).trim();
                  return {
                    path: filePath,
                    status: status.trim() ? status : ' M',
                    added: 0,
                    removed: 0,
                    untracked: status.includes('?')
                  };
                });
                responseData = { root: rootDir, branch, problem: '', files };
              } catch (e) {
                responseData = { root: rootDir, branch: 'main', problem: String(e), files: [] };
              }
            } else if (cmd === 'git_file_diff') {
              try {
                const targetPath = payload?.path || '';
                const diffOut = execSync(`git diff -- "${targetPath}"`, { cwd: rootDir, encoding: 'utf8' });
                responseData = diffOut;
              } catch {
                responseData = '';
              }
            } else if (cmd === 'about') {
              responseData = {
                version: '0.1.0',
                cwd: rootDir,
                config_dir: path.join(rootDir, '.agentswarm'),
                transcripts: '',
              };
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, data: responseData }));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: String(err) }));
          }
        });
      });
    }
  };
}

export default defineConfig({
  clearScreen: false,
  plugins: [gitBridgePlugin()],
  server: {
    port: 1421,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  build: { target: 'chrome110', minify: 'esbuild', sourcemap: false },
});
