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
import ThemeManager from './modules/ThemeManager.js'; 
import LeaderboardManager from './modules/LeaderboardManager.js';

// --- 🔥 KODE PEMBUNUH CACHE (UPDATE INI) ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
            registration.unregister().then(() => {
                console.log("💀 Service Worker DIBUNUH. Cache dihapus.");
            });
        }
    });
    if ('caches' in window) {
        caches.keys().then((names) => {
            names.forEach((name) => {
                caches.delete(name);
            });
            console.log("🧹 Cache Storage DIBERSIHKAN.");
        });
    }
}

// ---------------------------------------------
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
    mission: MissionManager,
    event: EventManager,
    chat: ChatManager,
    ui: UIManager,
    leaderboard: LeaderboardManager,

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
            UIManager.showCustomAlert("CARA INSTALL (iOS)", "1. Tekan tombol 'Share'.\n2. Pilih 'Add to Home Screen'.", [{ text: "SIAP" }]);
        } else {
            UIManager.showCustomAlert("INSTALL MANUAL", "Otomatis gagal. Klik menu browser > Install App.", [{ text: "OK" }]);
        }
    },
    
    // --- PERBAIKAN: FUNGSI CEK UPDATE ---
    manualCheckUpdate: async () => {
        // Tampilkan loading agar user tahu sedang memproses
        UIManager.showCustomAlert("CEK UPDATE", "Menghubungi server...", [], 'info');
        
        try {
            // Coba ambil data dari tabel 'app_config'
            const { data, error } = await DatabaseManager.client.from('app_config').select('*').eq('id', 1).single();
            
            // Tutup loading dulu
            UIManager.closeModal('modal-custom-alert');

            if (error) {
                // Jika tabel tidak ada atau error koneksi, beri info fallback
                console.warn("Update check warning:", error.message);
                UIManager.showCustomAlert("INFO", "Gagal cek server (Offline/Config Missing).\nVersi lokal: " + CURRENT_APP_VERSION, [{text:"OK"}]);
                return;
            }

            if (!data) {
                UIManager.showCustomAlert("AMAN", "Data config kosong. Versi: " + CURRENT_APP_VERSION, [{text:"OK"}]);
                return;
            }

            // Logika cek versi
            if (data.latest_version === CURRENT_APP_VERSION) {
                UIManager.showCustomAlert("AMAN", "Versi Anda sudah paling baru!", [{text:"MANTAP"}], 'success');
            } else {
                app.clearAllCaches(); // Tawarkan update
            }
        } catch (e) {
            // Jika crash total (misal DatabaseManager null)
            console.error(e);
            UIManager.closeModal('modal-custom-alert');
            UIManager.showCustomAlert("ERROR", "Terjadi kesalahan sistem: " + e.message, [{text:"Tutup"}]);
        }
    },

    // --- PERBAIKAN: FUNGSI INFO UPDATE ---
    showLatestNews: async () => {
        // Beri feedback visual sedikit (opsional, tapi bagus untuk UX)
        // UIManager.showCustomAlert("MEMUAT", "Mengambil berita...", [], 'info');

        try {
            const { data, error } = await DatabaseManager.client.from('app_config').select('news_content, update_message').eq('id', 1).single();
            
            // Jika error, tampilkan pesan default (jangan diam saja)
            if (error || !data) {
                // UIManager.closeModal('modal-custom-alert'); // Jika tadi pakai loading
                UIManager.showCustomAlert("INFO UPDATE", "Selamat datang di Fish It Ultra!\n(Belum ada berita server)", [{text:"SIAP!"}], 'success');
                return;
            }

            // UIManager.closeModal('modal-custom-alert'); // Tutup loading
            const msg = (data && data.news_content) ? data.news_content : (data ? data.update_message : "Tidak ada berita.");
            UIManager.showCustomAlert("INFO UPDATE", msg, [{text:"SIAP!"}], 'success');
            
        } catch(e) {
            console.log(e);
            // UIManager.closeModal('modal-custom-alert');
            // Fallback terakhir jika crash
            UIManager.showCustomAlert("INFO", "Gagal memuat berita dari server.", [{text:"OK"}]);
        }
    },

    copyPlayerId: () => {
        const idEl = document.getElementById('setting-player-id');
        const fullId = idEl.dataset.fullId;
        if (fullId) {
            navigator.clipboard.writeText(fullId).then(() => {
                const btn = document.querySelector('.btn-copy-id');
                btn.innerHTML = '<i class="fa-solid fa-check"></i>';
                setTimeout(() => btn.innerHTML = '<i class="fa-regular fa-copy"></i>', 2000);
            });
        }
    },

    clearAllCaches: async () => {
        UIManager.showCustomAlert("UPDATE TERSEDIA", "Versi baru ditemukan! Update sekarang?", [
            { text: "Nanti", isCancel: true },
            {
                text: "GAS UPDATE",
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

// --- HELPER FUNCTIONS ---

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
        if (data.latest_version !== CURRENT_APP_VERSION) { 
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
                showUpdateNotification(newData.update_message, newData.download_url);
            }
        }
    ).subscribe();
}

// --- INITIALIZATION ---

const initializeApp = async () => {
    // 1. Setup Awal: Pastikan Loading Screen Muncul & Bar 0%
    const progressBar = document.querySelector('.loading-bar-fill');
    const loadingText = document.querySelector('.loader-text');
    const loadingScreen = document.getElementById('loading-screen');
    
    if(progressBar) progressBar.style.width = '5%';

    ThemeManager.init();
    
    // Resume Listener
    document.addEventListener('resume', () => {
        ThemeManager.updateTheme();
        UIManager.updateBuffTimers();
    });
    
    // Visibility Listener
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) ThemeManager.updateTheme();
    });
    
    SoundManager.init();
    
    if(progressBar) progressBar.style.width = '20%';
    await DatabaseManager.init();
    
    // Cek Version & Maintenance
    setupVersionListener(); 
    
    if(progressBar) progressBar.style.width = '50%';
    
    // Cek Session User
    const { data: { session } } = await DatabaseManager.getSession();
    let targetScreen = 'auth-screen'; 
    
    if (session) {
        if(progressBar) progressBar.style.width = '80%';
        // Pass TRUE ke skipUI agar layar tidak langsung ganti
        await AuthenticationManager.handleLoginSuccess(session.user, true);
        targetScreen = 'game-container';
    }

    // 2. FINISHING TOUCH: Penuhi Bar ke 100%
    if(progressBar) progressBar.style.width = '100%';
    if(loadingText) loadingText.textContent = "MEMBUKA GERBANG...";

    // 3. TAHAN SEBENTAR
    await new Promise(r => setTimeout(r, 800));

    // 4. PERSIAPAN TRANSISI
    document.querySelectorAll('.screen').forEach(el => {
        if(el.id !== 'loading-screen') el.classList.add('hidden');
    });
    
    const targetEl = document.getElementById(targetScreen);
    if(targetEl) targetEl.classList.remove('hidden');
    
    if (targetScreen === 'game-container') {
        UIManager.updateUI(); 
        const floatBtns = document.getElementById('floating-buttons');
        if (floatBtns) floatBtns.classList.remove('hidden');
    }

    // 5. FADE OUT
    if(loadingScreen) {
        loadingScreen.classList.add('fade-out');
        setTimeout(() => loadingScreen.classList.add('hidden'), 2000); 
    }
    
    // Auth Listener
    DatabaseManager.client.auth.onAuthStateChange((event, session) => { 
        if (event === 'SIGNED_IN' && !GameStateManager.state.user) {
            AuthenticationManager.handleLoginSuccess(session.user); 
        }
    });
    
    EventManager.init();
    LeaderboardManager.init();
    setInterval(UIManager.updateBuffTimers, 1000);
};

document.addEventListener('DOMContentLoaded', initializeApp);