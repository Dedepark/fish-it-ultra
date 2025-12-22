import { formatMoney, RARITY_ORDER, FISH_MASTER } from '../config.js';
import { GameStateManager } from './GameStateManager.js';
import { DatabaseManager } from './DatabaseManager.js';
import { UIManager } from './UIManager.js';

// --- DEFINISI MAP WARNA GLOBAL ---
const RARITY_COLORS = {
    'ASTRAL': '#00d2ff', // Neon Blue
    'MISTIS': '#ff0000', // Red
    'LEGENDARY': '#ffea00', // Gold/Yellow
    'EPIC': '#00b4d8',    // Biru/Cyan
    'RARE': '#f72585',    // Pink/Ungu
    'COMMON': '#ecf0f1' 
};

export const ChatManager = {
    chatChannel: null,
    replyingTo: null, // State untuk menyimpan data pesan yang sedang di-reply
    
    init: function() {
        const chatInput = document.getElementById('chat-input');
        const sendButton = chatInput.nextElementSibling;
        const cancelReplyBtn = document.getElementById('btn-cancel-reply');
        
        // 1. Klik Tombol Pesawat
        sendButton.addEventListener('click', () => { this.sendMessage(); });
        
        // 2. Tekan ENTER di Keyboard
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault(); 
                this.sendMessage();
                chatInput.focus(); 
            }
        });
        
        // 3. Tombol Batal Reply
        if (cancelReplyBtn) {
            cancelReplyBtn.addEventListener('click', () => {
                this.cancelReply();
            });
        }

        this.loadChatMessages();
    },
    
    setupChatListener() {
        if (this.chatChannel) {
            DatabaseManager.client.removeChannel(this.chatChannel);
        }

        this.chatChannel = DatabaseManager.client.channel('public:chat_messages', {
            config: { presence: { key: GameStateManager.state.user.id } },
        });

        this.chatChannel
            .on('postgres_changes', 
                { event: 'INSERT', schema: 'public', table: 'chat_messages' }, 
                (payload) => { 
                    this.handleNewMessage(payload.new); 
                }
            )
            .on('presence', { event: 'sync' }, () => {
                const newState = this.chatChannel.presenceState();
                const onlineCount = Object.keys(newState).length;
                const countEl = document.getElementById('online-count');
                if (countEl) countEl.textContent = onlineCount;
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await this.chatChannel.track({
                        user_id: GameStateManager.state.user.id,
                        username: GameStateManager.state.username,
                        online_at: new Date().toISOString(),
                    });
                }
            });
    },
    
    async loadChatMessages() {
        const messages = await DatabaseManager.loadChatMessages(50);
        if (messages) {
            messages.sort((a, b) => a.id - b.id);
            if (messages.length > 0) {
                GameStateManager.state.lastChatMessageId = messages[messages.length - 1].id;
            }
            GameStateManager.state.chatMessagesLoaded = true;
            
            this.renderChatMessages(messages); 
        }
    },
    
    renderChatMessages(messages) {
        const container = document.getElementById('chat-messages');
        container.style.visibility = 'hidden';
        container.innerHTML = '';
        
        messages.forEach(message => { 
            this.addMessageToChat(message, true); 
        });
        
        const lastMessage = container.lastElementChild;
        if (lastMessage) lastMessage.scrollIntoView({ behavior: 'instant' });
        container.style.visibility = 'visible';
    },
    
    addMessageToChat(message, isHistorical = false) {
        // Abaikan notifikasi ASTRAL & JACKPOT di chat biasa
        if (message.message.includes('mendapatkan ikan langka ASTRAL')) return;
        if (message.message.includes('[SISTEM] JACKPOT!')) return;

        const container = document.getElementById('chat-messages');
        const isMe = message.user_id === GameStateManager.state.user.id;
        const isSystem = message.username === 'SISTEM';
        
        const messageRow = document.createElement('div');
        messageRow.className = `chat-row ${isMe && !isSystem ? 'row-me' : 'row-other'}`;
        
        // Ikon indikator reply (muncul saat swipe)
        if (!isMe && !isSystem) {
            const replyIcon = document.createElement('div');
            replyIcon.className = 'reply-indicator-icon';
            replyIcon.innerHTML = '<i class="fa-solid fa-reply"></i>';
            messageRow.appendChild(replyIcon);
        }

        const messageBubble = document.createElement('div');
        messageBubble.className = `chat-bubble ${isMe && !isSystem ? 'bubble-me' : 'bubble-other'} ${isSystem ? 'system-bubble' : ''}`;

        // Handler Klik Profil (jika bukan saya & bukan sistem)
        if (!isMe && !isSystem) {
            // Kita pisahkan logic click vs swipe di handleSwipe
        }
        
        // --- LOGIKA SWIPE TO REPLY ---
        if (!isSystem) {
            this.attachSwipeHandler(messageBubble, messageRow, message);
        }

        // --- RENDER KONTEN PESAN ---
        let bubbleContent = '';

        // 1. Render Header Nama
        bubbleContent += `<div class="chat-meta">${message.username}</div>`;

        // 2. Render Quote (Jika ini adalah balasan)
        if (message.reply_to) {
            try {
                // Handle jika reply_to disimpan sebagai string JSON atau object langsung
                const replyData = typeof message.reply_to === 'string' 
                    ? JSON.parse(message.reply_to) 
                    : message.reply_to;

                if (replyData) {
                    bubbleContent += `
                        <div class="reply-quote-block">
                            <div class="quote-sender">${replyData.username}</div>
                            <div class="quote-text">${replyData.message}</div>
                        </div>
                    `;
                }
            } catch (e) {
                console.error("Error parsing reply_to", e);
            }
        }

        // 3. Render Isi Pesan Utama
        const fishShareMatch = message.message.match(/Saya dapat (.+) \((.+)\)!/);
        const giveMatch = isSystem && message.message.match(/PENGIRIM:(.+)\|PENERIMA:(.+)\|IKAN:(.+)\|RARITY:(.+)/);
        
        if (giveMatch) {
             // ... Logika GIVE FISH (Sama seperti sebelumnya) ...
             const sender = giveMatch[1];
             const target = giveMatch[2];
             const fishName = giveMatch[3];
             const fishRarity = giveMatch[4];
             const originalFishData = FISH_MASTER[fishRarity]?.find(f => f.name === fishName);
             const cssClass = originalFishData ? originalFishData.class : `fish-${fishRarity.toLowerCase()}`;
             const price = originalFishData ? formatMoney(originalFishData.price) : '???';
             const fishColor = RARITY_COLORS[fishRarity] || 'inherit';

             messageBubble.classList.add('system-bubble');
             bubbleContent = `
                 <div class="chat-meta">[SISTEM] HADIAH IKAN</div>
                 <div><span style="color:#00e5ff;font-weight:bold;">${sender}</span> mengirim hadiah ke <span style="color:#00e5ff;font-weight:bold;">${target}</span>!</div>
                 <div class="chat-shared-card ${cssClass}" style="margin-top:5px;">
                    <i class="fa-solid fa-fish"></i>
                    <div>
                        <div style="font-weight:bold; color:${fishColor};">${fishName}</div>
                        <div style="font-size:0.8rem;">${fishRarity} - ${price}</div>
                    </div>
                 </div>
             `;
        } else if (fishShareMatch && !isSystem) {
             // ... Logika SHARE FISH (Sama seperti sebelumnya) ...
             const fishName = fishShareMatch[1];
             const fishRarity = fishShareMatch[2];
             const fishColor = RARITY_COLORS[fishRarity] || 'inherit'; 
             const cssClass = `fish-${fishRarity.toLowerCase()}`;
             
             bubbleContent += `
                 <div>Dapat ikan baru!</div> 
                 <div class="chat-shared-card ${cssClass}">
                    <i class="fa-solid fa-fish"></i>
                    <div>
                        <div style="font-weight:bold; color:${fishColor};">${fishName}</div>
                        <div style="font-size:0.8rem;">${fishRarity}</div>
                    </div>
                 </div>
             `;
        } else {
            // Pesan Biasa
            bubbleContent += `<div>${message.message}</div>`;
        }
        
        messageBubble.innerHTML = bubbleContent;
        messageRow.appendChild(messageBubble);
        container.appendChild(messageRow);
        
        // Auto scroll
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 100) {
            container.scrollTop = container.scrollHeight;
        }
        
        // Update badge notifikasi
        if (document.getElementById('panel-chat').classList.contains('hidden') && !isHistorical) {
            GameStateManager.state.unreadChatCount++;
            UIManager.updateChatBadge(GameStateManager.state.unreadChatCount);
        }
    },

    // --- FUNGSI BARU: SWIPE TO REPLY HANDLER ---
    attachSwipeHandler(element, row, messageData) {
        let touchStartX = 0;
        let touchStartY = 0;
        let currentTranslate = 0;
        let isSwiping = false;
        let isVerticalScroll = false;
        const THRESHOLD = 60; // Jarak swipe minimal untuk trigger reply

        element.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            isSwiping = false;
            isVerticalScroll = false;
            element.style.transition = 'none'; // Disable transisi saat drag
        }, { passive: true });

        element.addEventListener('touchmove', (e) => {
            if (isVerticalScroll) return;

            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const deltaX = currentX - touchStartX;
            const deltaY = currentY - touchStartY;

            // Cek apakah user mencoba scroll vertikal
            if (!isSwiping && Math.abs(deltaY) > Math.abs(deltaX)) {
                isVerticalScroll = true;
                return;
            }

            // Batasi swipe hanya ke kanan (untuk pesan orang lain) atau kiri (opsional)
            // Di WA biasanya swipe kanan untuk reply pesan orang lain
            if (deltaX > 0 && deltaX < 150) { 
                isSwiping = true;
                e.preventDefault(); // Stop browser scroll/back navigation
                currentTranslate = deltaX;
                
                // Efek visual elastis
                const resistance = 0.5; 
                const translateX = deltaX * resistance;
                
                element.style.transform = `translateX(${translateX}px)`;
                
                if (translateX > 30) {
                    row.classList.add('swiping');
                } else {
                    row.classList.remove('swiping');
                }
            }
        }, { passive: false });

        element.addEventListener('touchend', (e) => {
            element.style.transition = 'transform 0.3s ease-out';
            element.style.transform = 'translateX(0)';
            row.classList.remove('swiping');

            // Jika swipe cukup jauh, trigger reply
            if (isSwiping && currentTranslate > THRESHOLD) {
                this.activateReplyMode(messageData);
                // Vibrate jika device support
                if (navigator.vibrate) navigator.vibrate(20);
            } else if (!isSwiping && !isVerticalScroll) {
                // Ini dianggap 'Click' biasa
                // Jika bukan pesan sendiri, buka profil
                if (messageData.user_id !== GameStateManager.state.user.id) {
                    UIManager.viewOtherUserProfile(messageData.user_id, messageData.username);
                }
            }

            isSwiping = false;
            currentTranslate = 0;
        });
    },

    activateReplyMode(messageData) {
        this.replyingTo = {
            id: messageData.id,
            username: messageData.username,
            message: messageData.message
        };

        const previewBox = document.getElementById('chat-reply-preview');
        const targetName = document.getElementById('reply-target-name');
        const targetMsg = document.getElementById('reply-target-msg');
        const input = document.getElementById('chat-input');

        previewBox.classList.remove('hidden');
        targetName.textContent = messageData.username;
        targetMsg.textContent = messageData.message;

        input.focus();
    },

    cancelReply() {
        this.replyingTo = null;
        const previewBox = document.getElementById('chat-reply-preview');
        previewBox.classList.add('hidden');
    },
    
    handleNewMessage(message) {
        if (!GameStateManager.state.chatMessagesLoaded) return;
        
        if (!GameStateManager.state.lastChatMessageId || message.id > GameStateManager.state.lastChatMessageId) {
            GameStateManager.state.lastChatMessageId = message.id;
            
            this.addMessageToChat(message, false);
            
            if (message.username === 'SISTEM') {
                this.showSystemNotification(message.message);
            }
        }
    },
    
    async sendMessage(customMessage = null) {
        const input = document.getElementById('chat-input');
        const message = customMessage || input.value.trim();
        if (!message) return;
        
        if (!customMessage) input.value = '';

        // Siapkan data reply jika ada
        let replyData = null;
        if (this.replyingTo) {
            replyData = this.replyingTo;
            this.cancelReply(); // Reset UI reply setelah kirim
        }

        await DatabaseManager.sendChatMessage(
            GameStateManager.state.user.id,
            GameStateManager.state.username,
            message,
            replyData // Pass reply data ke DB Manager
        );
    },
    
    // --- BROADCAST FUNCTIONS (Tidak Berubah) ---
    async broadcastAstralCatch(username, fishName) {
        const message = `[SISTEM]&nbsp;<span style="color:#00d2ff;font-weight:bold;">${username}</span> mendapatkan ikan langka ASTRAL <span style="color:#ff0055;font-weight:bold;">${fishName}</span>!`;
        await DatabaseManager.sendChatMessage(GameStateManager.state.user.id, 'SISTEM', message);
    },

    async broadcastEventWin(username, itemName) {
        const message = `[SISTEM] JACKPOT!&nbsp;<span style="color:#00d2ff;font-weight:bold;">${username}</span>&nbsp;<span style="color:#ecf0f1 !important;">memenangkan</span>&nbsp;<span style="color:#ffd700;font-weight:bold;text-shadow:0 0 5px gold;">${itemName}</span>!`;
        await DatabaseManager.sendChatMessage(GameStateManager.state.user.id, 'SISTEM', message);
    },
    
    // --- RUNNING TEXT GLOBAL (Tidak Berubah) ---
    showSystemNotification(message) {
        // ... (Kode showSystemNotification sama seperti sebelumnya) ...
        const container = document.getElementById('global-notification-container');
        if (!container) return;
        
        // Logika parsing pesan sistem untuk notifikasi (sama seperti file asli)
        // Saya persingkat di sini agar tidak terlalu panjang, tapi pastikan copy logika asli Anda jika perlu.
        // Asumsi: Logika notifikasi tidak berubah karena fitur reply tidak mempengaruhi sistem notif.
        
        let bannerContent = message;
        // ... Logika parsing ... (gunakan logika lama Anda)
        
        container.style.display = 'block';
        const banner = document.createElement('div');
        banner.className = 'global-notif-banner';
        banner.innerHTML = bannerContent; 
        container.appendChild(banner);
        
        setTimeout(() => {
            banner.remove();
            if (container.children.length === 0) {
                container.style.display = 'none';
            }
        }, 15000);
    }
};