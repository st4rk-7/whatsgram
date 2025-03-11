const qrcode = require('qrcode-terminal');
const fs = require('fs');
const sharp = require('sharp');
const { createDatabaseIfNeeded, getMessages, markMessagesAsRead, getUnreads, addMsg } = require('./dbfunctions')
const { createBots } = require('./bots')
const { sendMessagesSequentially, downloadAndSaveFile } = require('./misc')
const { messageType } = require('./enums')
const { MessageMedia } = require('whatsapp-web.js');

let currentChatName = '';
let currentChatIsGroup = false;
let initialized = false;

let chats;
const contacts = []
let messageIds = []

let myChatId = 0

const [bot, client] = createBots();

createDatabaseIfNeeded();

client.on('ready', () => {
	console.log('Client is ready!');
});

client.on('qr', qr => {
	qrcode.generate(qr, { small: true });
});

client.initialize();

client.on('message_create', message => { // Handle received messages (groups only)

	const isGroupMessage = message.from.endsWith('@g.us');

	if (isGroupMessage) {

		console.log("El mensaje proviene de un grupo.");

		message.getChat().then((chat) => {

			const contact = contacts.find(c => c.number === message.author);

			console.log(`El nombre del grupo es: ${chat.name} y el que envio el mensaje: ${contact.name}`);

			message.isGroup = true
			handleGroupReceivedMessage(message)

		});


	}

	// if (!message.id.fromMe && lastmessage !== message.body && message.type === 'chat') {
	// 	lastmessage = message.body
	// }
});

client.on('message', msg => { // Handle received messages

	if (msg.body == '!ping') {
		client.sendMessage(msg.from, 'pong');
	}

	handleChatReceivedMessage(msg)

});

function handleGroupReceivedMessage(msg) {

	const contact = contacts.find(c => c.number === msg.author);

	msg.getChat().then((chat) => {

		console.log(`El nombre del grupo es: ${chat.name} y el que envio el mensaje: ${contact.name}`);

		if (currentChatName === chat.name) { // If already chatting with that group

			if (!msg.hasMedia) {

				bot.sendMessage(myChatId, `${contact.name}: ${msg.body}`).then(sentMessage => messageIds.push(sentMessage.message_id))
				addMsg({ chatName: chat.name, text: msg.body, isMine: false, isRead: true, isImage: false, isAudio: false, isSticker: false, altName: contact.name })

			} else {

				handleMedia(msg, contact, true, true, chat.name)

			}

		} else {

			const suggestionButton = [[{ text: `/g ${chat.name}` }]];

			bot.sendMessage(myChatId, `New message from group ${chat.name}`, {
				reply_markup: {
					keyboard: suggestionButton,
					one_time_keyboard: true,
					resize_keyboard: true
				}
			}).then(sentMessage => {

				messageIds.push(sentMessage.message_id);

				if (!msg.hasMedia) {
					addMsg({ chatName: chat.name, text: msg.body, isMine: false, isRead: false, isImage: false, isAudio: false, isSticker: false, altName: contact.name })
				} else {
					handleMedia(msg, contact, false, true, chat.name)
				}

			}).catch(err => {
				console.error("Error sending message:", err);
			});

		}

	});

}

function handleChatReceivedMessage(msg) {

	const contact = contacts.find(c => c.number === msg.from);

	if (currentChatName === contact.name) { // If already chatting with that person

		if (!msg.hasMedia) {

			bot.sendMessage(myChatId, `${contact.name}: ${msg.body}`).then(sentMessage => messageIds.push(sentMessage.message_id))
			addMsg({ chatName: contact.name, text: msg.body, isMine: false, isRead: true, isImage: false, isAudio: false, isSticker: false })

		} else {
			handleMedia(msg, contact, true)
		}

	} else { // If the user is not in the chat

		const suggestionButton = [[{ text: `/w ${contact.name}` }]];

		bot.sendMessage(myChatId, `New message from ${contact.name}`, {
			reply_markup: {
				keyboard: suggestionButton,
				one_time_keyboard: true,
				resize_keyboard: true
			}
		}).then(sentMessage => {

			messageIds.push(sentMessage.message_id);

			if (!msg.hasMedia) {
				addMsg({ chatName: contact.name, text: msg.body, isMine: false, isRead: false, isImage: false, isAudio: false, isSticker: false })
			} else {
				addMsg({ chatName: contact.name, text: msg.body, isMine: false, isRead: false, isImage: false, isAudio: false, isSticker: false })
				handleMedia(msg, contact, false)
			}

		}).catch(err => {
			console.error("Error sending message:", err);
		});

	}

}

