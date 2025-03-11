const { messageType } = require('./enums')
const axios = require('axios')
const fs = require('fs');

function sendMessagesSequentially(bot, chatId, messages) {
    const messageIds = [];

    let promiseChain = Promise.resolve();

    messages.forEach((message) => {

        promiseChain = promiseChain.then(() => {
            
            if (message.type === messageType.text) {

                return bot.sendMessage(chatId, message.text, { parse_mode: 'HTML' })
                    .then(sentMessage => {
                        messageIds.push(sentMessage.message_id);
                    });

            } else if (message.type === messageType.image) {

                return bot.sendPhoto(chatId, message.text)
                    .then(sentMessage => {
                        messageIds.push(sentMessage.message_id);
                    });

            } else if (message.type === messageType.audio) {

                return bot.sendAudio(chatId, message.text)
                .then(sentMessage => {
                    messageIds.push(sentMessage.message_id);
                });

            } else if (message.type === messageType.sticker) {

                // return bot.sendAudio(chatId, message.text)
                // .then(sentMessage => {
                //     messageIds.push(sentMessage.message_id);
                // });

            }

        }).catch(err => {
            console.error('Error sending message:', err);
        });
    });

    return promiseChain.then(() => messageIds);

}

async function downloadAndSaveFile(url, filename) {
    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'arraybuffer'
        });

        fs.writeFileSync(filename, response.data);
        console.log(`File saved as ${filename}`);
        return filename;

    } catch (error) {
        console.error('Error downloading file:', error);
        throw error;
    }
}

module.exports = {
    sendMessagesSequentially,
    downloadAndSaveFile
}