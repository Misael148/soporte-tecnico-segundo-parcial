import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {createApp} from './app.js';
if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL');
const appKey = process.env.API_KEY;
if (!appKey || appKey.length < 32) throw new Error('API_KEY debe contener al menos 32 caracteres');
const pool = new pg.Pool({connectionString:process.env.DATABASE_URL,max:5,connectionTimeoutMillis:15000,idleTimeoutMillis:30000});
pool.on('error', error=>console.error('Conexión de base de datos:',error.code || error.name));
await pool.query(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));
const server = createApp(pool,appKey).listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('API de soporte iniciada'));
let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  const timeout = setTimeout(()=>process.exit(1),10000).unref();
  server.close(async ()=>{await pool.end();clearTimeout(timeout);process.exit(0);});
}
process.on('SIGTERM',shutdown);
process.on('SIGINT',shutdown);
