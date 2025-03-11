# whatsgramV2

whatsgramV2 is a Node.js application that integrates WhatsApp Web automation with Telegram Bot. This bot allows users to interact with their WhatsApp contacts and groups via a Telegram Bot interface, allowing message forwarding, media sharing, and group message management.

## Features

- Send and receive WhatsApp messages from Telegram
- Forward media files (images, audio, stickers) between WhatsApp and Telegram
- Check unread messages and reply to them
- Interact with WhatsApp groups from Telegram

## Requirements

- Node.js (v18.17.0 or higher)
- npm
- A valid WhatsApp number to log in to WhatsApp Web
- A Telegram bot token (can be created via BotFather in Telegram)

## Explanation

This project uses a **headless browser** (invisible Chrome session) powered by **ChromeDriver** to interact with WhatsApp Web. The bot essentially automates a WhatsApp Web session by reading and sending messages through this hidden browser instance. 

## How it works:

1. **Launch ChromeDriver**: When you run the bot, it automatically launches an instance of Chrome in the background (headless mode). 
   
2. **Navigate to WhatsApp Web**: The bot navigates to the WhatsApp Web login page, where it requests a QR code for login.
   
3. **Maintain Active Session**: After scanning the QR code from your phone, the bot keeps the session active. It stays logged in to WhatsApp Web and can send/receive messages on your behalf, mimicking the behavior of a normal user on the browser version of WhatsApp.

This enables the bot to continuously monitor your WhatsApp messages and interact with contacts, groups, or other entities in real-time.


## Installation

1. Clone the repository:
	```bash
	git clone https://github.com/yourusername/whatsgramV2.git
	cd whatsgramV2
	```

2. Install the required dependencies:
	```bash
	npm install
	```

3. Create a .env file in the root of your project with the following variable:
	```bash
	TOKEN="<Your Telegram Bot Token>"
	```

4. Run the project:

	Install forever globally:
	```
	npm install -g forever
	```

	Then, to start the bot with forever, use:
	```
	forever start src/main.js
	```

	This will ensure that the bot keeps running in the background, even if the terminal session closes or the process crashes.

	To see all the processes currently managed by `forever`, run the following command:
	```
	forever list
	```

	To stop the bot with forever, use:
	```
	forever stop <proccess_id>
	```
	The proccess id can be seen with `forever list`

## Linking WhatsApp with the Bot

Once the process is running, you need to link your WhatsApp account to the bot. Follow these steps:

1. **View the Logs:**  
	After starting the process with `forever`, use the following command to view the logs and see the QR code that needs to be scanned:
	```bash
   	forever logs <process_id> -f
	```

2. **Scan the QR Code:**  
	Open WhatsApp on your mobile device.
	Go to the menu and select Linked devices.
	Click on Link a device and scan the QR code displayed in your terminal logs.

<br/>
Once the QR code is scanned and verified, your WhatsApp account will be linked to the bot, allowing it to send and receive messages on your behalf.

## Bot Usage

This bot offers several commands to interact with your WhatsApp contacts and groups. Below is a detailed explanation of each command:

### `/start`
- **Usage**: This command is mandatory to initialize the bot and start interacting with WhatsApp. 
- **Important**: It is highly recommended to check the logs and wait for the message "Client is ready!" before sending the `/start` command.
- **Note**: WhatsApp groups are not immediately available upon starting the bot. It can take about 2-3 minutes for the groups to fully load. If you receive a message from a group during this time, the bot will save it, but you will not be able to select that group as the active chat until the loading period completes.

### `/w contactName`
- **Usage**: Switch to a chat with a specific contact.
- If you enter the exact name of the contact, the bot will automatically switch to that chat and notify you that the switch was successful.
- If you type only part of the contact name (at least two letters), the bot will show you a list of contact suggestions that match what you typed.

### `/g groupName`
- **Usage**: Switch to a group chat.
- This command works similarly to `/w`. If you enter the full group name, the bot will switch to that group. If you only type part of the name (at least two letters), the bot will provide a list of matching group suggestions.

### `/u`
- **Usage**: Display a list of all unread chats. This command helps you quickly check which contacts or groups have new messages waiting for you.

### `/restart`
- **Usage**: Reload contacts or groups in case a new contact or group has been added. This is useful if you've added a new contact or joined a group after the bot was started, and you want to refresh the available list.

## Deployment Note

This bot must be deployed on a server environment such as a Raspberry Pi or similar. It cannot run directly from your local machine unless it stays continuously online. Below are some key limitations to keep in mind:

1. **Server Requirement**: The bot needs to be running on a server, like a Raspberry Pi, for continuous operation. If the server goes offline, the bot will stop functioning.

2. **WhatsApp Web Dependency**: The bot relies on WhatsApp Web and requires a mobile device with an active WhatsApp account. You will need to scan the QR code using the **Link Device** option in WhatsApp on your phone to connect the bot to your WhatsApp account.

3. **Contacts on Original WhatsApp Account**: The bot only has access to the contacts and groups that are available in the original WhatsApp account on your phone. Any new contact or group must be added to your mobile device's WhatsApp for the bot to interact with them.