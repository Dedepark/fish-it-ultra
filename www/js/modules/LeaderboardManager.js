import { DatabaseManager } from './DatabaseManager.js';
import { GameStateManager } from './GameStateManager.js';
import { UIManager } from './UIManager.js';

const LeaderboardManager = {
    currentTab: 'money', // money | level | fish
    subscription: null,
    updateTimeout: null, // Variabel buat nampung timer debounce

    init() {
        setTimeout(() => {
            const counter = document.getElementById('online-counter-wrapper');
            if (counter) {
                counter.style.cursor = 'pointer';
                counter.onclick = () => this.open();
            }
        }, 2000); 
    },

    open() {
        UIManager.showModal('modal-leaderboard');
        // Reset UI cuma pas pertama kali buka
        this.resetUI();
        this.switchTab(this.currentTab, true); // true = force loading awal
        this.subscribeToUpdates();
    },

    close() {
        if (this.subscription) {
            DatabaseManager.client.removeChannel(this.subscription);
            this.subscription = null;
        }
        // Bersihkan timer kalau ditutup biar gak error
        if (this.updateTimeout) clearTimeout(this.updateTimeout);
    },

    subscribeToUpdates() {
        if (this.subscription) return;
        
        this.subscription = DatabaseManager.client
            .channel('public:profiles')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
                // FITUR ANTI KEDIP & HEMAT KUOTA (DEBOUNCE)
                // Kalau ada update bertubi-tubi, kita tunggu 3 detik baru refresh
                if (this.updateTimeout) clearTimeout(this.updateTimeout);
                
                this.updateTimeout = setTimeout(() => {
                    // console.log("🔄 Refreshing leaderboard data...");
                    this.fetchData(false); // false = JANGAN reset UI (biar gak kedip)
                }, 3000); 
            })
            .subscribe();
    },

    switchTab(tab, isFirstLoad = false) {
        this.currentTab = tab;
        
        document.querySelectorAll('#modal-leaderboard .tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if(btn.innerText.toLowerCase().includes(tab === 'fish' ? 'fish' : (tab === 'money' ? 'sultan' : 'level'))) {
                btn.classList.add('active');
            }
        });

        // Kalau ganti tab manual, kita reset UI biar kelihatan loading
        // Kalau isFirstLoad (pas buka modal), juga reset.
        this.fetchData(true); 
    },

    // Parameter 'showLoading' menentukan apakah layar perlu dibersihkan dulu
    async fetchData(showLoading = true) {
        
        // KUNCI ANTI KEDIP: 
        // Cuma reset UI kalau user ganti tab atau baru buka.
        // Kalau update dari realtime, biarkan data lama tampil dulu.
        if (showLoading) {
            this.resetUI();
        }

        let query = DatabaseManager.client
            .from('profiles')
            .select('username, id, money, level, best_fish_price, created_at');
        
        if (this.currentTab === 'money') {
            query = query.order('money', { ascending: false });
        } else if (this.currentTab === 'level') {
            query = query.order('level', { ascending: false }).order('money', { ascending: false });
        } else if (this.currentTab === 'fish') {
            query = query
                .order('best_fish_price', { ascending: false })
                .order('updated_at', { ascending: false });
        }

        const { data, error } = await query.limit(50); 

        if (error) {
            console.error("LB Error:", error);
            // Error tetap ditampilkan menimpa list
            document.getElementById('lb-list').innerHTML = `<div style="text-align:center; padding:20px; color:#ff5555;">Gagal memuat data: ${error.message}</div>`;
            return;
        }

        if (!data || data.length === 0) {
             document.getElementById('lb-list').innerHTML = `<div style="text-align:center; padding:20px; color:#888;">Belum ada data player.</div>`;
             return;
        }

        // Render data baru (akan langsung menimpa data lama tanpa fase kosong)
        this.renderData(data);
    },

    renderData(players) {
        const top3 = [players[0], players[1], players[2]];
        const others = players.slice(3, 50); // Tampilkan semua sisa sampai 50

        // Update Podium
        this.fillPodium('p-first', top3[0]);
        this.fillPodium('p-second', top3[1]);
        this.fillPodium('p-third', top3[2]);

        // Render List Bawah
        const listContainer = document.getElementById('lb-list');
        
        // Simpan posisi scroll sebelum update
        const scrollPos = document.getElementById('leaderboard-container')?.scrollTop || 0;

        let htmlContent = ''; // Kita bangun string dulu

        others.forEach((p, index) => {
            if (!p) return;
            const rank = index + 4;
            const myId = GameStateManager.state.user?.id;
            const isMe = myId && myId === p.id;
            
            const valueDisplay = this.formatValue(p);
            
            htmlContent += `
                <div class="lb-row ${isMe ? 'is-me' : ''}">
                    <div class="lb-rank">#${rank}</div>
                    <div class="lb-info">
                        <div class="lb-name">${p.username || 'Unknown'} ${isMe ? '(YOU)' : ''}</div>
                        <div class="lb-value">${valueDisplay}</div>
                    </div>
                </div>
            `;
        });

        // Sekali update DOM langsung ganti semua (cepat dan gak kedip putih)
        listContainer.innerHTML = htmlContent;

        // Balikin posisi scroll (opsional, biar user gak kaget kalau lagi scroll ke bawah tiba2 mental ke atas)
        // const container = document.getElementById('leaderboard-container');
        // if(container) container.scrollTop = scrollPos;

        // Footer status
        const footer = document.querySelector('#modal-leaderboard .modal-content > div:last-child');
        if(footer && footer.innerText.includes('Leaderboard')) {
             footer.innerHTML = `Leaderboard Live <span style="color:#555; font-size:0.6rem;">(Updated: ${new Date().toLocaleTimeString()})</span>`;
        }
    },

    fillPodium(className, player) {
        const el = document.querySelector(`.${className}`);
        if (!el) return;
        
        const nameEl = el.querySelector('.p-name');
        const valEl = el.querySelector('.p-val');

        if (player) {
            nameEl.innerText = player.username || 'Unknown';
            valEl.innerText = this.formatValue(player);
            el.style.opacity = '1';
        } else {
            nameEl.innerText = '-';
            valEl.innerText = '-';
            el.style.opacity = '0.5';
        }
    },

    formatValue(player) {
        if (this.currentTab === 'money') return `Rp ${player.money?.toLocaleString() || 0}`;
        if (this.currentTab === 'level') return `Lvl ${player.level || 1}`;
        if (this.currentTab === 'fish') return `Best: Rp ${player.best_fish_price?.toLocaleString() || 0}`;
        return '';
    },

    resetUI() {
        document.querySelectorAll('.p-name').forEach(el => el.innerText = 'Loading...');
        document.querySelectorAll('.p-val').forEach(el => el.innerText = '...');
        document.getElementById('lb-list').innerHTML = '<div style="text-align:center; padding:20px; color:#666;">Memuat data...</div>';
    }
};

export default LeaderboardManager;