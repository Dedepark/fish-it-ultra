import { SoundManager } from './modules/SoundManager.js';
import { DatabaseManager } from './modules/DatabaseManager.js';
import { GameStateManager } from './modules/GameStateManager.js';
import { AuthenticationManager } from './modules/AuthenticationManager.js';
import { FishingGameLogic } from './modules/FishingGameLogic.js';
import { InventoryManager } from './modules/InventoryManager.js';
import { ShopManager } from './modules/ShopManager.js';
import { UIManager } from './modules/UIManager.js';
import { MissionManager } from './modules/MissionManager.js';
import { EventManager } from './modules/EventManager.js';
import { ChatManager } from './modules/ChatManager.js';
import { CURRENT_APP_VERSION } from './config.js';

// PWA TRAP
window.deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.deferredPrompt = e;
    console.log("✅ Sinyal Install PWA Ditangkap!");
});

window.app = {
    auth: AuthenticationManager,
    fishing: FishingGameLogic,
    inventory: InventoryManager,
    shop: ShopManager,
    mission: MissionManager, // MissionManager diekspos sebagai 'mission'
    event: EventManager,
    chat: ChatManager,
    ui: UIManager,

    login: () => AuthenticationManager.login(),
    register: () => AuthenticationManager.register(),
    logout: () => AuthenticationManager.logout(),
    switchAuthTab: (tab) => AuthenticationManager.switchAuthTab(tab),
    
    handleCastBtn: () => FishingGameLogic.handleCastBtn(),
    toggleAutoFishing: () => FishingGameLogic.toggleAutoFishing(),
    
    nav: (page) => UIManager.nav(page),
    
    showModal: (modalId) => {
        if (modalId === 'modal-settings') {
            document.getElementById('setting-version-text').innerText = `Ver: ${CURRENT_APP_VERSION} | Dev: Zadostrix`;
            const idEl = document.getElementById('setting-player-id');
            if (GameStateManager.state.user) {
                const fullId = GameStateManager.state.user.id;
                idEl.innerText = `ID: ${fullId.substring(0, 8)}...`;
                idEl.dataset.fullId = fullId;
            }
        }
        UIManager.showModal(modalId);
    },
    
    closeModal: (modalId) => UIManager.closeModal(modalId),
    viewProfile: (userId) => UIManager.viewProfile(userId),
    showCustomAlert: (title, message, buttons, type) => UIManager.showCustomAlert(title, message, buttons, type),
    
    // openDailyMissions: () => MissionManager.openDailyMissions(), // Dihapus (Redundant)
    // openDailyLogin: () => MissionManager.openDailyLogin(), // Dihapus (Redundant)
    // openDailyLoginClaim: () => MissionManager.claimDailyLoginLogic(), // Dihapus (Redundant)
    
    // Fungsi-fungsi di atas dipanggil langsung dari app.mission di HTML
    
    switchInvTab: (tab) => InventoryManager.switchInvTab(tab),
    sellAll: () => InventoryManager.sellAll(),
    actionLockFish: () => InventoryManager.actionLockFish(),
    actionShareFish: () => InventoryManager.actionShareFish(),
    
    switchShopTab: (tab) => ShopManager.switchShopTab(tab),
    buyRod: (id) => ShopManager.buyRod(id),
    equipRod: (id) => ShopManager.equipRod(id),
    buyItem: (id, price) => ShopManager.buyItem(id, price),

    closeEnchantModal: () => InventoryManager.closeEnchantModal(),
    openEnchantModal: (rodId) => InventoryManager.openEnchantModal(rodId),
    processEnchantment: (rodId, stoneId) => InventoryManager.processEnchantment(rodId, stoneId),

    openGiveMoneyModal: () => UIManager.openGiveMoneyModal(),
    openGiveFishModal: () => UIManager.openGiveFishModal(),
    processGiveMoney: () => UIManager.processGiveMoney(),
    processGiveFish: () => UIManager.processGiveFish(),
    
    toggleEventSidebar: () => EventManager.toggleEventSidebar(),
    
    sendMessage: () => ChatManager.sendMessage(),
    
    installPWA: async () => {
        if (window.deferredPrompt) {
            window.deferredPrompt.prompt();
            const { outcome } = await window.deferredPrompt.userChoice;
            window.deferredPrompt = null;
            return;
        }

        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
        if (isIOS) {
            UIManager.showCustomAlert(
                "CARA INSTALL (iOS)", 
                "1. Tekan tombol 'Share' (Panah Kotak).\n2. Pilih 'Add to Home Screen'.", 
                [{ text: "SIAP" }]
            );
        } else {
            UIManager.showCustomAlert("INSTALL MANUAL", "Otomatis gagal. Klik menu browser (titik tiga) > Install App.", [{ text: "OK" }]);
        }
    },
    
    manualCheckUpdate: async () => {
        UIManager.showCustomAlert("CEK UPDATE", "Sedang memeriksa...", [], 'info');
        try {
            const { data, error } = await DatabaseManager.client.from('app_config').select('*').eq('id', 1).single();
            UIManager.closeModal('modal-custom-alert');

            if (error || !data) {
                UIManager.showCustomAlert("ERROR", "Gagal koneksi.", [{text:"OK"}]);
                return;
            }

            if (data.latest_version === CURRENT_APP_VERSION) {
                UIManager.showCustomAlert("AMAN", "Versi sudah terbaru.", [{text:"MANTAP"}], 'success');
            } else {
                app.clearAllCaches(); 
            }
        } catch (e) {
            UIManager.closeModal('modal-custom-alert');
        }
    },

    showLatestNews: async () => {
        try {
            const { data } = await DatabaseManager.client.from('app_config').select('news_content, update_message').eq('id', 1).single();
            const msg = (data && data.news_content) ? data.news_content : (data ? data.update_message : "Tidak ada berita.");
            UIManager.showCustomAlert("INFO UPDATE", msg, [{text:"SIAP!"}], 'success');
        } catch(e) {
            console.log(e);
        }
    },

    copyPlayerId: () => {
        const idEl = document.getElementById('setting-player-id');
        const fullId = idEl.dataset.fullId;
        if (fullId) {
            navigator.clipboard.writeText(fullId).then(() => {
                const btn = document.querySelector('.btn-copy-id');
                btn.innerHTML = '<i class="fa-solid fa-check"></i>';
            });
        }
    },

    clearAllCaches: async () => {
        UIManager.showCustomAlert("UPDATE TERSEDIA", "Update sekarang?", [
            { text: "Nanti", isCancel: true },
            {
                text: "GAS",
                isConfirm: true,
                onClick: async () => {
                    if ('caches' in window) {
                        const cacheNames = await caches.keys();
                        await Promise.all(cacheNames.map(name => caches.delete(name)));
                    }
                    if ('serviceWorker' in navigator) {
                        const regs = await navigator.serviceWorker.getRegistrations();
                        for(let reg of regs) await reg.unregister();
                    }
                    window.location.reload(true);
                }
            }
        ]);
    }
};

