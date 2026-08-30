import os
import logging
from dotenv import load_dotenv
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes

load_dotenv()
TOKEN = os.environ.get("BOT_TOKEN")

logging.basicConfig(format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO)

# ЗАМЕНИТЕ на вашу ссылку с GitHub Pages после публикации
WEBAPP_URL = "https://ВАШ_НИК.github.io/budget-tracker/"

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [
        [InlineKeyboardButton("Открыть приложение", web_app=WebAppInfo(url=WEBAPP_URL))],
        [InlineKeyboardButton("Добавить доход", callback_data="add_income"),
         InlineKeyboardButton("Добавить расход", callback_data="add_expense")],
        [InlineKeyboardButton("Статистика", callback_data="stats")]
    ]
    await update.message.reply_text(
        "💰 Budget Pro\n\nВаш трекер финансов.",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

async def button(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    if query.data == "add_income":
        await query.edit_message_text("Введите: /add income 5000 Описание")
    elif query.data == "add_expense":
        await query.edit_message_text("Введите: /add expense 1200 Продукты")
    elif query.data == "stats":
        await query.edit_message_text("Откройте приложение для полной статистики.")

async def add_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        args = context.args
        if len(args) < 3:
            await update.message.reply_text("Формат: /add income 5000 Зарплата")
            return
        tx_type = args[0]
        amount = float(args[1])
        desc = " ".join(args[2:])
        sign = "+" if tx_type == "income" else "-"
        await update.message.reply_text(f"✅ Добавлено: {sign}{amount:,.0f} ₽\n{desc}")
    except Exception as e:
        await update.message.reply_text(f"Ошибка: {e}")

def main():
    app = Application.builder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("add", add_cmd))
    app.add_handler(CallbackQueryHandler(button))
    print("Бот запущен...")
    app.run_polling()

if __name__ == "__main__":
    main()