function handleMedia(msg, contact, sendMessage = true, isGroup = false, groupName = undefined) {

	msg.downloadMedia().then((media) => {

		const fileName = `media_${Date.now()}.${media.mimetype.split('/')[1]}`.replace(' ', '_');
		const filePath = './media/' + fileName

		fs.writeFile(filePath, media.data, { encoding: 'base64' }, (err) => {
			if (err) {
				console.error('Error saving media to disk:', err);
			} else {

				switch (media.mimetype) {

					case 'image/jpeg': // Images
					case 'image/jpg':
					case 'image/png':
					case 'image/webp':
					case 'image/gif':
						const individualChat = { chatName: contact.name, text: filePath, isMine: false, isRead: true, isImage: true, isAudio: false, isSticker: false }
						const groupChat = { chatName: groupName, text: filePath, isMine: false, isRead: true, isImage: true, isAudio: false, isSticker: false, altName: contact.name }
						if (sendMessage) {
							bot.sendPhoto(myChatId, filePath)
								.then(() => addMsg(!isGroup ? individualChat : groupChat))
								.catch(err => {
									console.error('Error receiving image:', err);
								});
						} else {
							addMsg(!isGroup ? individualChat : groupChat)
						}
						break;

					// case 'image/webp': // Sticker
					// 	const webpBuffer = sharp(filePath)
					// 		.resize(512, 512)
					// 		.webp()
					// 		.toBuffer().then(() => {

					// 			bot.sendSticker(myChatId, { source: webpBuffer })
					// 				.then(() => {
					// 					addMsg({ chatName: contact.name, text: filePath, isMine: false, isRead: true, isImage: false, isAudio: false, isSticker: true })
					// 				})
					// 				.catch(err => {
					// 					console.error('Error receiving sticker:', err);
					// 				});

					// 		}).catch((err) => {
					// 			console.log(err)
					// 		});
					// 	break;

					case 'audio/ogg; codecs=opus': // Voice note
						const individualChatAudio = { chatName: contact.name, text: filePath, isMine: false, isRead: true, isImage: false, isAudio: true, isSticker: false }
						const groupChatAudio = { chatName: groupName, text: filePath, isMine: false, isRead: true, isImage: false, isAudio: true, isSticker: false, altName: contact.name }
						if (sendMessage) {
							bot.sendAudio(myChatId, filePath)
								.then(() => {
									addMsg(!isGroup ? individualChat : groupChatAudio)
								})
								.catch((error) => {
									console.error('Error receiving audio:', error);
								});
						} else {
							addMsg(!isGroup ? individualChat : groupChatAudio)
						}
						break;

				}
			}
		});

	});

}

bot.on('callback_query', (callbackQuery) => {
	const message = callbackQuery.message;

	if (callbackQuery.data) {

		if (callbackQuery.data.startsWith('change_to_')) {

			currentChatName = callbackQuery.data.split('change_to_')[1];

			handleWCommand(`/w ${currentChatName}`, message.chat.id)

			// bot.sendMessage(message.chat.id, `Changed to chat with ${currentChatName}`)
			//     .then((sentMessage) => {
			//         bot.pinChatMessage(message.chat.id, sentMessage.message_id)
			//     })

		} else if (callbackQuery.data.startsWith('!w')) {



		}

	}

});

