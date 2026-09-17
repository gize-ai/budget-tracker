import { createHmac, timingSafeEqual } from 'node:crypto';

export class HttpError extends Error { constructor(status, message) { super(message); this.status=status; } }
export function safeEqual(a,b) { const x=Buffer.from(String(a));const y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y); }
export function verifyTelegram(initData, token, now=Math.floor(Date.now()/1000)) {
  if(!token||typeof initData!=='string'||!initData||initData.length>16384)throw new HttpError(401,'Открой приложение заново через своего Telegram-бота.');
  const params=new URLSearchParams(initData);const seen=new Set();
  for(const [key] of params){if(seen.has(key))throw new HttpError(401,'Некорректные данные входа.');seen.add(key);}
  const hash=params.get('hash');if(!hash||!/^[a-f0-9]{64}$/i.test(hash))throw new HttpError(401,'Не удалось подтвердить вход.');
  params.delete('hash');
  const check=[...params.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${k}=${v}`).join('\n');
  const secret=createHmac('sha256','WebAppData').update(token).digest();
  const expected=createHmac('sha256',secret).update(check).digest('hex');
  if(!safeEqual(expected,hash.toLowerCase()))throw new HttpError(401,'Не удалось подтвердить вход.');
  const authDate=Number(params.get('auth_date'));
  if(!Number.isInteger(authDate)||now-authDate>86400||authDate>now+30)throw new HttpError(401,'Сессия закончилась. Закрой и открой приложение через бота.');
  let user;try{user=JSON.parse(params.get('user'));}catch{throw new HttpError(401,'Некорректные данные пользователя.');}
  if(!user||!Number.isSafeInteger(user.id)||user.id<=0)throw new HttpError(401,'Некорректные данные пользователя.');
  return {id:String(user.id),firstName:String(user.first_name||'').slice(0,100)};
}
