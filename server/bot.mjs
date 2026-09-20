import {createItem} from './service.mjs';
import {parseAmount} from '../public/domain.js';

export async function telegramCall(token,method,body){
 const response=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const data=await response.json();if(!data.ok)throw new Error(`Telegram method ${method} failed.`);return data.result;
}
export async function handleUpdate(update,{store,token,publicUrl}){
 const msg=update.message;
 if(!Number.isSafeInteger(update.update_id)||!msg||msg.chat?.type!=='private'||!Number.isSafeInteger(msg.from?.id)||msg.from.id!==msg.chat.id)return;
 const text=msg.text?.trim();if(!text)return;
 const invitation=text.match(/^\/start(?:@\w+)?\s+(v_[a-f0-9]{32})$/)?.[1];
 const appUrl=invitation?new URL('/?invite='+invitation,publicUrl).href:publicUrl;
 const reply=message=>telegramCall(token,'sendMessage',{chat_id:msg.chat.id,text:message,reply_markup:{inline_keyboard:[[{text:invitation?'Открыть приглашение':'Открыть VANTA',web_app:{url:appUrl}}]]}});
 if(invitation)return reply('Тебя пригласили в VANTA. Открой приложение и прими приглашение, чтобы видеть игровой прогресс друг друга. Личные записи, цели и финансы останутся закрытыми.');
 if(/^\/(start|help)(@\w+)?(?:\s|$)/.test(text))return reply('VANTA — твои мысли, дела, привычки, цели и финансы.\n\nОткрой приложение или просто пришли текст — сохраню его в заметки.\n\n/expense 250 Кофе — расход\n/income 5000 Подработка — доход\n/task Набросать план — дело\n\nМаленькие действия. Настоящий прогресс.');
 const match=text.match(/^\/(expense|income|task)(?:@\w+)?\s+([\s\S]+)$/);
 let record,confirmation;
 if(match&&match[1]==='task'){record={kind:'task',title:match[2],spaceId:'',done:false,dueDate:''};confirmation='Дело добавлено в «Сегодня».';}
 else if(match){const parts=match[2].match(/^(\S+)\s+([\s\S]+)$/);if(!parts)return reply('Укажи сумму и название: /expense 250 Кофе');try{record={kind:'transaction',type:match[1]==='income'?'income':'expense',amount:parseAmount(parts[1]),title:parts[2],category:'Другое',spaceId:'',date:new Date(msg.date*1000).toISOString().slice(0,10)};}catch{return reply('Не удалось прочитать сумму. Пример: /expense 250,50 Кофе');}confirmation='Операция записана. Дату и категорию можно изменить в приложении.';}
 else if(text.startsWith('/'))return reply('Не знаю эту команду. Пришли обычный текст — сохраню заметку. Команды: /help');
 else{record={kind:'note',title:text.split('\n')[0].slice(0,180),body:text,pinned:false,spaceId:''};confirmation='Сохранено в заметки.';}
 try{await createItem(store,String(msg.from.id),record,`telegram-${update.update_id}`);}catch(error){if(error.status===400)return reply(error.message);throw error;}
 await reply(confirmation);
}