function hideAllScreens() {
    document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
    const existingBar = document.getElementById('update-bubble');
    if (existingBar) existingBar.remove();
}

function showMaintenanceScreen(msg) {
    hideAllScreens();
    if (document.getElementById('maintenance-overlay')) return;
    const div = document.createElement('div');
    div.id = 'maintenance-overlay';
    div.style.cssText = `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #000; color: #fff; z-index: 999999; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;`;
    div.innerHTML = `<h1>MAINTENANCE</h1><p>${msg}</p>`;
    document.body.appendChild(div);
}

function showUpdateNotification(msg, url) {
    if (document.getElementById('update-bubble')) return;
    
    // Default URL kalau dari database kosong
    const downloadUrl = url || "https://github.com/Dedepark/fish-it-ultra/releases/download/latest/FishIt-Ultra.apk";
    
    const div = document.createElement('div');
    div.id = 'update-bubble';
    div.innerHTML = `
        <div class="update-content">
            <div class="update-header">
                <div class="update-title">UPDATE TERSEDIA!</div>
            </div>
            <div class="update-msg">${msg}</div>
            <button onclick="window.open('${downloadUrl}', '_system')" class="btn-update-comic">
                DOWNLOAD APK
            </button>
        </div>
    `;
    document.body.appendChild(div);
}

async function checkAppVersion() {
    try {
        const { data, error } = await DatabaseManager.client.from('app_config').select('*').eq('id', 1).single();
        if (error || !data) return false;
        
        if (data.is_maintenance) { 
            showMaintenanceScreen(data.update_message); 
            return true; 
        }
        
        // Cek beda versi
        if (data.latest_version !== CURRENT_APP_VERSION) { 
            // Masukin URL dari database ke fungsi notifikasi
            showUpdateNotification(data.update_message, data.download_url); 
        }
        return false; 
    } catch (err) { return false; }
}

function setupVersionListener() {
    DatabaseManager.client.channel('public:app_config')
    .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'app_config', filter: 'id=eq.1' }, 
        (payload) => {
            const newData = payload.new;
            if (newData.is_maintenance) {
                showMaintenanceScreen(newData.update_message);
            }
            else if (newData.latest_version !== CURRENT_APP_VERSION) {
                // Realtime update trigger
                showUpdateNotification(newData.update_message, newData.download_url);
            }
        }
    ).subscribe();
}

const initializeApp = async () => {
    UIManager.showScreen('loading-screen');
    SoundManager.init();
    await DatabaseManager.init();
    
    const isMaintenance = await checkAppVersion();
    setupVersionListener(); 
    if (isMaintenance) return;
    
    const { data: { session } } = await DatabaseManager.getSession();
    
    if (session) {
        await AuthenticationManager.handleLoginSuccess(session.user);
    } else {
        UIManager.showScreen('auth-screen');
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('game-container').classList.add('hidden');
    }
    
    DatabaseManager.client.auth.onAuthStateChange((event, session) => { 
        if (event === 'SIGNED_IN') AuthenticationManager.handleLoginSuccess(session.user); 
    });

    EventManager.init();
    // MissionManager.init() DIPINDAH KE handleLoginSuccess BIAR GAK ERROR
    setInterval(UIManager.updateBuffTimers, 1000);
};

document.addEventListener('DOMContentLoaded', initializeApp);