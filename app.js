import express from 'express';
import {timingSafeEqual} from 'node:crypto';
import {validateSolicitud, categorias, prioridades} from './validation.js';

const decorate = row => ({...row,folio:`ST-${String(row.id).padStart(6,'0')}`});
export function createApp(pool, apiKey) {
  if (!apiKey || apiKey.length < 32) throw new Error('API_KEY debe contener al menos 32 caracteres');
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({limit:'32kb'}));
  app.get('/', (_req,res) => res.json({proyecto:'Sistema automatizado de gestión de solicitudes',version:'1.0.0',endpoints:['GET /health','POST /api/solicitudes','GET /api/solicitudes','GET /api/solicitudes/:folio','GET /api/dashboard']}));
  app.get('/health', async (_req,res,next) => {
    try { await pool.query('SELECT 1'); res.json({status:'ok'}); } catch(error) { next(error); }
  });
  app.use('/api', (req,res,next) => {
    const supplied = Buffer.from(req.get('X-API-Key') || '');
    const expected = Buffer.from(apiKey);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return res.status(401).json({error:'No autorizado'});
    next();
  });
  app.post('/api/solicitudes', async (req,res,next) => {
    const {data,errors} = validateSolicitud(req.body);
    if (errors.length) return res.status(400).json({errors});
    try {
      const keys = ['source_id','nombre','correo','categoria','prioridad','descripcion'];
      const values = keys.map(key=>data[key]);
      const inserted = await pool.query(`INSERT INTO solicitudes (${keys.join(',')}) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (source_id) DO NOTHING RETURNING *`,values);
      if (inserted.rowCount) return res.status(201).json({created:true,solicitud:decorate(inserted.rows[0])});
      const existing = await pool.query('SELECT * FROM solicitudes WHERE source_id=$1',[data.source_id]);
      const row = existing.rows[0];
      if (!row) return res.status(503).json({error:'Reintenta la operación'});
      if (keys.some(key=>row[key]!==data[key])) return res.status(409).json({error:'source_id ya corresponde a otra solicitud'});
      res.json({created:false,solicitud:decorate(row)});
    } catch(error) { next(error); }
  });
  app.get('/api/solicitudes', async (req,res,next) => {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 25);
    if (!Number.isSafeInteger(page)||page<1||page>1000000||!Number.isSafeInteger(limit)||limit<1||limit>100) return res.status(400).json({error:'page: 1 a 1000000; limit: 1 a 100'});
    const args = [], conditions = [];
    for (const [key,allowed] of [['categoria',categorias],['prioridad',prioridades]]) {
      if (req.query[key] !== undefined) {
        if (!allowed.includes(req.query[key])) return res.status(400).json({error:`${key}: valor inválido`});
        args.push(req.query[key]); conditions.push(`${key}=$${args.length}`);
      }
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    try {
      const count = await pool.query(`SELECT count(*)::int AS total FROM solicitudes ${where}`,args);
      const rows = await pool.query(`SELECT * FROM solicitudes ${where} ORDER BY creado_en DESC,id DESC LIMIT $${args.length+1} OFFSET $${args.length+2}`,[...args,limit,(page-1)*limit]);
      res.json({page,limit,total:count.rows[0].total,solicitudes:rows.rows.map(decorate)});
    } catch(error) { next(error); }
  });
  app.get('/api/solicitudes/:folio', async (req,res,next) => {
    const match = /^ST-(\d{1,18})$/.exec(req.params.folio);
    if (!match) return res.status(400).json({error:'Folio inválido'});
    try {
      const result = await pool.query('SELECT * FROM solicitudes WHERE id=$1',[match[1]]);
      if (!result.rowCount) return res.status(404).json({error:'Solicitud no encontrada'});
      res.json(decorate(result.rows[0]));
    } catch(error) { next(error); }
  });
  app.get('/api/dashboard', async (_req,res,next) => {
    try {
      const categories = await pool.query('SELECT categoria,count(*)::int AS total FROM solicitudes GROUP BY categoria ORDER BY categoria');
      const priorities = await pool.query('SELECT prioridad,count(*)::int AS total FROM solicitudes GROUP BY prioridad ORDER BY prioridad');
      res.json({total:categories.rows.reduce((sum,r)=>sum+r.total,0),por_categoria:categories.rows,por_prioridad:priorities.rows});
    } catch(error) { next(error); }
  });
  app.use((_req,res)=>res.status(404).json({error:'Ruta no encontrada'}));
  app.use((error,_req,res,_next)=> {
    if (error.type==='entity.parse.failed') return res.status(400).json({error:'JSON inválido'});
    if (error.type==='entity.too.large') return res.status(413).json({error:'Cuerpo demasiado grande'});
    console.error('Error de servicio:',error.code || error.name);
    res.status(503).json({error:'Servicio temporalmente no disponible'});
  });
  return app;
}
