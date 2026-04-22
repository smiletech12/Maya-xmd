/*
 Give credits to Kevin dev
 Contact me at 256742932677
 Base creator and pterodactyl panels seller.
 
 Complete JUNE-X Bot - Full Version
 © 2025 supreme
*/

process.on("uncaughtException", (err) => {
    console.error("Caught exception:", err);
});

console.clear();
console.log('🚀 Starting ＭＡＹＡ - ＸＭＤ Complete Edition...');

// ==================== REQUIREMENTS ====================
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    Browsers,
    jidDecode, 
    generateForwardMessageContent,
    generateWAMessageFromContent,
    downloadContentFromMessage,
    fetchLatestBaileysVersion,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    getContentType,
    proto
} = require("@whiskeysockets/baileys");

const pino = require('pino');
const chalk = require('chalk');
const readline = require("readline");
const express = require('express');
const app = express();
const fs = require('fs');
const NodeCache = require('node-cache');
const FileType = require('file-type');
const { File } = require('megajs');
const path = require('path');
const os = require('os');
const moment = require('moment-timezone');
const axios = require('axios');
const { Boom } = require('@hapi/boom');
const phoneNumber = require('awesome-phonenumber');
const { exec, spawn, execSync } = require('child_process');

// ==================== LOCAL MODULES ====================
const settings = require('./settings');
const { smsg, getBuffer, runtime, sleep, fetchJson } = require('./start/lib/myfunction');
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./start/lib/exif');
const PluginManager = require('./start/lib/PluginManager');
const { color } = require('./start/lib/color');
const db = require('./start/Core/databaseManager');
const { handleStatusUpdate } = require('./start/supreme');
const { makeInMemoryStore } = require("./start/lib/store/");

// ==================== CONFIGURATION ====================
const port = process.env.PORT || 3000;
const timezones = global.timezones || settings.timezone || "Africa/Kampala";
const msgRetryCounterCache = new NodeCache();
const sessionDir = path.join(__dirname, 'sessions');
const credsPath = path.join(sessionDir, 'creds.json');
const loginFile = path.join(sessionDir, 'login.json');
const MESSAGE_STORE_FILE = path.join(__dirname, 'message_backup.json');
const SESSION_ERROR_FILE = path.join(__dirname, 'sessionErrorCount.json');

// ==================== GLOBAL VARIABLES ====================
global.isBotConnected = false;
global.errorRetryCount = 0;
global.botname = settings.botname || "ＭＡＹＡ - ＸＭＤ";
global.themeemoji = "•";
global.wm = settings.wm || "© ＭＡＹＡ - ＸＭＤ";
global.prefix = settings.prefix || ".";
global.messageBackup = {};
global.recentCallers = new Map();
global.pluginManager = null;

// ==================== LOGGING FUNCTION ====================
function log(message, type = 'info') {
    const colors = {
        info: chalk.cyan || chalk.blue,
        success: chalk.green,
        error: chalk.red,
        warn: chalk.yellow,
        auth: chalk.magenta,
        conn: chalk.cyan,
        system: chalk.white || chalk.gray
    };
    
    const prefixes = {
        info: '📌',
        success: '✅',
        error: '❌',
        warn: '⚠️',
        auth: '🔐',
        conn: '📡',
        system: '⚙️'
    };
    
    const timestamp = moment().tz(timezones).format('HH:mm:ss');
    const colorFn = colors[type] || ((msg) => msg);
    console.log(`[${timestamp}] ${prefixes[type]} ${colorFn(message)}`);
}

// ==================== STORE SETUP ====================
const store = makeInMemoryStore({
    logger: pino().child({ level: 'silent', stream: 'store' })
});

// ==================== QUESTION HELPER ====================
const question = (text) => {
    const rl = readline.createInterface({ 
        input: process.stdin, 
        output: process.stdout 
    });
    return new Promise((resolve) => {
        rl.question(text, (ans) => {
            rl.close();
            resolve(ans);
        });
    });
}

// ==================== SESSION MANAGEMENT ====================
function sessionExists() {
    return fs.existsSync(credsPath);
}

