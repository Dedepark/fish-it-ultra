import { formatMoney, RARITY_ORDER, FISH_MASTER } from '../config.js';
import { GameStateManager } from './GameStateManager.js';
import { DatabaseManager } from './DatabaseManager.js';
import { UIManager } from './UIManager.js';

// --- DEFINISI MAP WARNA GLOBAL (FIX: RARE=PINK, EPIC=BIRU) ---
const RARITY_COLORS = {
    'ASTRAL': '#00d2ff', // Neon Blue
    'MISTIS': '#ff0000', // Red
    'LEGENDARY': '#ffea00', // Gold/Yellow
    'EPIC': '#00b4d8',    // FIX: Biru/Cyan
    'RARE': '#f72585',    // FIXED: Pink/Ungu
    'COMMON': '#ecf0f1' 
};
// -------------------------------------------------------------

export const ChatManager = {
    chatChannel: null,
    
    init: function() {
        const chatInput = document.getElementById('chat-input');
        const sendButton = chatInput.nextElementSibling;
        
        // 1. Klik Tombol Pesawat
        sendButton.addEventListener('click', () => { this.sendMessage(); });
        
        // 2. Tekan ENTER di Keyboard (PC UX yang Lebih Responsif)
        // Kita ganti 'keypress' jadi 'keydown' supaya lebih cepat dan mencegah glitch
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault(); // Mencegah enter bikin baris baru
                this.sendMessage();
                chatInput.focus(); // Balikin kursor ke input biar bisa ngetik lagi
            }
        });
        
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
                    // Pesan baru masuk -> Bukan History -> Hitung Notif
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
            
            // Render pesan lama (History)
            this.renderChatMessages(messages); 
        }
    },
    
    renderChatMessages(messages) {
        const container = document.getElementById('chat-messages');
        container.style.visibility = 'hidden';
        container.innerHTML = '';
        
        messages.forEach(message => { 
            // isHistorical = true (JANGAN HITUNG NOTIFIKASI)
            this.addMessageToChat(message, true); 
        });
        
        const lastMessage = container.lastElementChild;
        if (lastMessage) lastMessage.scrollIntoView({ behavior: 'instant' });
        container.style.visibility = 'visible';
    },
    
    addMessageToChat(message, isHistorical = false) {
        // Abaikan notifikasi ASTRAL di chat biasa (sudah ada notifikasi global)
        if (message.message.includes('mendapatkan ikan langka ASTRAL')) {
            return;
        }

        const container = document.getElementById('chat-messages');
        const isMe = message.user_id === GameStateManager.state.user.id;
        const isSystem = message.username === 'SISTEM';
        
        const messageRow = document.createElement('div');
        messageRow.className = `chat-row ${isMe && !isSystem ? 'row-me' : 'row-other'}`;
        
        const messageBubble = document.createElement('div');
        messageBubble.className = `chat-bubble ${isMe && !isSystem ? 'bubble-me' : 'bubble-other'} ${isSystem ? 'system-bubble' : ''}`;

        if (!isMe && !isSystem) {
            messageBubble.style.cursor = 'pointer';
            messageBubble.addEventListener('click', () => {
                UIManager.viewOtherUserProfile(message.user_id, message.username);
            });
        }
        
        // Pola deteksi Pesan Share Ikan (Format: Saya dapat Ikan X (RARITY Y)!)
        const fishShareMatch = message.message.match(/Saya dapat (.+) \((.+)\)!/);
        const giveMatch = isSystem && message.message.match(/PENGIRIM:(.+)\|PENERIMA:(.+)\|IKAN:(.+)\|RARITY:(.+)/);
        
        if (giveMatch) {
             // 1. Logika PESAN SISTEM (KIRIM IKAN)
             const sender = giveMatch[1];
             const target = giveMatch[2];
             const fishName = giveMatch[3];
             const fishRarity = giveMatch[4];
             
             const originalFishData = FISH_MASTER[fishRarity]?.find(f => f.name === fishName);
             const cssClass = originalFishData ? originalFishData.class : `fish-${fishRarity.toLowerCase()}`;
             const price = originalFishData ? formatMoney(originalFishData.price) : '???';
             const fishColor = RARITY_COLORS[fishRarity] || 'inherit';

             messageBubble.classList.add('system-bubble');
             messageBubble.innerHTML = `
                 <div class="chat-meta">[SISTEM] HADIAH IKAN</div>
                 <div>
                     <span style="color:#00e5ff;font-weight:bold;">${sender}</span> mengirim hadiah ke <span style="color:#00e5ff;font-weight:bold;">${target}</span>!
                 </div>
                 <div class="chat-shared-card ${cssClass}" style="margin-top:5px;">
                    <i class="fa-solid fa-fish"></i>
                    <div>
                        <div style="font-weight:bold; color:${fishColor};">${fishName}</div>
                        <div style="font-size:0.8rem;">${fishRarity} - ${price}</div>
                    </div>
                 </div>
             `;
        } else if (fishShareMatch && !isSystem) {
             // 2. Logika PESAN SHARE IKAN (dari tombol share/catch)
             const fishName = fishShareMatch[1];
             const fishRarity = fishShareMatch[2];
             let fish = null;
             
             // Cari data ikan yang cocok
             for (const rarity of RARITY_ORDER) {
                 const found = FISH_MASTER[rarity]?.find(f => f.name === fishName);
                 if (found) { fish = { ...found, rarity }; break; }
             }

             const cssClass = `fish-${fishRarity.toLowerCase()}`;
             const fishColor = RARITY_COLORS[fishRarity] || 'inherit'; 
             
             let cardContent;
             let displayedFishPrice = fish ? formatMoney(fish.price) : '???';

             if (fish) {
                 // Fish data ditemukan (tampilkan kartu penuh)
                 cardContent = `
                     <div class="chat-shared-card ${cssClass}">
                        <i class="fa-solid fa-fish"></i>
                        <div>
                            <div style="font-weight:bold; color:${fishColor};">${fishName}</div>
                            <div style="font-size:0.8rem;">${fishRarity} - ${displayedFishPrice}</div>
                        </div>
                     </div>
                 `;
             } else {
                 // Fish data tidak ditemukan (fallback ke kartu sederhana)
                 cardContent = `
                     <div class="chat-shared-card ${cssClass}">
                        <i class="fa-solid fa-fish"></i>
                        <div>
                            <div style="font-weight:bold; color:${fishColor};">${fishName}</div>
                            <div style="font-size:0.8rem;">${fishRarity} - ???</div>
                        </div>
                     </div>
                 `;
             }

             // FIXED: Menghapus class rarity pada messageBubble agar styling ASTRAL tidak merusak bubble.
             
             // FIXED: Memastikan innerHTML hanya menampilkan pesan yang diinginkan.
             messageBubble.innerHTML = `
                 <div class="chat-meta">${message.username}</div>
                 <div>Dapat ikan baru!</div> 
                 ${cardContent}
             `;
             
        } else {
            // 3. Logika PESAN SEDERHANA (salam bro, dll)
            messageBubble.innerHTML = `
                <div class="chat-meta">${message.username}</div>
                <div>${message.message}</div>
            `;
        }
        
        messageRow.appendChild(messageBubble);
        // FIXED: Memastikan yang dimasukkan ke container adalah messageRow, bukan messageBubble
        container.appendChild(messageRow);
        
        // Auto-scroll ke bawah jika sudah dekat bagian bawah
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 100) {
            container.scrollTop = container.scrollHeight;
        }
        
        // Logika Notifikasi
        if (document.getElementById('panel-chat').classList.contains('hidden') && !isHistorical) {
            GameStateManager.state.unreadChatCount++;
            UIManager.updateChatBadge(GameStateManager.state.unreadChatCount);
        }
    },
    
    handleNewMessage(message) {
        if (!GameStateManager.state.chatMessagesLoaded) return;
        
        if (!GameStateManager.state.lastChatMessageId || message.id > GameStateManager.state.lastChatMessageId) {
            GameStateManager.state.lastChatMessageId = message.id;
            
            // Pesan Live -> isHistorical = false (Hitung Notif!)
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
        
        // Optimistic UI: Bersihkan input duluan biar terasa cepat
        if (!customMessage) input.value = '';

        await DatabaseManager.sendChatMessage(
            GameStateManager.state.user.id,
            GameStateManager.state.username,
            message
        );
    },
    
    async broadcastAstralCatch(username, fishName) {
        // MENGGUNAKAN &nbsp; UNTUK MEMASTIKAN SPASI MUNCUL DI RUNNING TEXT GLOBAL
        const message = `[SISTEM]&nbsp;<span style="color:#00d2ff;font-weight:bold;">${username}</span> mendapatkan ikan langka ASTRAL <span style="color:#ff0055;font-weight:bold;">${fishName}</span>!`;
        await DatabaseManager.sendChatMessage(
            GameStateManager.state.user.id,
            'SISTEM',
            message
        );
    },
    
    showSystemNotification(message) {
        const container = document.getElementById('global-notification-container');
        
        let bannerContent = message; 
        
        const giveMatch = message.match(/PENGIRIM:(.+)\|PENERIMA:(.+)\|IKAN:(.+)\|RARITY:(.+)/);

        if (giveMatch) {
            // Logika GIVE FISH
            const sender = giveMatch[1];
            const target = giveMatch[2];
            const fishName = giveMatch[3];
            const fishRarity = giveMatch[4]; 
            
            const fishColor = RARITY_COLORS[fishRarity] || '#ecf0f1'; 
            
            // FIX TOTAL: Mewarnai SETIAP KATA!
            bannerContent = `[SISTEM]&nbsp;<span style="color:#00d2ff;font-weight:bold;">${sender}</span>&nbsp;<span style="color:#ecf0f1 !important;">mengirim</span>&nbsp;<span style="color:${fishColor} !important;font-weight:bold;">${fishName}</span>&nbsp;<span style="color:#ecf0f1 !important;">kepada</span>&nbsp;<span style="color:#00d2ff;font-weight:bold;">${target}</span>!`;
        
        } else if (message.includes('[SISTEM]')) {
             // Logika ASTRAL CATCH (atau SISTEM lainnya)
             // Menghilangkan warna hijau yang salah pada pesan ASTRAL:
             bannerContent = message.replace('mendapatkan ikan langka ASTRAL', 'mendapatkan ikan langka ASTRAL ');
             bannerContent = bannerContent.replace('[SISTEM]', '[SISTEM]&nbsp;');

             // Mengganti warna merah ASTRAL yang lama dengan !important
             bannerContent = bannerContent.replace('#ff0055', '#ff0055 !important');
             
             // Tambahkan warna putih untuk teks statis di pesan ASTRAL
             if (bannerContent.includes('mendapatkan')) {
                const usernameSpan = bannerContent.match(/<span style="color:#00d2ff;font-weight:bold;">.*?<\/span>/)[0];
                const fishNameSpan = bannerContent.match(/<span style="color:#ff0055 !important;font-weight:bold;">.*?<\/span>/)[0];
                
                bannerContent = `[SISTEM]&nbsp;${usernameSpan}&nbsp;<span style="color:#ecf0f1 !important;">mendapatkan ikan langka ASTRAL</span>&nbsp;${fishNameSpan}!`;
             }
        }
        
        if (!container) return; 
        
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