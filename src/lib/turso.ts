/* Turso (libSQL) adapter mimicking the Cloudflare D1 interface. */
import { createClient, type Client } from '@libsql/client/web';
type Env = Record<string, any>;
let _client: Client | null = null; let _url = '';
function client(env: Env): Client {
  if (_client && _url === env.TURSO_URL) return _client;
  _url = env.TURSO_URL; _client = createClient({ url: env.TURSO_URL, authToken: env.TURSO_AUTH_TOKEN }); return _client;
}
function rowMapper(cols: string[]) { return (row: any) => { const o: Record<string, any> = {}; for (let i = 0; i < cols.length; i++) o[cols[i]] = row[i]; return o; }; }
function statement(env: Env, sql: string, args: any[] = []) {
  const c = () => client(env);
  return {
    bind(...a: any[]) { return statement(env, sql, a); },
    async all() { const r = await c().execute({ sql, args }); return { results: (r.rows as any[]).map(rowMapper(r.columns as string[])), success: true, meta: {} }; },
    async first() { const r = await c().execute({ sql, args }); return r.rows.length ? rowMapper(r.columns as string[])((r.rows as any[])[0]) : null; },
    async run() { const r = await c().execute({ sql, args }); return { success: true, meta: { changes: r.rowsAffected, last_row_id: Number(r.lastInsertRowid ?? 0) } }; },
    async raw() { const r = await c().execute({ sql, args }); return r.rows; },
  };
}
export function tursoDB(env: Env) {
  return { prepare(sql: string) { return statement(env, sql); },
    async exec(sql: string) { await client(env).executeMultiple(sql); return { count: 0, duration: 0 }; },
    async batch(stmts: any[]) { return Promise.all(stmts.map((s) => (typeof s?.all === 'function' ? s.all() : s))); } };
}
export function tursoConfigured(env: Env): boolean { return !!(env?.TURSO_URL && env?.TURSO_AUTH_TOKEN); }