function clearSessionFiles() {
    try {
        log('Clearing session folder...', 'warn');
        if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true });
        }
        if (fs.existsSync(loginFile)) fs.unlinkSync(loginFile);
        if (fs.existsSync(SESSION_ERROR_FILE)) fs.unlinkSync(SESSION_ERROR_FILE);
        global.errorRetryCount = 0;
        log('Session files cleaned successfully', 'success');
    } catch (e) {
        log(`Failed to clear session: ${e.message}`, 'error');
    }
}

async function saveLoginMethod(method) {
    await fs.promises.mkdir(sessionDir, { recursive: true });
    await fs.promises.writeFile(loginFile, JSON.stringify({ method, timestamp: Date.now() }, null, 2));
}

function loadErrorCount() {
    try {
        if (fs.existsSync(SESSION_ERROR_FILE)) {
            const data = fs.readFileSync(SESSION_ERROR_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        log(`Error loading error count: ${error.message}`, 'error');
    }
    return { count: 0, last_error_timestamp: 0 };
}

function saveErrorCount(data) {
    try {
        fs.writeFileSync(SESSION_ERROR_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        log(`Error saving error count: ${error.message}`, 'error');
    }
}

async function loadSessionFromId() {
    try {
        if (!settings.SESSION_ID) {
            log('No SESSION_ID provided', 'info');
            return false;
        }

        log('Loading session from SESSION_ID...', 'auth');
        
        await fs.promises.mkdir(sessionDir, { recursive: true });
        
        // Handle MEGA.nz links
        if (settings.SESSION_ID.includes('mega.nz')) {
            log('Downloading from MEGA.nz...', 'auth');
            const megaFileId = settings.SESSION_ID.split('/').pop();
            const file = File.fromURL(`https://mega.nz/file/${megaFileId}`);
            
            const data = await new Promise((resolve, reject) => {
                file.download((err, data) => {
                    if (err) reject(err);
                    else resolve(data);
                });
            });
            
            fs.writeFileSync(credsPath, data);
            log('MEGA session loaded successfully', 'success');
            return true;
        }
        
        // Handle base64 sessions
        const sessionMatch = settings.SESSION_ID.match(/(?:MAYA~)?(.+)/);
        if (sessionMatch) {
            const base64Data = sessionMatch[1];
            const sessionData = Buffer.from(base64Data, 'base64');
            
            // Verify it's valid JSON
            JSON.parse(sessionData.toString());
            fs.writeFileSync(credsPath, sessionData);
            log('Base64 session loaded successfully', 'success');
            return true;
        }
        
        return false;
    } catch (error) {
        log(`Failed to load session: ${error.message}`, 'error');
        return false;
    }
}

async function handle408Error(statusCode) {
    if (statusCode !== DisconnectReason.timedOut) return false;
    
    global.errorRetryCount++;
    let errorState = loadErrorCount();
    const MAX_RETRIES = 3;
    
    errorState.count = global.errorRetryCount;
    errorState.last_error_timestamp = Date.now();
    saveErrorCount(errorState);

    log(`Connection timeout. Retry: ${global.errorRetryCount}/${MAX_RETRIES}`, 'warn');
    
    if (global.errorRetryCount >= MAX_RETRIES) {
        log('Max retries reached. Exiting...', 'error');
        global.errorRetryCount = 0;
        await sleep(5000);
        process.exit(1);
    }
    return true;
}

// ==================== MESSAGE BACKUP ====================
function loadStoredMessages() {
    try {
        if (fs.existsSync(MESSAGE_STORE_FILE)) {
            const data = fs.readFileSync(MESSAGE_STORE_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        log(`Error loading message backup: ${error.message}`, 'error');
    }
    return {};
}

function saveStoredMessages(data) {
    try {
        fs.writeFileSync(MESSAGE_STORE_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        log(`Error saving message backup: ${error.message}`, 'error');
    }
}

function cleanupOldMessages() {
    let storedMessages = loadStoredMessages();
    let now = Math.floor(Date.now() / 1000);
    const maxMessageAge = 24 * 60 * 60;
    let cleanedMessages = {};
    
    for (let chatId in storedMessages) {
        let newChatMessages = {};
        for (let messageId in storedMessages[chatId]) {
            let message = storedMessages[chatId][messageId];
            if (now - message.timestamp <= maxMessageAge) {
                newChatMessages[messageId] = message;
            }
        }
        if (Object.keys(newChatMessages).length > 0) {
            cleanedMessages[chatId] = newChatMessages;
        }
    }
    saveStoredMessages(cleanedMessages);
    log('Old messages cleaned from backup', 'system');
}

// ==================== CLEANUP FUNCTIONS ====================
function cleanupJunkFiles(sock) {
    const tmpDir = path.join(__dirname, 'tmp');
    if (!fs.existsSync(tmpDir)) return;
    
    fs.readdir(tmpDir, (err, files) => {
        if (err) return;
        
        const junkFiles = files.filter(item =>
            item.endsWith(".gif") || item.endsWith(".png") || 
            item.endsWith(".mp3") || item.endsWith(".mp4") || 
            item.endsWith(".opus") || item.endsWith(".jpg") ||
            item.endsWith(".webp") || item.endsWith(".webm") || 
            item.endsWith(".zip") || item.endsWith(".pdf")
        );
        
        if (junkFiles.length > 0) {
            junkFiles.forEach(file => {
                const filePath = path.join(tmpDir, file);
                try { fs.unlinkSync(filePath); } catch (e) {}
            });
            log(`Cleaned ${junkFiles.length} junk files`, 'system');
        }
    });
}

function createRequiredFolders() {
    const folders = ['tmp', 'assets', 'database', 'sessions'];
    folders.forEach(folder => {
        const folderPath = path.join(__dirname, folder);
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
            log(`Created folder: ${folder}`, 'system');
        }
    });
}

// ==================== PLATFORM DETECTION ====================
function detectPlatform() {
    if (process.env.DYNO) return "Heroku";
    if (process.env.RENDER) return "Render";
    if (process.env.P_SERVER_UUID) return "Panel";
    if (os.platform() === "win32") return "Windows";
    if (os.platform() === "darwin") return "macOS";
    if (os.platform() === "linux") return "Linux";
    return "Unknown";
}

// ==================== PLUGIN LOADER ====================
async function loadAllPlugins() {
    try {
        const pluginManager = new PluginManager();
        const pluginsDir = path.join(__dirname, 'Plugins');
        
        if (!fs.existsSync(pluginsDir)) {
            fs.mkdirSync(pluginsDir, { recursive: true });
            log('Created plugins directory', 'system');
        }
        
        const count = pluginManager.loadPlugins(pluginsDir);
        log(`Loaded ${count} plugins`, 'success');
        global.pluginManager = pluginManager;
        return count;
    } catch (error) {
        log(`Plugin error: ${error.message}`, 'error');
        return 0;
    }
}

// ==================== PAIRING HANDLER ====================
async function handlePairing(sock) {
    log('='.repeat(50), 'auth');
    log('PHONE NUMBER PAIRING', 'auth');
    log('='.repeat(50), 'auth');
    console.log('');
    
    const phoneNumber = await question('📱 Enter your WhatsApp number (with country code): ');
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    
    if (cleanNumber.length < 10) {
        log('Invalid number! Must include country code', 'error');
        process.exit(1);
    }
    
    log('Requesting pairing code...', 'auth');
    
    try {
        const code = await sock.requestPairingCode(cleanNumber);
        const formattedCode = code.match(/.{1,4}/g)?.join(' ') || code;
        
        console.log('');
        log('='.repeat(50), 'success');
        log(`CODE: ${formattedCode}`, 'success');
        log('='.repeat(50), 'success');
        console.log('');
        
        log('Instructions:', 'info');
        log('1. Open WhatsApp on your phone', 'info');
        log('2. Go to Linked Devices', 'info');
        log('3. Tap "Link a Device"', 'info');
        log('4. Enter the code above', 'info');
        console.log('');
        
        log('Waiting for connection...', 'auth');
        await saveLoginMethod('pairing');
        
    } catch (error) {
        log(`Pairing failed: ${error.message}`, 'error');
        process.exit(1);
    }
}

// ==================== WELCOME MESSAGE ====================
async function sendWelcomeMessage(sock) {
    if (global.isBotConnected) return;
    
    await sleep(5000);
    if (!sock.user || global.isBotConnected) return;

    global.isBotConnected = true;
    const platform = detectPlatform();
    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    
    try {
        const welcomeMsg = `
╭─❖ *${global.botname}* ❖─╮
│
├─❖ *Status:* ✅ ONLINE
├─❖ *Platform:* ${platform}
├─❖ *Mode:* ${sock.public ? 'PUBLIC' : 'PRIVATE'}
├─❖ *Prefix:* [ ${global.prefix} ]
├─❖ *Time:* ${moment().tz(timezones).format('HH:mm:ss')}
├─❖ *Date:* ${moment().tz(timezones).format('DD/MM/YYYY')}
│
╰─❖ *Powered by Mr Smile* ❖─╯

> ${global.wm}`;

        await sock.sendMessage(botJid, { text: welcomeMsg });
        log('Welcome message sent to owner', 'success');
        
        // Auto join group if configured
        if (settings.AUTO_JOIN_GROUP) {
            try {
                const inviteCode = settings.AUTO_JOIN_GROUP.split('/').pop();
                await sock.groupAcceptInvite(inviteCode);
                log('Auto-joined support group', 'success');
            } catch (e) {
                log('Failed to auto-join group', 'warn');
            }
        }
        
    } catch (e) {
        log(`Welcome message error: ${e.message}`, 'error');
    }
}

// ==================== MAIN BOT FUNCTION ====================
async function startBot() {
    log('Initializing ＭＡＹＡ - ＸＭＤ...', 'system');
    
    // Load error count
    global.errorRetryCount = loadErrorCount().count;
    
    // Create required folders
    createRequiredFolders();
    
    // Check for existing session or load from SESSION_ID
    let hasValidSession = sessionExists();
    
    if (!hasValidSession && settings.SESSION_ID) {
        hasValidSession = await loadSessionFromId();
    }
    
    // Load plugins
    await loadAllPlugins();
    
    // Get Baileys version
    const { version } = await fetchLatestBaileysVersion();
    
    // Setup auth
    const { state, saveCreds } = await useMultiFileAuthState('./sessions');
    
    // Create socket
    const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        browser: Browsers.ubuntu('Edge'),
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        getMessage: async (key) => {
            const jid = jidNormalizedUser(key.remoteJid);
            const msg = await store.loadMessage(jid, key.id);
            return msg?.message || "";
        },
        msgRetryCounterCache
    });

    await sleep(500);

    // Bind store
    store.bind(sock.ev);
    
    // Handle authentication
    if (!hasValidSession && !sock.authState.creds.registered) {
        await handlePairing(sock);
    } else {
        log('Using existing session', 'success');
    }
    
    // ========== DECODE JID ==========
    sock.decodeJid = (jid) => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            const decode = jidDecode(jid) || {};
            return decode.user && decode.server && decode.user + '@' + decode.server || jid;
        }
        return jid;
    };
    
    const botNumber = sock.decodeJid(sock.user?.id) || 'default';
    
    // ========== GET PUBLIC/PRIVATE MODE ==========
    const mode = await db.get(botNumber, 'mode', 'public');
    sock.public = mode === 'public';
    
    // ========== MESSAGE HANDLER ==========
    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            // Message backup
            for (const msg of chatUpdate.messages) {
                if (!msg.message) continue;
                const chatId = msg.key.remoteJid;
                const messageId = msg.key.id;
                
                if (!global.messageBackup[chatId]) {
                    global.messageBackup[chatId] = {};
                }
                
                const textMessage = msg.message?.conversation || 
                                   msg.message?.extendedTextMessage?.text || 
                                   msg.message?.imageMessage?.caption || '';
                
                if (textMessage) {
                    const savedMessage = { 
                        sender: msg.key.participant || msg.key.remoteJid, 
                        text: textMessage, 
                        timestamp: msg.messageTimestamp 
                    };
                    
                    if (!global.messageBackup[chatId][messageId]) {
                        global.messageBackup[chatId][messageId] = savedMessage;
                        saveStoredMessages(global.messageBackup);
                    }
                }
            }

            const mek = chatUpdate.messages[0];
            if (!mek.message) return;
            
            // Handle ephemeral messages
            if (Object.keys(mek.message)[0] === 'ephemeralMessage') {
                mek.message = mek.message.ephemeralMessage.message;
            }
            
            // Handle status updates
            if (mek.key?.remoteJid === 'status@broadcast') {
                await handleStatusUpdate(sock, mek);
                return;
            }
            
            // Check if should process
            if (!sock.public && !mek.key.fromMe && chatUpdate.type === 'notify') return;
            
            // Process message
            const m = smsg(sock, mek, store);
            
            // Set message properties
            m.isGroup = m.chat.endsWith('@g.us');
            m.sender = await sock.decodeJid(m.fromMe && sock.user.id || m.participant || m.key.participant || m.chat || '');
            
            if (m.isGroup) {
                m.metadata = await sock.groupMetadata(m.chat).catch(() => ({})) || {};
                const admins = [];
                
                if (m.metadata?.participants) {
                    for (const p of m.metadata.participants) {
                        if (p.admin) {
                            admins.push(p.id);
                        }
                    }
                }
                
                m.admins = admins;
                m.isAdmin = admins.includes(m.sender);
                m.isBotAdmin = admins.includes(botNumber);
                m.participant = m.key.participant || '';
            }
            
            // Call system handler
            require("./system")(sock, m, chatUpdate, store);
            
        } catch (err) {
            console.error('Message error:', err);
        }
    });
    
    // ========== CONTACTS UPDATE ==========
    sock.ev.on('contacts.update', (update) => {
        for (const contact of update) {
            const id = sock.decodeJid(contact.id);
            if (store?.contacts) {
                store.contacts[id] = { id, name: contact.notify };
            }
        }
    });
    
    // ========== CONNECTION UPDATE ==========
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            // QR is disabled, but just in case
            log('QR code received but pairing is disabled', 'warn');
        }
        
        if (connection === 'close') {
            global.isBotConnected = false;
            
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const errorMsg = lastDisconnect?.error?.message || '';
            
            log(`Connection closed: ${statusCode || errorMsg}`, 'warn');
            
            // Check for permanent logout
            if (statusCode === DisconnectReason.loggedOut || errorMsg.includes('logged out')) {
                log('Logged out! Clearing session...', 'error');
                clearSessionFiles();
                await sleep(3000);
                process.exit(1);
            }
            
            // Handle 408 timeout
            const handled = await handle408Error(statusCode);
            if (handled) return;
            
            // Reconnect
            log('Reconnecting in 5 seconds...', 'warn');
            await sleep(5000);
            startBot();
        }
        
        if (connection === 'connecting') {
            log('Connecting to WhatsApp...', 'conn');
        }
        
        if (connection === 'open') {
            log('='.repeat(50), 'success');
            log('BOT CONNECTED SUCCESSFULLY!', 'success');
            log('='.repeat(50), 'success');
            console.log('');
            log(`Bot Number: ${sock.user?.id?.split(':')[0]}`, 'info');
            log(`Bot Name: ${global.botname}`, 'info');
            log(`Mode: ${sock.public ? 'PUBLIC' : 'PRIVATE'}`, 'info');
            log(`Prefix: ${global.prefix}`, 'info');
            console.log('');
            
            // Send welcome message
            await sendWelcomeMessage(sock);
        }
    });
    
    // ========== GROUP PARTICIPANTS UPDATE ==========
    sock.ev.on('group-participants.update', async (update) => {
        try {
            const botId = sock.decodeJid(sock.user.id);
            const welcomeEnabled = await db.isWelcomeEnabled(botId, update.id);
            const adminEventEnabled = await db.get(botId, 'adminevent', false);
            
            if (!welcomeEnabled && !adminEventEnabled) return;
            
            const metadata = await sock.groupMetadata(update.id).catch(() => null);
            if (!metadata) return;
            
            for (const participant of update.participants) {
                if (participant === botId) continue;
                
                const name = participant.split('@')[0];
                const pushName = await sock.getName(participant) || name;
                
                // Welcome/Goodbye
                if (welcomeEnabled) {
                    if (update.action === 'add') {
                        log(`👋 Welcome ${pushName} to ${metadata.subject}`, 'success');
                        
                        // Get profile picture
                        let ppUrl;
                        try {
                            ppUrl = await sock.profilePictureUrl(participant, 'image');
                        } catch {
                            ppUrl = 'https://i.ibb.co/RBx5SQC/avatar-group-large-v2.png';
                        }
                        
                        await sock.sendMessage(update.id, {
                            image: { url: ppUrl },
                            caption: `👋 Welcome @${name} to *${metadata.subject}*\n\nYou are member #${metadata.participants.length}`,
                            mentions: [participant]
                        });
                        
                    } else if (update.action === 'remove') {
                        log(`👋 Goodbye ${pushName} from ${metadata.subject}`, 'warn');
                        
                        await sock.sendMessage(update.id, {
                            text: `👋 Goodbye @${name} from *${metadata.subject}*\n\nRemaining: ${metadata.participants.length} members`,
                            mentions: [participant]
                        });
                    }
                }
                
                // Admin events
                if (adminEventEnabled && update.author) {
                    const author = update.author.split('@')[0];
                    
                    if (update.action === 'promote') {
                        await sock.sendMessage(update.id, {
                            text: `👑 @${author} promoted @${name} to admin`,
                            mentions: [update.author, participant]
                        });
                    }
                    
                    if (update.action === 'demote') {
                        await sock.sendMessage(update.id, {
                            text: `📉 @${author} demoted @${name} from admin`,
                            mentions: [update.author, participant]
                        });
                    }
                }
            }
        } catch (err) {
            console.error('Group event error:', err);
        }
    });
    
    // ========== CALL HANDLER ==========
    sock.ev.on('call', async (calls) => {
        try {
            const botId = sock.decodeJid(sock.user.id);
            const anticall = await db.get(botId, 'anticall', 'off');
            
            if (anticall === 'off') return;
            
            for (const call of calls) {
                const caller = call.from.split('@')[0];
                log(`📞 Call from ${caller} - Action: ${anticall}`, 'warn');
                
                // Check if caller is owner
                const owners = await db.get(botId, 'owners', []);
                const isOwner = owners.some(owner => caller.includes(owner.replace(/[^0-9]/g, '')));
                
                if (isOwner) {
                    log(`Allowing call from owner: ${caller}`, 'info');
                    continue;
                }
                
                // Rate limiting
                const now = Date.now();
                const lastWarn = global.recentCallers?.get(call.from) || 0;
                const cooldown = 30 * 1000;
                
                if (now - lastWarn < cooldown) {
                    try { await sock.rejectCall(call.id, call.from); } catch (e) {}
                    continue;
                }
                
                global.recentCallers.set(call.from, now);
                setTimeout(() => global.recentCallers.delete(call.from), cooldown);
                
                // Send warning
                const warnMsg = anticall === 'block' 
                    ? `🚫 *CALL BLOCKED*\n\nYour call to ${global.botname} has been blocked.\n\n> ${global.wm}`
                    : `🚫 *CALL REJECTED*\n\nPlease don't call the bot. Use messages instead.\n\n> ${global.wm}`;
                
                try {
                    await sock.sendMessage(call.from, { text: warnMsg });
                } catch (e) {}
                
                // Reject/Block
                try {
                    await sock.rejectCall(call.id, call.from);
                    
                    if (anticall === 'block') {
                        await sock.updateBlockStatus(call.from, 'block');
                        log(`Blocked caller: ${caller}`, 'error');
                    }
                } catch (e) {}
            }
        } catch (err) {
            console.error('Call handler error:', err);
        }
    });
    
    // ========== CREDS UPDATE ==========
    sock.ev.on('creds.update', saveCreds);
    
    // ========== UTILITY FUNCTIONS ==========
    
    // Get name
    sock.getName = async (jid, withoutContact = false) => {
        try {
            if (jid.endsWith('@g.us')) {
                const metadata = await sock.groupMetadata(jid).catch(() => null);
                return metadata?.subject || jid.split('@')[0];
            } else {
                const contact = store.contacts[jid];
                return contact?.name || contact?.notify || jid.split('@')[0];
            }
        } catch {
            return jid.split('@')[0];
        }
    };
    
    // Send text
    sock.sendText = (jid, text, quoted = '', options = {}) => {
        return sock.sendMessage(jid, { text, ...options }, { quoted });
    };
    
    // Download and save media
    sock.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
        const quoted = message.msg || message;
        const mime = (message.msg || message).mimetype || '';
        const messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0];

        const stream = await downloadContentFromMessage(quoted, messageType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        const type = await FileType.fromBuffer(buffer);
        const ext = type?.ext || 'bin';
        const trueFileName = attachExtension ? `${filename}.${ext}` : filename;
        const savePath = path.join(__dirname, 'tmp', trueFileName);

        await fs.promises.writeFile(savePath, buffer);
        return savePath;
    };
    
    // Download media as buffer
    sock.downloadMediaMessage = async (message) => {
        const mime = (message.msg || message).mimetype || '';
        const messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0];
        
        const stream = await downloadContentFromMessage(message, messageType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        return buffer;
    };
    
    // Get file
    sock.getFile = async (path, returnAsFilename) => {
        let res, filename;
        const data = Buffer.isBuffer(path) 
            ? path 
            : /^data:.*?\/.*?;base64,/i.test(path) 
                ? Buffer.from(path.split`,`[1], 'base64') 
                : /^https?:\/\//.test(path) 
                    ? await (res = await fetch(path)).buffer() 
                    : fs.existsSync(path) 
                        ? (filename = path, fs.readFileSync(path)) 
                        : Buffer.alloc(0);

        if (!Buffer.isBuffer(data)) throw new TypeError('Result is not a buffer');
        
        const type = await FileType.fromBuffer(data) || { mime: 'application/octet-stream', ext: 'bin' };
        
        if (returnAsFilename && !filename) {
            filename = path.join(__dirname, 'tmp', Date.now() + '.' + type.ext);
            await fs.promises.writeFile(filename, data);
        }
        
        return { res, filename, ...type, data };
    };
    
    // Send file
    sock.sendFile = async (jid, filePath, filename = '', caption = '', quoted, ptt = false, options = {}) => {
        const type = await sock.getFile(filePath, true);
        const { data, filename: pathFile, mime } = type;
        
        let mtype = '';
        let mimetype = mime;
        
        if (/webp/.test(mime) || (/image/.test(mime) && options.asSticker)) mtype = 'sticker';
        else if (/image/.test(mime) || (/webp/.test(mime) && options.asImage)) mtype = 'image';
        else if (/video/.test(mime)) mtype = 'video';
        else if (/audio/.test(mime)) {
            mtype = 'audio';
            mimetype = 'audio/ogg; codecs=opus';
        } else mtype = 'document';
        
        if (options.asDocument) mtype = 'document';
        
        const message = {
            ...options,
            caption,
            ptt,
            [mtype]: { url: pathFile },
            mimetype
        };
        
        return sock.sendMessage(jid, message, { quoted, ...options });
    };
    
    // Send image as sticker
    sock.sendImageAsSticker = async (jid, path, quoted, options = {}) => {
        let buff;
        try {
            buff = Buffer.isBuffer(path)
                ? path
                : /^data:.*?\/.*?;base64,/i.test(path)
                    ? Buffer.from(path.split`,`[1], 'base64')
                    : /^https?:\/\//.test(path)
                        ? await getBuffer(path)
                        : fs.existsSync(path)
                            ? fs.readFileSync(path)
                            : Buffer.alloc(0);
        } catch (e) {
            buff = Buffer.alloc(0);
        }
        
        const buffer = await writeExifImg(buff, options);
        await sock.sendMessage(jid, { sticker: buffer }, { quoted });
        return buffer;
    };
    
    // Send video as sticker
    sock.sendVideoAsSticker = async (jid, path, quoted, options = {}) => {
        let buff;
        try {
            buff = Buffer.isBuffer(path)
                ? path
                : /^data:.*?\/.*?;base64,/i.test(path)
                    ? Buffer.from(path.split`,`[1], 'base64')
                    : /^https?:\/\//.test(path)
                        ? await getBuffer(path)
                        : fs.existsSync(path)
                            ? fs.readFileSync(path)
                            : Buffer.alloc(0);
        } catch (e) {
            buff = Buffer.alloc(0);
        }
        
        const buffer = await writeExifVid(buff, options);
        await sock.sendMessage(jid, { sticker: buffer }, { quoted });
        return buffer;
    };
    
    // Copy and forward
    sock.copyNForward = async (jid, message, forceForward = false, options = {}) => {
        let mtype = Object.keys(message.message)[0];
        let content = await generateForwardMessageContent(message, forceForward);
        let ctype = Object.keys(content)[0];
        let context = {};

        if (mtype != "conversation") {
            context = message.message[mtype].contextInfo;
        }

        content[ctype].contextInfo = {
            ...context,
            ...content[ctype].contextInfo,
        };

        const waMessage = await generateWAMessageFromContent(
            jid,
            content,
            options ? { ...content[ctype], ...options } : {}
        );

        await sock.relayMessage(jid, waMessage.message, { messageId: waMessage.key.id });
        return waMessage;
    };
    
    // ========== CLEANUP INTERVALS ==========
    setInterval(cleanupOldMessages, 60 * 60 * 1000); // 1 hour
    setInterval(() => cleanupJunkFiles(sock), 5 * 60 * 1000); // 5 minutes
    
    // Session cleanup (2 days)
    setInterval(() => {
        try {
            if (!fs.existsSync(sessionDir)) return;
            
            const files = fs.readdirSync(sessionDir);
            const now = Date.now();
            
            files.forEach(file => {
                if (file === 'creds.json') return;
                
                const filePath = path.join(sessionDir, file);
                const stats = fs.statSync(filePath);
                const age = now - stats.mtimeMs;
                
                if (age > 2 * 24 * 60 * 60 * 1000) { // 2 days
                    fs.unlinkSync(filePath);
                    log(`Removed old session file: ${file}`, 'system');
                }
            });
        } catch (e) {
            // Ignore errors
        }
    }, 12 * 60 * 60 * 1000); // 12 hours
    
    return sock;
}

