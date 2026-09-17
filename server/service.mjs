import {randomUUID} from 'node:crypto';
import {HttpError} from './auth.mjs';
import {validateRecord} from './validation.mjs';

async function checkSpace(tx,item){if(item.spaceId){const space=await tx.get(item.spaceId);if(!space||space.kind!=='space')throw new HttpError(400,'Раздел уже удалён. Выбери другой.');}}
export async function createItem(store,user,raw,id=raw?.clientId||randomUUID()){
 if(raw?.clientId&&!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(raw.clientId))throw new HttpError(400,'Некорректный идентификатор запроса.');
 const data=validateRecord(raw);return store.write(user,async tx=>{
  const existing=await tx.get(id);if(existing)return existing;
  const all=await tx.list();if(all.length>=5000)throw new HttpError(400,'Достигнут лимит 5000 записей. Выгрузи архив и удали ненужные.');
  await checkSpace(tx,data);const now=Date.now();return tx.insert({...data,id,createdAt:now,updatedAt:now});
 });
}
export async function updateItem(store,user,id,raw){
 if(!Number.isInteger(raw.version)||raw.version<1)throw new HttpError(400,'Не указана версия записи.');
 return store.write(user,async tx=>{
  const current=await tx.get(id);if(!current)throw new HttpError(404,'Запись не найдена.');
  if(current.version!==raw.version)throw new HttpError(409,'Запись изменилась на другом устройстве. Данные обновлены — повтори действие.');
  if(raw.kind&&raw.kind!==current.kind)throw new HttpError(400,'Тип записи нельзя изменить.');
  const data=validateRecord({...current,...raw,kind:current.kind});await checkSpace(tx,data);
  return tx.update({...data,id,createdAt:current.createdAt,updatedAt:Date.now()},raw.version);
 });
}
export async function deleteItem(store,user,id,version){
 if(!Number.isInteger(version)||version<1)throw new HttpError(400,'Не указана версия записи.');
 return store.write(user,async tx=>{
  const item=await tx.get(id);if(!item)throw new HttpError(404,'Запись не найдена.');
  if(item.version!==version)throw new HttpError(409,'Запись изменилась. Обнови экран и повтори действие.');
  if(item.kind==='space')for(const child of await tx.list())if(child.spaceId===id)await tx.update({...child,spaceId:'',updatedAt:Date.now()},child.version);
  await tx.remove(id,version);return {ok:true};
 });
}