bot.on('message', async (msg) => {

	const chatId = msg.chat.id;
	const messageText = msg.text;

	if (initialized || messageText === '/start') {

		initialized = true;

		if (messageText && messageText.length > 0) {

			if (messageText === '/start' || messageText === '/refresh') {

				myChatId = chatId

				const getContactsPromise = () => {
					return new Promise((resolve, reject) => {
						try {
							const c = client.getContacts();
							resolve(c);
						} catch (error) {
							reject(error);
						}
					});
				};

				getContactsPromise()
					.then(list => {

						for (const c of list) {
							if (c.shortName && c.id._serialized) {
								contacts.push({ name: c.shortName, number: c.id._serialized })
							}
						}

						clearAllMsgs(chatId)
						const info = [
							`Welcome to the bot, <b>Chat id: ${chatId}</b>`,
							'/refresh - Reload contacts and groups',
							'/w (contactName) - Open chat with contact',
							'/g (groupName) - Open group chat',
							'/u - Check unread messages'
						]
						bot.sendMessage(chatId, info.join('\n'), { parse_mode: 'HTML' }).then(sentMessage => messageIds.push(sentMessage.message_id))

						console.log("Loading chats...")

						client.getChats().then(c => {
							console.log("Chats loaded")
							chats = c
						})

					})
					.catch(err => console.error('Error getting contacts', err));

			} else if (messageText.startsWith("/w")) {

				handleWCommand(messageText, chatId)

			} else if (messageText.startsWith("/g")) {

				await handleGCommand(messageText, chatId)

			} else if (messageText.startsWith("/u")) {

				getUnreads((err, messages) => {
					if (err) {
						console.error(err);
					} else {

						const unreads = ['<b>Unread messages:</b>']
						const options = {
							reply_markup: {
								inline_keyboard: [
									[]
								]
							}
						};

						messages.forEach(m => {

							unreads.push(`<b>${m.chatName}:</b> ${m.text.length > 30 ? m.text.substring(0, 30) + '...' : m.text}`)
							options.reply_markup.inline_keyboard[0].push(
								{
									text: `${m.chatName}`,
									callback_data: `change_to_${m.chatName}`
								}
							)

						})

						clearAllMsgs(chatId)
						bot.sendMessage(chatId, unreads.join('\n'), { parse_mode: 'HTML', ...options }).then(sentMessage => messageIds.push(sentMessage.message_id))

					}
				});

			} else if (messageText.startsWith("!")) {
				const info = [
					'<b>!command</b> is not supported anymore, please use:',
					'/refresh - Reload contacts and groups',
					'/w (contactName) - Open chat with contact',
					'/g (groupName) - Open group chat',
					'/u - Check unread messages'
				]
				bot.sendMessage(chatId, info.join('\n'), { parse_mode: 'HTML' }).then(sentMessage => messageIds.push(sentMessage.message_id))
			} else if (messageText === '/command') {



			} else if (currentChatName !== '' && messageText.length > 0) { // TODO add group check
				const contact = contacts.find(c => c.name === currentChatName);
				client.sendMessage(contact.number, messageText);
				addMsg({ chatName: contact.name, text: messageText, isMine: true, isRead: true })
			}

		} else if (currentChatName !== '') {

			{

				const randomId = Math.floor(Math.random() * 1000000);
				let filename, mimeType;
				let isImage = false, isAudio = false, isSticker = false;

				if (msg.photo) {

					const photoArray = msg.photo;
					const fileId = photoArray[photoArray.length - 1].file_id;
					const fileUrl = await bot.getFileLink(fileId);
					filename = await downloadAndSaveFile(fileUrl, `./media/${randomId}.jpg`)
					isImage = true
					mimeType = 'image/jpg'

				} else if (msg.audio) {

					const fileId = msg.audio.file_id;
					const fileUrl = await bot.getFileLink(fileId);
					filename = await downloadAndSaveFile(fileUrl, `./media/${randomId}.mp3`)
					isAudio = true
					mimeType = 'image/mp3'

				} else if (msg.voice) {

					const fileId = msg.voice.file_id;
					const fileUrl = await bot.getFileLink(fileId);
					filename = await downloadAndSaveFile(fileUrl, `./media/${randomId}.ogg`)
					isAudio = true
					mimeType = 'image/ogg'

				}

				if (filename) {

					if (!currentChatIsGroup) {

						const contact = contacts.find(c => c.name === currentChatName);

						const media = MessageMedia.fromFilePath(filename);

						client.sendMessage(contact.number, media).catch(err => {
							console.error('Error sending media:', err);
						});

						addMsg({ chatName: contact.name, text: filename, isMine: true, isRead: true, isAudio: isAudio, isImage: isImage, isSticker: false })

					} else {

						if (chats) {

							const groups = chats.filter(chat => chat.isGroup);
							const group = groups.find(g => g.name === currentChatName)

							if (group) {

								const media = MessageMedia.fromFilePath(filename);

								client.sendMessage(group.id._serialized, media).catch(err => {
									console.error('Error sending media:', err);
								});

								addMsg({ chatName: group.name, text: filename, isMine: true, isRead: true, isAudio: isAudio, isImage: isImage, isSticker: false, altName: "Me" })

							}

						}

					}

				}

			}

		}
	}

});