// ==================== EXPRESS SERVER ====================
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

app.get('/', (req, res) => {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>ＭＡＹＡ - ＸＭＤ</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                color: white;
            }
            .container {
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                border-radius: 20px;
                padding: 40px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
                text-align: center;
                max-width: 500px;
                width: 90%;
            }
            h1 {
                font-size: 2.5em;
                margin-bottom: 20px;
            }
            .status {
                background: rgba(255, 255, 255, 0.2);
                padding: 15px;
                border-radius: 10px;
                margin: 20px 0;
            }
            .online {
                color: #4ade80;
                font-weight: bold;
            }
            .info {
                text-align: left;
                margin: 20px 0;
            }
            .info p {
                margin: 10px 0;
                padding: 10px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 5px;
            }
            .footer {
                margin-top: 30px;
                font-size: 0.9em;
                opacity: 0.8;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🤖 ＭＡＹＡ - ＸＭＤ</h1>
            <div class="status">
                <h2>Status: <span class="online">✅ ONLINE</span></h2>
            </div>
            <div class="info">
                <p>⏱️ Uptime: ${runtime(process.uptime())}</p>
                <p>📱 Bot: ${global.botname}</p>
                <p>⚙️ Mode: ${global.isBotConnected ? 'Connected' : 'Starting...'}</p>
                <p>🕒 Time: ${moment().tz(timezones).format('HH:mm:ss')}</p>
                <p>📅 Date: ${moment().tz(timezones).format('DD/MM/YYYY')}</p>
            </div>
            <div class="footer">
                <p>Powered by Mr Smile | Contact: 254107065646</p>
                <p>© 2025 ＭＡＹＡ - ＸＭＤ</p>
            </div>
        </div>
    </body>
    </html>
    `;
    res.send(html);
});

app.get('/uptime', (req, res) => {
    res.json({ 
        uptime: runtime(process.uptime()),
        status: 'online',
        bot: global.botname,
        connected: global.isBotConnected
    });
});

app.listen(port, () => {
    log(`Web server running on port ${port}`, 'info');
    log(`🌐 Visit http://localhost:${port} to view status`, 'info');
});

// ==================== START BOT ====================
startBot().catch(err => {
    log(`Fatal error: ${err.message}`, 'error');
    log(err.stack, 'error');
    process.exit(1);
});

// ==================== PROCESS HANDLERS ====================
process.on('uncaughtException', (err) => {
    log(`Uncaught Exception: ${err.message}`, 'error');
    console.error(err.stack);
});

process.on('unhandledRejection', (err) => {
    log(`Unhandled Rejection: ${err.message}`, 'error');
    console.error(err.stack);
});

process.on('SIGINT', () => {
    log('Received SIGINT. Shutting down...', 'warn');
    process.exit(0);
});

process.on('SIGTERM', () => {
    log('Received SIGTERM. Shutting down...', 'warn');
    process.exit(0);
});

// ==================== FILE WATCHER ====================
const file = require.resolve(__filename);
fs.watchFile(file, () => {
    fs.unwatchFile(file);
    log('File updated. Restarting...', 'warn');
    delete require.cache[file];
    require(file);
});
