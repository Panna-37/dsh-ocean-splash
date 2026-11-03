import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const name = 'dsh-ocean-splash';
export const inject = ['webServer'];

const PREFIX = '/dsh-ocean-splash';

function read(rel) {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
}

export function apply(ctx) {
  const files = {
    'splash.js': ['text/javascript; charset=utf-8', read('./lib/boot.js')],
    'ocean-renderer.js': ['text/javascript; charset=utf-8', read('./lib/ocean-renderer.js')]
  };

  const disposers = Object.entries(files).map(([file, [type, body]]) =>
    ctx.webServer.register({
      kind: 'exact',
      path: PREFIX + '/' + file,
      handler: (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
        res.writeHead(200, {
          'content-type': type,
          'cache-control': 'no-store',
          'content-length': Buffer.byteLength(body)
        });
        res.end(req.method === 'HEAD' ? undefined : body);
      }
    })
  );

  // 在第一帧之前就把画面盖住
  ctx.effect(() => {
    const off = ctx.on('webserver/index-inject', (table) => {
      table.push({ kind: 'script-src', placement: 'head', src: PREFIX + '/splash.js' });
    });
    return () => {
      off();
      for (const dispose of disposers) {
        try { dispose(); } catch { /* already gone */ }
      }
    };
  });
}