function handleWCommand(messageText, chatId) {

	const [remainingText, ...n] = messageText.split(" ")

	const to = n.join(' ')

	const contact = contacts.find(c => c.name.trim() === to.trim());

	if (contact) {

		currentChatName = to.trim()

		clearAllMsgs(chatId)

		let msg = `Changed to chat with ${currentChatName}\n`;
		currentChatIsGroup = false;

		bot.sendMessage(chatId, msg)
			.then((sentMessage) => {
				bot.pinChatMessage(chatId, sentMessage.message_id).then(() => {

					messageIds.push(sentMessage.message_id)

					getMessages(currentChatName, (err, messages) => {
						if (err) {
							console.error(err);
						} else {

							const pendingMessages = []
							let hasToMarkChatAsRead = false

							messages.forEach(m => {

								hasToMarkChatAsRead = true

								if (!m.isAudio && !m.isImage && !m.isSticker) {

									const time = m.timestamp.split(' ')[1].replace('.');
									if (!m.isMine) {
										pendingMessages.push({ text: `🔸<b>${currentChatName}</b>: ${m.text} (${time})\n`, type: messageType.text })
									} else {
										pendingMessages.push({ text: `🔹<b>Me</b>: ${m.text} (${time})\n`, type: messageType.text })
									}

								} else {

									if (m.isImage) {
										pendingMessages.push({ text: m.text, type: messageType.image })
									} else if (m.isAudio) {
										pendingMessages.push({ text: m.text, type: messageType.audio })
									}

								}

							})

							sendMessagesSequentially(bot, myChatId, pendingMessages)

							if (hasToMarkChatAsRead) {
								markMessagesAsRead(currentChatName, () => { })
							}

						}
					});

				})
			})

	} else {

		//bot.sendMessage(chatId, `${to} was not found as a contact`)

		if (to.trim() && to.trim().length > 1) {

			const suggestions = contacts.filter(c => c.name.toLowerCase().startsWith(to.trim().toLowerCase()));

			if (suggestions.length > 0) {
				const suggestionButtons = suggestions.map(c => {
					return [{
						text: `/w ${c.name}`
					}];
				});

				clearAllMsgs(chatId)

				bot.sendMessage(chatId, 'Matching contacts: ', {
					reply_markup: {
						keyboard: suggestionButtons,
						one_time_keyboard: true,
						resize_keyboard: true
					}
				}).then(sentMessage => messageIds.push(sentMessage.message_id));

			}
		}

	}

}

async function handleGCommand(messageText, chatId) {

	const [remainingText, ...n] = messageText.split(" ")

	const to = n.join(' ')

	if (chats) {

		const groups = chats.filter(chat => chat.isGroup);

		const group = groups.filter(g => g.name.trim() === to.trim())

		console.log(group)

		if (group.length > 0) {

			currentChatName = to.trim()

			clearAllMsgs(chatId)

			let msg = `Changed to group ${currentChatName}\n`;
			currentChatIsGroup = true;

			bot.sendMessage(chatId, msg)
				.then((sentMessage) => {
					bot.pinChatMessage(chatId, sentMessage.message_id).then(() => {

						messageIds.push(sentMessage.message_id)

						getMessages(currentChatName, (err, messages) => {
							if (err) {
								console.error(err);
							} else {

								const pendingMessages = []
								let hasToMarkChatAsRead = false

								messages.forEach(m => {

									hasToMarkChatAsRead = true

									if (!m.isAudio && !m.isImage && !m.isSticker) {

										const time = m.timestamp.split(' ')[1].replace('.');
										if (!m.isMine) {
											pendingMessages.push({ text: `🔸<b>${m.altName}</b>: ${m.text} (${time})\n`, type: messageType.text })
										} else {
											pendingMessages.push({ text: `🔹<b>Me</b>: ${m.text} (${time})\n`, type: messageType.text })
										}

									} else {

										if (m.isImage) {
											pendingMessages.push({ text: m.text, type: messageType.image })
										} else if (m.isAudio) {
											pendingMessages.push({ text: m.text, type: messageType.audio })
										}

									}

								})

								sendMessagesSequentially(bot, myChatId, pendingMessages)

								if (hasToMarkChatAsRead) {
									markMessagesAsRead(currentChatName, () => { })
								}

							}
						});

					})
				})

		} else {

			//bot.sendMessage(chatId, `${to} was not found as a contact`)

			if (to.trim() && to.trim().length > 1) {

				const suggestions = groups.filter(g => g.name.toLowerCase().startsWith(to.trim().toLowerCase()));

				if (suggestions.length > 0) {
					const suggestionButtons = suggestions.map(sug => {
						return [{
							text: `/g ${sug.name}`
						}];
					});

					clearAllMsgs(chatId)

					bot.sendMessage(chatId, 'Matching groups: ', {
						reply_markup: {
							keyboard: suggestionButtons,
							one_time_keyboard: true,
							resize_keyboard: true
						}
					}).then(sentMessage => messageIds.push(sentMessage.message_id));

				}
			}

		}

	}

}

function clearAllMsgs(chatId) {

	messageIds.forEach(msgId => {
		bot.deleteMessage(chatId, msgId).catch(err => {
		});
	});

	messageIds = [];

}

bot.on('polling_error', (error) => {
	console.log(`[polling_error] ${error.code}: ${error.message}`);
	console.log(error);
});
