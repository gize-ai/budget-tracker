import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { HttpError } from './auth.mjs';

const schema=`CREATE TABLE IF NOT EXISTS ritm_items (user_id TEXT NOT NULL, id TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(user_id,id)); CREATE INDEX IF NOT EXISTS ritm_items_user ON ritm_items(user_id);`;
function decode(row){return row?{...JSON.parse(row.payload),version:Number(row.version)}:null;}
function view(query,user){return {
 async list(){return (await query('SELECT payload,version FROM ritm_items WHERE user_id=$1',[user])).rows.map(decode);},
 async get(id){return decode((await query('SELECT payload,version FROM ritm_items WHERE user_id=$1 AND id=$2',[user,id])).rows[0]);},
 async insert(item){await query('INSERT INTO ritm_items(user_id,id,kind,payload,version) VALUES($1,$2,$3,$4,$5)',[user,item.id,item.kind,JSON.stringify(item),1]);return {...item,version:1};},
 async update(item,version){const result=await query('UPDATE ritm_items SET payload=$1,version=version+1 WHERE user_id=$2 AND id=$3 AND version=$4 RETURNING version',[JSON.stringify(item),user,item.id,version]);if(!result.rows.length)throw new HttpError(409,'Запись изменилась на другом устройстве. Данные обновлены — повтори действие.');return {...item,version:version+1};},
 async remove(id,version){const result=await query('DELETE FROM ritm_items WHERE user_id=$1 AND id=$2 AND version=$3 RETURNING id',[user,id,version]);if(!result.rows.length)throw new HttpError(409,'Запись уже изменилась. Обнови экран и повтори действие.');}
};}

export async function createStore({url,filename='data/ritm.sqlite',ssl=false}={}){
 if(url){
  const {Pool}=await import('pg');const pool=new Pool({connectionString:url,max:5,connectionTimeoutMillis:10000,idleTimeoutMillis:30000,...(ssl?{ssl:{rejectUnauthorized:true}}:{})});
  pool.on('error',()=>console.error('Database connection interrupted.'));
  await pool.query(schema);
  return {type:'postgres',list:user=>view(pool.query.bind(pool),user).list(),async write(user,fn){const client=await pool.connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[user]);const result=await fn(view(client.query.bind(client),user));await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}},close:()=>pool.end()};
 }
 if(filename!==':memory:')await mkdir(dirname(filename),{recursive:true});
 const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(filename);db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');db.exec(schema);
 const query=async(sql,params=[])=>{const stmt=db.prepare(sql.replace(/\$\d+/g,'?'));if(/^SELECT\b/i.test(sql)||/RETURNING/i.test(sql))return {rows:stmt.all(...params)};return {rows:[],rowCount:stmt.run(...params).changes};};
 let queue=Promise.resolve();
 return {type:'sqlite',list:user=>view(query,user).list(),write(user,fn){const operation=queue.then(async()=>{db.exec('BEGIN IMMEDIATE');try{const result=await fn(view(query,user));db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}});queue=operation.catch(()=>{});return operation;},close:async()=>{await queue;db.close();}};
}
