const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('db/whatsapp.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to database');
});

function createDatabaseIfNeeded() {
    db.serialize(() => {

        db.run(`CREATE TABLE IF NOT EXISTS chat (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            isChat BOOLEAN DEFAULT 0
        )`, (err) => {
            if (err) {
                console.error(err.message);
            } else {
                console.log('"Chat" table successfully created or restored');
            }
        });

        db.run(`CREATE TABLE IF NOT EXISTS mensajes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chatId INTEGER,
            text TEXT NOT NULL,
            isMine BOOLEAN NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            isRead BOOLEAN DEFAULT 1,
            isImage BOOLEAN DEFAULT 0,
            isAudio BOOLEAN DEFAULT 0,
            isSticker BOOLEAN DEFAULT 0,
            altName TEXT,
            FOREIGN KEY (chatId) REFERENCES chat (id) ON DELETE CASCADE
        )`, (err) => {
            if (err) {
                console.error(err.message);
            } else {
                console.log('"Messages" table successfully created or restored');
            }
        });
    });
}

function getMessages(chatName, callback) {
    db.serialize(() => {
        db.get(`SELECT id FROM chat WHERE nombre = ?`, [chatName], (err, row) => {
            if (err) {
                console.error(err.message);
                return;
            }

            if (!row) {
                console.log('Chat not found');
                return;
            }

            const chatId = row.id;

            db.all(`SELECT * FROM mensajes WHERE chatId = ? LIMIT 45`, [chatId], (err, msgs) => {
                if (err) {
                    console.error(err.message);
                    callback(err, null);
                    return;
                }

                const finalList = msgs.map((msg) => ({
                    msgId: msg.id,
                    text: msg.text,
                    isMine: msg.isMine,
                    isRead: msg.isRead,
                    isImage: msg.isImage,
                    isAudio: msg.isAudio,
                    isSticker: msg.isSticker,
                    altName: msg.altName,
                    timestamp: msg.timestamp
                }));

                callback(null, finalList);

            });
        });
    });
}

function markMessagesAsRead(chatName, callback) {
    db.serialize(() => {
        db.get(`SELECT id FROM chat WHERE nombre = ?`, [chatName], (err, row) => {
            if (err) {
                console.error(err.message);
                return callback(err);
            }

            if (!row) {
                return callback(null, false);
            }

            const chatId = row.id;

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                db.run(`UPDATE mensajes SET isRead = true WHERE chatId = ? AND isRead = false`, [chatId], (err) => {
                    if (err) {
                        console.error("Error marking messages as read:", err.message);
                        db.run('ROLLBACK');
                        return callback(err);
                    }

                    db.run('COMMIT', (err) => {
                        if (err) {
                            console.error("Error during commit:", err.message);
                            return callback(err);
                        }
                        return callback(null, true);
                    });
                });
            });
        });
    });
}

function getUnreads(callback) {
    db.serialize(() => {

        const query = `
            SELECT m.id AS msgId, m.text, m.isMine, m.isRead, m.timestamp, c.nombre AS chatName
            FROM mensajes m
            JOIN chat c ON m.chatId = c.id
            WHERE m.isRead = false
            GROUP BY m.chatId
            HAVING MAX(m.timestamp)
            ORDER BY m.timestamp DESC;
        `;

        db.all(query, (err, rows) => {
            if (err) {
                console.error(err.message);
                return callback(err);
            }

            const unreadChats = rows.map(msg => ({
                msgId: msg.msgId,
                text: msg.text,
                isMine: msg.isMine,
                isRead: msg.isRead,
                timestamp: msg.timestamp,
                chatName: msg.chatName
            }));

            callback(null, unreadChats);
        });
    });
}

function addMsg({ chatName, text, isMine = false, isRead = false, isImage = false, isAudio = false, isSticker = false, altName = undefined }) {
    if (text.length > 0) {
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            db.get(`SELECT id FROM chat WHERE nombre = ?`, [chatName], (err, row) => {
                if (err) {
                    console.error(err.message);
                    db.run('ROLLBACK');
                    return;
                }

                let chatId;

                if (row) {
                    chatId = row.id;
                    insertMessage(chatId);
                } else {
                    db.run(`INSERT INTO chat (nombre) VALUES (?)`, [chatName], function (err) {
                        if (err) {
                            console.error(err.message);
                            db.run('ROLLBACK');
                            return;
                        }
                        chatId = this.lastID;
                        insertMessage(chatId);
                    });
                }

                function insertMessage(chatId) {
                    db.run(`INSERT INTO mensajes (chatId, text, isMine, isRead, isImage, isAudio, isSticker, altName) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [chatId, text, isMine, isRead, isImage, isAudio, isSticker, altName], (err) => {
                            if (err) {
                                console.error(err.message);
                                db.run('ROLLBACK');
                                return;
                            }
                            db.run('COMMIT');
                            console.log(`Inserted ${text} (Mine: ${isMine}, Read: ${isRead})`)
                        });
                }
            });
        });
    }
}

module.exports = {
    createDatabaseIfNeeded,
    getMessages,
    markMessagesAsRead,
    getUnreads,
    addMsg
};