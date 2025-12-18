import { DatabaseManager } from './DatabaseManager.js';
import { GameStateManager } from './GameStateManager.js';
import { UIManager } from './UIManager.js';

const LeaderboardManager = {
    currentTab: 'money', // money | level | fish
    subscription: null, // Buat Realtime Listener

    init() {
        // Pasang onclick ke counter online di Chat
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
        this.switchTab(this.currentTab);
        this.subscribeToUpdates(); // Mulai dengerin update
    },

    close() {
        // Pas modal ditutup, stop dengerin biar hemat kuota
        if (this.subscription) {
            DatabaseManager.client.removeChannel(this.subscription);
            this.subscription = null;
        }
    },

    // FITUR REALTIME CANGGIH: Kalau ada orang lain mancing/level up, list langsung update sendiri
    subscribeToUpdates() {
        if (this.subscription) return;
        
        this.subscription = DatabaseManager.client
            .channel('public:profiles')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
                // console.log("🔄 Ada player lain yang update data!", payload);
                this.fetchData(); // Refresh list otomatis
            })
            .subscribe();
    },

    switchTab(tab) {
        this.currentTab = tab;
        
        document.querySelectorAll('#modal-leaderboard .tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if(btn.innerText.toLowerCase().includes(tab === 'fish' ? 'fish' : (tab === 'money' ? 'sultan' : 'level'))) {
                btn.classList.add('active');
            }
        });

        this.fetchData();
    },

    async fetchData() {
        this.resetUI();

        let query = DatabaseManager.client
            .from('profiles')
            .select('username, id, money, level, best_fish_price, created_at');
        
        // Sorting Logic
        if (this.currentTab === 'money') {
            query = query.order('money', { ascending: false });
        } else if (this.currentTab === 'level') {
            query = query.order('level', { ascending: false }).order('money', { ascending: false });
        } else if (this.currentTab === 'fish') {
    query = query
        .order('best_fish_price', { ascending: false })
        .order('updated_at', { ascending: false }); // Yang terbaru dapat harga tinggi akan di atas
}

        // Ambil Top 50 biar seru, tapi nanti kita potong di render
        const { data, error } = await query.limit(50); 

        if (error) {
            console.error("LB Error:", error);
            document.getElementById('lb-list').innerHTML = `<div style="text-align:center; padding:20px; color:#ff5555;">Gagal memuat data: ${error.message}</div>`;
            return;
        }

        if (!data || data.length === 0) {
             document.getElementById('lb-list').innerHTML = `<div style="text-align:center; padding:20px; color:#888;">Belum ada data player.</div>`;
             return;
        }

        this.renderData(data);
    },

    renderData(players) {
        const top3 = [players[0], players[1], players[2]];
        const others = players.slice(3, 10); // Cuma nampilin rank 4-10 di list bawah

        // Render Podium
        this.fillPodium('p-first', top3[0]);
        this.fillPodium('p-second', top3[1]);
        this.fillPodium('p-third', top3[2]);

        // Render List
        const listContainer = document.getElementById('lb-list');
        listContainer.innerHTML = '';

        others.forEach((p, index) => {
            if (!p) return;
            const rank = index + 4;
            // Cek ID diri sendiri biar di-highlight
            const myId = GameStateManager.state.user?.id;
            const isMe = myId && myId === p.id;
            
            const valueDisplay = this.formatValue(p);
            
            const html = `
                <div class="lb-row ${isMe ? 'is-me' : ''}">
                    <div class="lb-rank">#${rank}</div>
                    <div class="lb-info">
                        <div class="lb-name">${p.username || 'Unknown'} ${isMe ? '(YOU)' : ''}</div>
                        <div class="lb-value">${valueDisplay}</div>
                    </div>
                </div>
            `;
            listContainer.innerHTML += html;
        });

        // Ganti text footer biar gak bikin emosi
        const footer = document.querySelector('#modal-leaderboard .modal-content > div:last-child');
        if(footer && footer.innerText.includes('Update Realtime')) {
             footer.innerHTML = "Leaderboard Live";
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
        document.getElementById('lb-list').innerHTML = '';
    }
};

export default LeaderboardManager;