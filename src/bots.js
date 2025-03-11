const TelegramBot = require('node-telegram-bot-api');
const { Client } = require('whatsapp-web.js');
const { TOKEN } = require("../config");

function createBots() {

    const bot = new TelegramBot(TOKEN, { polling: true });

    const client = new Client({
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    return [bot, client]

}

module.exports = {
    createBots
}