import os
import json
import sqlite3
import asyncio
from datetime import datetime
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, MessageHandler, ContextTypes, filters
from contextlib import asynccontextmanager

# ─── CONFIG ─────────────────────────
TOKEN = os.environ.get("BOT_TOKEN", "ВАШ_ТОКЕН")
WEBAPP_URL = os.environ.get("WEBAPP_URL", "https://gize-ai.github.io/budget-tracker/")
RENDER_URL = os.environ.get("RENDER_EXTERNAL_URL", "")  # Render даёт эту переменную

DB_FILE = "data.db"

# ─── DATABASE ───────────────────────
def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY, user_id TEXT, type TEXT, amount REAL,
        desc TEXT, cat TEXT, date TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS debts (
        id INTEGER PRIMARY KEY, user_id TEXT, debt_type TEXT, person TEXT,
        amount REAL, rate REAL, due_date TEXT)''')
    conn.commit()
    conn.close()

init_db()

def db_add_tx(user_id, ttype, amount, desc, cat):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("INSERT INTO transactions (user_id,type,amount,desc,cat,date) VALUES (?,?,?,?,?,?)",
              (str(user_id), ttype, amount, desc, cat, datetime.now().isoformat()))
    conn.commit()
    conn.close()

# ─── FASTAPI ────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Запускаем бота в фоне
    if TOKEN and "ВАШ_ТОКЕН" not in TOKEN:
        asyncio.create_task(run_bot())
    yield

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/")
def root():
    return {"status": "ok"}

@app.post("/api/transaction/{user_id}")
async def api_add_tx(user_id: str, request: Request):
    data = await request.json()
    db_add_tx(user_id, data.get("type"), data.get("amount"), data.get("desc"), data.get("cat"))
    return {"ok": True}

@app.get("/api/data/{user_id}")
def api_get_data(user_id: str):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT type,amount,desc,cat,date FROM transactions WHERE user_id=?", (user_id,))
    txs = [{"type": r[0], "amount": r[1], "desc": r[2], "cat": r[3], "date": r[4]} for r in c.fetchall()]
    conn.close()
    return {"transactions": txs}

# ─── TELEGRAM BOT ───────────────────
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    kb = [[InlineKeyboardButton("Открыть приложение", web_app=WebAppInfo(url=WEBAPP_URL))]]
    await update.message.reply_text(
        f"Привет! Отправь мне текстом или голосом, что купил и за сколько.\n"
        f"Пример: «энергос 120» или «доход зарплата 50000»\n\n"
        f"Твой ID для синхронизации: `{user_id}`",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(kb)
    )

async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    text = update.message.text.lower()
    
    # Парсинг: «энергос 120» или «доход арбитраж 5000»
    words = text.split()
    amount = None
    for w in words:
        try:
            amount = float(w.replace(",", "."))
            break
        except:
            continue
    
    if amount is None:
        await update.message.reply_text("Не понял сумму. Напиши: «продукты 450»")
        return
    
    # Определяем тип
    ttype = "expense"
    if any(x in text for x in ["доход", "зарплата", "получил", "+", "пришло"]):
        ttype = "income"
    
    # Категория / описание
    cat = "Прочее"
    desc = text[:50]
    
    if "энерг" in text or "свет" in text: cat = "Жильё"; desc = "Энергос"
    elif "продукт" in text or "еда" in text: cat = "Продукты"; desc = "Продукты"
    elif "транспорт" in text or "метро" in text: cat = "Транспорт"
    elif "арбитр" in text or "акк" in text: cat = "Арбитраж"; desc = "Закупка аков"
    elif "депозит" in text or "тест" in text: cat = "Депозит"
    
    db_add_tx(user_id, ttype, amount, desc, cat)
    sign = "+" if ttype == "income" else "−"
    await update.message.reply_text(f"✅ Сохранено: {sign}{amount:,.0f} ₽\nКатегория: {cat}\nОписание: {desc}")

async def handle_voice(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Telegram не распознаёт голосовые автоматом. Пока просим текст.
    await update.message.reply_text("Голосовые пока в разработке. Отправь текстом или используй Siri Shortcuts.")

bot_app = None

async def run_bot():
    global bot_app
    bot_app = Application.builder().token(TOKEN).build()
    bot_app.add_handler(CommandHandler("start", start))
    bot_app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    bot_app.add_handler(MessageHandler(filters.VOICE, handle_voice))
    
    if RENDER_URL:
        # Webhook для Render
        await bot_app.bot.set_webhook(f"{RENDER_URL}/webhook")
    else:
        # Локально — polling
        await bot_app.run_polling()

@app.post("/webhook")
async def webhook(request: Request):
    data = await request.json()
    await bot_app.process_update(Update.de_json(data, bot_app.bot))
    return {"ok": True}

# ─── MAIN ───────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
