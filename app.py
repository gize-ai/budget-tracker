import os
import json
import sqlite3
import asyncio
from datetime import datetime
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, MessageHandler, ContextTypes, filters

# ─── CONFIG ─────────────────────────
TOKEN = os.environ.get("BOT_TOKEN", "")
WEBAPP_URL = os.environ.get("WEBAPP_URL", "https://gize-ai.github.io/budget-tracker/")
DB_FILE = "data.db"

# ─── DATABASE ───────────────────────
def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY, user_id TEXT, type TEXT, amount REAL,
        category TEXT, description TEXT, project TEXT, date TEXT)''')
    conn.commit()
    conn.close()

init_db()

def db_add(user_id, ttype, amount, category, desc, project):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("INSERT INTO transactions (user_id,type,amount,category,description,project,date) VALUES (?,?,?,?,?,?,?)",
              (str(user_id), ttype, amount, category, desc, project, datetime.now().isoformat()))
    conn.commit()
    conn.close()

# ─── FASTAPI ────────────────────────
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/")
def root(): return {"ok": True}

@app.post("/api/tx/{user_id}")
async def api_tx(user_id: str, req: Request):
    d = await req.json()
    db_add(user_id, d.get("type"), d.get("amount"), d.get("category"), d.get("description"), d.get("project"))
    return {"ok": True}

@app.get("/api/tx/{user_id}")
def api_get(user_id: str):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT type,amount,category,description,project,date FROM transactions WHERE user_id=?", (user_id,))
    rows = [{"type":r[0],"amount":r[1],"category":r[2],"description":r[3],"project":r[4],"date":r[5]} for r in c.fetchall()]
    conn.close()
    return {"transactions": rows}

# ─── TELEGRAM BOT ───────────────────
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    kb = [[InlineKeyboardButton("Открыть приложение", web_app=WebAppInfo(url=WEBAPP_URL))]]
    await update.message.reply_text(
        f"Привет! Отправь мне трату или доход текстом.\n"
        f"Пример: «продукты 450» или «доход фриланс 15000»\n\n"
        f"Ваш ID: `{uid}`",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(kb)
    )

async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    text = update.message.text.lower().strip()
    words = text.split()
    
    # Find amount
    amount = None
    for w in words:
        try:
            amount = float(w.replace(",", "."))
            break
        except: pass
    if amount is None:
        await update.message.reply_text("Не нашёл сумму. Напишите: «продукты 450»")
        return
    
    # Type
    ttype = "expense"
    if any(x in text for x in ["доход", "зарплата", "получил", "пришло", "вышло", "+"]):
        ttype = "income"
    
    # Category & description
    cat = "Прочее"
    desc = text[:50]
    
    # Simple keyword matching
    if any(w in text for w in ["продукт", "еда", "магазин"]): cat = "Продукты"
    elif any(w in text for w in ["транспорт", "метро", "такси", "бензин"]): cat = "Транспорт"
    elif any(w in text for w in ["жильё", "аренда", "коммунал", "свет", "вода"]): cat = "Жильё"
    elif any(w in text for w in ["доход", "зарплата", "фриланс"]): cat = "Доход"
    
    db_add(uid, ttype, amount, cat, desc, "")
    sign = "+" if ttype == "income" else "−"
    await update.message.reply_text(f"✅ Сохранено: {sign}{amount:,.0f} ₽\nКатегория: {cat}")

bot_app = None

async def run_bot():
    global bot_app
    if not TOKEN or "ВАШ" in TOKEN:
        print("BOT_TOKEN not set")
        return
    bot_app = Application.builder().token(TOKEN).build()
    bot_app.add_handler(CommandHandler("start", start))
    bot_app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    await bot_app.run_polling()

@app.on_event("startup")
async def startup():
    asyncio.create_task(run_bot())
