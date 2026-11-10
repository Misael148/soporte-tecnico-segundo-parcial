import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from './app.js';
const key = 'test-key-012345678901234567890123456789';
const sample = {source_id:'prueba-1',nombre:'Prueba',correo:'prueba@example.com',categoria:'Redes',prioridad:'Alta',descripcion:'Sin conexión en el laboratorio'};
test('API valida, autentica, genera folios y evita duplicados', async t => {
  const stored = new Map();
  const pool = {async query(sql,args) {
    if (sql.startsWith('INSERT')) {
      if(stored.has(args[0])) return {rowCount:0,rows:[]};
      const row={id:'1',...sample,source_id:args[0],nombre:args[1],correo:args[2],categoria:args[3],prioridad:args[4],descripcion:args[5]};
      stored.set(args[0],row);return {rowCount:1,rows:[row]};
    }
    if(sql.includes('WHERE source_id')) return {rowCount:1,rows:[stored.get(args[0])]};
    if(sql.includes('WHERE id')) return {rowCount:0,rows:[]};
    if(sql==='SELECT 1') return {rows:[{ok:1}]};
    throw new Error('Consulta no implementada en esta prueba');
  }};
  const server=createApp(pool,key).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url=`http://127.0.0.1:${server.address().port}`;
  const send = (body,auth=key) => fetch(url+'/api/solicitudes',{method:'POST',headers:{'Content-Type':'application/json','X-API-Key':auth},body:JSON.stringify(body)});
  assert.equal((await fetch(url+'/health')).status,200);
  assert.equal((await send(sample,'incorrecta')).status,401);
  assert.equal((await send({...sample,correo:'mal'})).status,400);
  assert.equal((await send({...sample,categoria:'Inventada'})).status,400);
  const created=await send(sample);assert.equal(created.status,201);
  assert.equal((await created.json()).solicitud.folio,'ST-000001');
  const duplicate=await send(sample);assert.equal(duplicate.status,200);assert.equal((await duplicate.json()).created,false);
  assert.equal(stored.size,1);
  assert.equal((await send({...sample,descripcion:'Otro contenido'})).status,409);
  assert.equal((await fetch(url+'/api/solicitudes?page=-1',{headers:{'X-API-Key':key}})).status,400);
  assert.equal((await fetch(url+'/api/solicitudes/ST-999',{headers:{'X-API-Key':key}})).status,404);
  const malformed=await fetch(url+'/api/solicitudes',{method:'POST',headers:{'X-API-Key':key,'Content-Type':'application/json'},body:'{'});
  assert.equal(malformed.status,400);
});
