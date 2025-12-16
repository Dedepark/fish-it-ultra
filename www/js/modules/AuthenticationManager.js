import { DatabaseManager } from './DatabaseManager.js';
import { UIManager } from './UIManager.js';
import { GameStateManager } from './GameStateManager.js';
import { InventoryManager } from './InventoryManager.js'; 
import { EventManager } from './EventManager.js'; 
import { ChatManager } from './ChatManager.js'; 

export const AuthenticationManager = {
    init: function() {
        // Listener auth state change
        DatabaseManager.client.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') {
                this.handleLoginSuccess(session.user);
            } 
            // Kita handle SIGNED_OUT manual di fungsi logout() biar lebih aman
        });
    },
    
    async login() {
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-pass').value;
        
        const { error } = await DatabaseManager.signIn(email, pass);
        
        if (error) {
            UIManager.showCustomAlert("GAGAL LOGIN", error.message, [{ text: "OK" }]);
        }
    },
    
    async register() {
        const email = document.getElementById('reg-email').value;
        const pass = document.getElementById('reg-pass').value;
        const username = document.getElementById('reg-username').value;
        
        const { error } = await DatabaseManager.signUp(email, pass, {
            data: { username }
        });
        
        if (error) {
            UIManager.showCustomAlert("GAGAL DAFTAR", error.message, [{ text: "OK" }]);
        } else {
            UIManager.showCustomAlert(
                "BERHASIL!", 
                "Akun dibuat. Silakan login.", 
                [{ text: "OK" }], 
                'success'
            );
            this.switchAuthTab('login');
        }
    },
    
    async logout() {
        UIManager.showCustomAlert(
            "KONFIRMASI LOGOUT", 
            "Yakin ingin keluar?", 
            [
                { text: "Batal", isCancel: true }, 
                { 
                    text: "Ya, Keluar", 
                    isConfirm: true, 
                    onClick: async () => {
                        // 1. Bersihkan Timer & Event biar gak error di background
                        if (EventManager && typeof EventManager.cleanup === 'function') {
                            try { EventManager.cleanup(); } catch (err) { console.warn(err); }
                        }

                        // 2. COBA LOGOUT KE SERVER (TAPI CUEKIN ERRORNYA)
                        try {
                            await DatabaseManager.client.auth.signOut();
                        } catch (e) {
                            console.warn("Logout server error (Diabaikan):", e);
                        } finally {
                            // 3. NUCLEAR OPTION: HAPUS MEMORI PAKSA!
                            // Ini yang bikin kamu gak "balik lagi" pas reload
                            localStorage.clear(); 
                            sessionStorage.clear();
                            
                            // 4. Force Reload Halaman
                            window.location.reload();
                        }
                    } 
                }
            ]
        );
    },
    
    switchAuthTab(tab) {
        const loginTab = document.getElementById('btn-tab-login');
        const registerTab = document.getElementById('btn-tab-register');
        const loginForm = document.getElementById('form-login');
        const registerForm = document.getElementById('form-register');
        
        if (tab === 'login') {
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
        } else {
            loginTab.classList.remove('active');
            registerTab.classList.add('active');
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
        }
    },
    
    async handleLoginSuccess(user) {
        GameStateManager.state.user = user;
        if (user.user_metadata?.username) {
            GameStateManager.state.username = user.user_metadata.username;
        }
        document.getElementById('display-username').innerText = GameStateManager.state.username;

        console.log("Auth: Loading data...");
        await GameStateManager.init(); 
        await ChatManager.loadChatMessages(); 

        UIManager.updateUI();
        UIManager.showScreen('game-container');
        document.getElementById('loading-screen').classList.add('hidden');

        const floatBtns = document.getElementById('floating-buttons');
        if (floatBtns) {
            floatBtns.classList.remove('hidden');
        }

        ChatManager.setupChatListener();
        InventoryManager.setupInventoryListener();
        EventManager.init();
    }
};