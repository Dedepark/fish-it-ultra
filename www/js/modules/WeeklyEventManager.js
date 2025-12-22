import { GameStateManager } from './GameStateManager.js';
import { UIManager } from './UIManager.js';
import { ChatManager } from './ChatManager.js';
import { formatMoney, ENCHANT_STONES, POTIONS, RODS_DB } from '../config.js'; 
import { DatabaseManager } from './DatabaseManager.js';

const WeeklyEventManager = {
    activeTab: 'fish', // Default Fish
    isSpinning: false,
    isDataLoaded: false, // [FIX] Penanda status data agar tidak save sembarangan
    
    // Data Default
    data: {
        tokens: { blue: 0, red: 0 },
        dailyFishCount: 0, 
        claimedMissions: [], 
        lastResetDate: null,
        
        // --- ITEM TOKO (PENUKARAN) ---
        shopItems: [
            // 1. KONVERSI (10 Biru -> 1 Merah)
            { id: 'ex_red_token', name: '1 Token Merah', cost: 10, type: 'exchange_token', val: 1, icon: 'fa-circle-dot', color: '#ff0044', desc: 'Tukar 10 Token Biru' },
            
            // 2. JORAN EVENT (Bayar pakai Token Merah)
            { id: 'rod_101', cost: 50, type: 'rod_red', rod_id: 101, icon: 'fa-bolt' }, 
            { id: 'rod_102', cost: 50, type: 'rod_red', rod_id: 102, icon: 'fa-bolt' },
            { id: 'rod_103', cost: 50, type: 'rod_red', rod_id: 103, icon: 'fa-bolt' },
            { id: 'rod_104', cost: 50, type: 'rod_red', rod_id: 104, icon: 'fa-bolt' },
            
            // 3. ITEM BIASA (Bayar pakai Token Biru)
            { id: 'stone_rare', cost: 2, type: 'item', qty: 2, icon: 'fa-gem', color: '#9b59b6' }, 
            { id: 'pot_red', cost: 1, type: 'item', qty: 1, icon: 'fa-flask', color: '#e74c3c' },
            { id: 'stone_astral', cost: 5, type: 'item', qty: 1, icon: 'fa-gem', color: '#e74c3c' }, 
            
            // 4. RESOURCE
            { id: 'ev_money', name: '10M Uang', cost: 1, type: 'money', val: 10000000, icon: 'fa-sack-dollar', color: '#ffd700' }
        ],

        // --- GACHA REWARDS (Nerfed 50%) ---
        gachaRewards: [
            { id: 1, name: "50M Uang", icon: "fa-coins", weight: 25, type: 'money', val: 50000000, color: '#ffd700' }, 
            { id: 2, name: "25K Dia", icon: "fa-gem", weight: 25, type: 'dia', val: 25000, color: '#00d2ff' },
            
            // JACKPOT JORAN (TRIGGER ANIMASI ADA DI SINI)
            { id: 999, name: "EVENT ROD", icon: "fa-bolt", weight: 2, type: 'random_event_rod', color: '#ff00ff' }, 
            
            // HADIAH LAIN
            { id: 4, name: "250M Uang", icon: "fa-money-bill-trend-up", weight: 15, type: 'money', val: 250000000, color: '#00ff88' },
            { id: 5, name: "50K Dia", icon: "fa-box-open", weight: 13, type: 'dia', val: 50000, color: '#00d2ff' },
            { id: 6, name: "Batu Astral", icon: "fa-meteor", weight: 20, type: 'item', item_id: 'stone_astral', qty: 3, color: '#ff4444' }
        ]
    },

    // --- LOAD DATA (DIPERBAIKI) ---
    async loadEventData() {
        if (!GameStateManager.state.user) return;
        try {
            let { data, error } = await DatabaseManager.client
                .from('weekly_event_data')
                .select('*')
                .eq('user_id', GameStateManager.state.user.id)
                .single();

            if (error && error.code === 'PGRST116') {
                const newData = {
                    user_id: GameStateManager.state.user.id,
                    blue_tokens: 0,
                    red_tokens: 0,
                    daily_fish_count: 0,
                    claimed_missions: [],
                    last_reset_date: new Date().toISOString().split('T')[0]
                };
                const { data: inserted } = await DatabaseManager.client.from('weekly_event_data').insert(newData).select().single();
                data = inserted;
            }

            if (data) {
                this.data.tokens.blue = data.blue_tokens;
                this.data.tokens.red = data.red_tokens;
                this.data.dailyFishCount = data.daily_fish_count;
                this.data.claimedMissions = data.claimed_missions || [];
                this.data.lastResetDate = data.last_reset_date;
                
                this.isDataLoaded = true; // [FIX] Data berhasil dimuat, izinkan save
                this.checkDailyReset();
            }
        } catch (e) {
            console.error("Event Data Load Error:", e);
        }
    },

    // --- SAVE DATA (DIPERBAIKI) ---
    async saveEventData() {
        // [FIX] JANGAN SAVE JIKA DATA BELUM DIMUAT (Mencegah Overwrite 0)
        if (!GameStateManager.state.user || !this.isDataLoaded) return;
        
        const updatePayload = {
            blue_tokens: this.data.tokens.blue,
            red_tokens: this.data.tokens.red,
            daily_fish_count: this.data.dailyFishCount,
            claimed_missions: this.data.claimedMissions,
            last_reset_date: this.data.lastResetDate
        };
        await DatabaseManager.client
            .from('weekly_event_data')
            .update(updatePayload)
            .eq('user_id', GameStateManager.state.user.id);
    },

    // --- RESET HARIAN (DIPERBAIKI) ---
    checkDailyReset() {
        // [FIX] Jangan reset kalau data belum siap (mencegah reset palsu)
        if (!this.isDataLoaded) return;

        const today = new Date().toISOString().split('T')[0];
        if (this.data.lastResetDate !== today) {
            console.log("Melakukan Reset Harian Event...");
            this.data.dailyFishCount = 0;
            // Token TIDAK di-reset di sini (aman)
            this.data.claimedMissions = this.data.claimedMissions.filter(id => !id.startsWith('fish_'));
            this.data.lastResetDate = today;
            this.saveEventData();
        }
    },

    // [FIX] FUNGSI INI DIBUAT ASYNC DAN MENUNGGU LOAD DATA
    async onFishCaught() {
        // Pastikan data dimuat dulu sebelum nambah counter
        if (!this.isDataLoaded) {
             await this.loadEventData();
        }
        
        // Cek lagi, kalau masih gagal load (misal error sinyal), jangan lanjut save
        if (!this.isDataLoaded) return;

        this.checkDailyReset();
        this.data.dailyFishCount++;
        this.saveEventData();
        
        const modal = document.getElementById('modal-weekly-event');
        if (modal && this.activeTab === 'fish') {
            this.renderTabContent('fish');
        }
    },

    async openEvent() {
        await this.loadEventData(); 
        const oldModal = document.getElementById('modal-weekly-event');
        if(oldModal) oldModal.remove();

        const modalHtml = `
            <div id="modal-weekly-event" class="modal-event-full" style="z-index: 10000;">
                <div class="event-header">
                    <h2 style="margin:0; letter-spacing:2px;">
                        <i class="fas fa-trophy" style="color:gold"></i> WEEKLY <span style="color:#00d2ff">EVENT</span>
                    </h2>
                    <div style="display:flex; justify-content:center; gap:15px; margin-top:10px;">
                        <span class="token-badge blue-token">
                            <i class="fas fa-circle-check"></i> <span id="ev-blue-count">${this.data.tokens.blue}</span>
                        </span>
                        <span class="token-badge red-token">
                            <i class="fas fa-circle-dot"></i> <span id="ev-red-count">${this.data.tokens.red}</span>
                        </span>
                    </div>
                </div>
                <div class="event-tabs-container">
                    <button class="event-tab active" data-tab="fish" onclick="app.weeklyEvent.switchTab('fish')"><i class="fas fa-fish"></i> FISH</button>
                    <button class="event-tab" data-tab="level" onclick="app.weeklyEvent.switchTab('level')"><i class="fas fa-layer-group"></i> LEVEL</button>
                    <button class="event-tab" data-tab="rank" onclick="app.weeklyEvent.switchTab('rank')"><i class="fas fa-chart-line"></i> RANK</button>
                    <button class="event-tab" data-tab="exchange" onclick="app.weeklyEvent.switchTab('exchange')"><i class="fas fa-exchange-alt"></i> PENUKARAN</button>
                    <button class="event-tab" data-tab="gacha" onclick="app.weeklyEvent.switchTab('gacha')"><i class="fas fa-clover"></i> GACHA</button>
                </div>
                <div id="event-content-body" class="event-body"></div>
                <button class="event-exit-nav" onclick="app.weeklyEvent.closeEvent()">
                    <i class="fas fa-chevron-left"></i> KEMBALI
                </button>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.switchTab('fish'); 
    },

    switchTab(tab) {
        this.activeTab = tab;
        document.querySelectorAll('.event-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        this.renderTabContent(tab);
    },

    async renderTabContent(tab) {
        const container = document.getElementById('event-content-body');
        if (!container) return;
        container.innerHTML = `<div style="text-align:center; padding:50px;"><i class="fas fa-spinner fa-spin fa-2x" style="color:#00d2ff"></i></div>`;
        let html = '';

        if (tab === 'fish') {
            const currentCount = this.data.dailyFishCount;
            html = `<div style="text-align:center; color:#aaa; margin-bottom:15px; font-size:0.8rem;">Misi ini direset setiap jam 00:00</div>`;
            for(let i=1; i<=10; i++) {
                const target = i * 20;
                html += this.renderMissionCard(`fish_${i}`, `fas fa-anchor`, `Pancing ${target} Ikan (Hari Ini)`, currentCount, target);
            }
        }
        else if (tab === 'level') {
            const currentLv = GameStateManager.state.gameData.level;
            for(let i=1; i<=10; i++) {
                const targetLv = i * 20;
                html += this.renderMissionCard(`level_${i}`, `fas fa-layer-group`, `Capai Level ${targetLv}`, currentLv, targetLv);
            }
        }
        else if (tab === 'rank') {
            html = `<h3 style="text-align:center; color:#00d2ff; margin-bottom:20px;"><i class="fas fa-medal"></i> MISI RANKING</h3>`;
            html += await this.renderRankMission("3 Besar Sultan", "money", 3, "fa-crown");
            html += await this.renderRankMission("10 Besar Sultan", "money", 10, "fa-coins");
            html += await this.renderRankMission("3 Besar Level", "level", 3, "fa-up-long");
            html += await this.renderRankMission("10 Besar Level", "level", 10, "fa-stairs");
            html += await this.renderRankMission("3 Besar Ikan", "fish", 3, "fa-fish-fins");
            html += await this.renderRankMission("10 Besar Ikan", "fish", 10, "fa-shrimp");
        }
        else if (tab === 'exchange') {
            html = `<div class="gacha-grid">`;
            const safeStones = (typeof ENCHANT_STONES !== 'undefined') ? ENCHANT_STONES : [];
            const safePotions = (typeof POTIONS !== 'undefined') ? POTIONS : [];
            const safeRods = (typeof RODS_DB !== 'undefined') ? RODS_DB : [];
            const allItemsConfig = [...safeStones, ...safePotions, ...safeRods]; 

            this.data.shopItems.forEach(item => {
                let displayData = { 
                    name: item.name || 'Unknown Item', 
                    icon: item.icon || 'fa-box', 
                    color: item.color || '#888' 
                };

                if (item.type === 'item' || item.type.startsWith('rod')) {
                    const targetId = (item.type.startsWith('rod')) ? item.rod_id : item.id;
                    const realItem = allItemsConfig.find(c => c.id == targetId);
                    
                    if (realItem) {
                        displayData.name = realItem.name;
                        if (realItem.color) displayData.color = realItem.color;
                        if (realItem.icon) displayData.icon = realItem.icon;
                        
                        if(item.type === 'item' && item.qty > 1) {
                            displayData.name = `${item.qty}x ${realItem.name}`;
                        }
                        if(item.type.startsWith('rod')) {
                            displayData.name += " (Event)";
                        }
                    } 
                }
                
                const isRedCost = (item.type === 'rod_red');
                const costIcon = isRedCost ? 'fa-circle-dot' : 'fa-circle-check';
                const costColor = isRedCost ? '#ff0044' : '#00d2ff';

                html += `
                    <div class="gacha-item" style="border: 1px solid ${displayData.color}44;">
                        <i class="fas ${displayData.icon}" style="font-size:1.8rem; color:${displayData.color}; margin-bottom:10px; filter:drop-shadow(0 0 5px ${displayData.color});"></i>
                        <div style="font-size:0.75rem; font-weight:bold; height:35px; overflow:hidden; display:flex; align-items:center; justify-content:center; text-align:center;">
                            ${displayData.name}
                        </div>
                        ${item.desc ? `<small style="font-size:0.6rem; color:#aaa;">${item.desc}</small><br>` : ''}
                        
                        <button class="btn-confirm" onclick="app.weeklyEvent.processExchange('${item.id}')" style="width:100%; font-size:0.8rem; margin-top:5px; border-color:${costColor}; color:${costColor};">
                            ${item.cost} <i class="fas ${costIcon}"></i>
                        </button>
                    </div>`;
            });
            html += `</div>`;
        }
        else if (tab === 'gacha') {
            html = `
                <div class="gacha-board" id="gacha-board">
                    ${this.data.gachaRewards.map(r => {
                        let displayName = r.name;
                        let displayIcon = r.icon;
                        if (r.type === 'random_event_rod') { displayName = "EVENT RODS"; displayIcon = "fa-bolt"; }
                        return `
                        <div class="gacha-slot" id="slot-${r.id}" style="border-color:${r.color}">
                            <i class="fas ${displayIcon}" style="color:${r.color}; font-size:1.5rem;"></i>
                            <div style="font-size:0.6rem; margin-top:5px; font-weight:bold;">${displayName}</div>
                        </div>`;
                    }).join('')}
                </div>
                <div style="padding:20px;">
                    <button id="btn-spin-event" class="btn-confirm" style="width:100%; padding:15px; background:linear-gradient(to right, #ff0044, #ff5500); border:none; box-shadow:0 4px 15px #ff004466;" onclick="app.weeklyEvent.startGacha()">
                        SPIN (1 <i class="fas fa-circle-dot"></i>)
                    </button>
                    <small style="display:block; text-align:center; margin-top:10px; color:#aaa;">Hadiah Utama: Salah satu Joran Event (Power 7000, Speed 2x)!</small>
                </div>
            `;
        }
        container.innerHTML = html;
    },

    // --- LOGIKA TRANSAKSI ---
    processExchange(shopItemId) {
        const item = this.data.shopItems.find(i => i.id === shopItemId);
        if(!item) return;

        // 1. BELI ROD (Token Merah)
        if (item.type === 'rod_red') {
            if (this.data.tokens.red < item.cost) return UIManager.showCustomAlert("GAGAL", "Token Merah tidak cukup! 🔴", [{text:"OK"}], "error");
            
            if (GameStateManager.state.gameData.owned_rods.includes(item.rod_id)) {
                 const komp = 2000000000; 
                 GameStateManager.state.gameData.money += komp;
                 this.data.tokens.red -= item.cost;
                 this.saveEventData();
                 GameStateManager.saveState();
                 this.updateCounters();
                 return UIManager.showCustomAlert("DUPLIKAT", `Diganti Kompensasi ${formatMoney(komp)}`, [{text:"OK"}], "info");
            }

            this.data.tokens.red -= item.cost;
            GameStateManager.state.gameData.owned_rods.push(item.rod_id);
            const rodData = RODS_DB.find(r => r.id === item.rod_id);
            
            this.saveEventData();
            GameStateManager.saveState();
            this.updateCounters();
            return UIManager.showCustomAlert("BERHASIL", `Dapat Joran: ${rodData ? rodData.name : 'Event Rod'}!`, [{text:"SIP"}], "success");
        }

        // 2. TUKAR TOKEN (10 Biru -> 1 Merah)
        else if (item.type === 'exchange_token') {
            if (this.data.tokens.blue < item.cost) return UIManager.showCustomAlert("GAGAL", "Token Biru tidak cukup!", [{text:"OK"}], "error");
            
            this.data.tokens.blue -= item.cost;
            this.data.tokens.red += item.val;
            
            this.saveEventData();
            this.updateCounters();
            return UIManager.showCustomAlert("TUKAR SUKSES", "Dapat 1 Token Merah!", [{text:"OK"}], "success");
        }

        // 3. BELI ITEM BIASA (Token Biru)
        else {
            if (this.data.tokens.blue < item.cost) return UIManager.showCustomAlert("GAGAL", "Token Biru tidak cukup!", [{text:"OK"}], "error");

            this.data.tokens.blue -= item.cost;
            if(item.type === 'money') GameStateManager.state.gameData.money += item.val;
            else if(item.type === 'item') {
                 if(!GameStateManager.state.gameData.inventory_items) GameStateManager.state.gameData.inventory_items = {};
                 GameStateManager.state.gameData.inventory_items[item.id] = (GameStateManager.state.gameData.inventory_items[item.id] || 0) + item.qty;
            }

            GameStateManager.saveState();
            this.saveEventData();
            this.updateCounters();
            UIManager.showCustomAlert("SUKSES", "Item berhasil ditukar!", [{text:"OK"}], "success");
        }
    },

    // --- GACHA ---
    startGacha() {
        if(this.isSpinning || this.data.tokens.red < 1) {
            if(!this.isSpinning) UIManager.showCustomAlert("GAGAL", "Token Merah kurang!", [{text:"OK"}], "error");
            return;
        }
        this.isSpinning = true;
        this.data.tokens.red--;
        this.saveEventData(); 
        this.updateCounters();
        
        const btn = document.getElementById('btn-spin-event');
        if(btn) { btn.disabled = true; btn.style.opacity = 0.5; }

        const winnerIndex = this.calculateGachaWinner();
        let currentIdx = 0, laps = 0, speed = 50;
        const total = this.data.gachaRewards.length;

        const run = () => {
            document.querySelectorAll('.gacha-slot').forEach(s => s.classList.remove('highlight'));
            const el = document.getElementById(`slot-${this.data.gachaRewards[currentIdx].id}`);
            if(el) el.classList.add('highlight');

            if(laps > 4 && currentIdx === winnerIndex) {
                setTimeout(() => this.finishGacha(this.data.gachaRewards[winnerIndex]), 500);
            } else {
                currentIdx++;
                if(currentIdx >= total) { currentIdx=0; laps++; }
                if(laps > 3) speed += 15;
                if(laps > 4) speed += 30;
                setTimeout(run, speed);
            }
        };
        run();
    },

    calculateGachaWinner() {
        let totalWeight = this.data.gachaRewards.reduce((a,b) => a + b.weight, 0);
        let rand = Math.random() * totalWeight;
        let sum = 0;
        for(let i=0; i<this.data.gachaRewards.length; i++) {
            sum += this.data.gachaRewards[i].weight;
            if(rand <= sum) return i;
        }
        return 0;
    },

    finishGacha(reward) {
        this.isSpinning = false;
        const btn = document.getElementById('btn-spin-event');
        if(btn) { btn.disabled = false; btn.style.opacity = 1; }

        let prizeName = reward.name;
        
        // Buat variable terpisah untuk nama item murni (buat broadcast)
        let itemNameForBroadcast = reward.name; 

        if (reward.type === 'money') {
            GameStateManager.state.gameData.money += reward.val;
            prizeName = formatMoney(reward.val);
            itemNameForBroadcast = formatMoney(reward.val) + " Uang";
        }
        else if (reward.type === 'dia') {
            GameStateManager.state.gameData.diamonds += reward.val;
            itemNameForBroadcast = formatMoney(reward.val) + " Diamond";
        }
        else if (reward.type === 'item') {
             const itemId = reward.item_id;
             if(!GameStateManager.state.gameData.inventory_items) GameStateManager.state.gameData.inventory_items = {};
             GameStateManager.state.gameData.inventory_items[itemId] = (GameStateManager.state.gameData.inventory_items[itemId] || 0) + reward.qty;
             prizeName = `${reward.qty}x ${reward.name}`;
             itemNameForBroadcast = `${reward.qty}x ${reward.name}`;
        }
        else if (reward.type === 'random_event_rod') {
            const eventRodIds = [101, 102, 103, 104];
            const chosenId = eventRodIds[Math.floor(Math.random() * eventRodIds.length)];
            const realRod = RODS_DB.find(r => r.id === chosenId);
            const rodName = realRod ? realRod.name : "Event Rod";
            
            itemNameForBroadcast = rodName; // Broadcast nama joran asli

            if (GameStateManager.state.gameData.owned_rods.includes(chosenId)) {
                const komp = 5000000000; 
                GameStateManager.state.gameData.money += komp;
                prizeName = `${rodName} (Duplikat)\nDiganti: ${formatMoney(komp)}`;
            } else {
                GameStateManager.state.gameData.owned_rods.push(chosenId);
                prizeName = `${rodName} (NEW!)`;
            }
        }

        GameStateManager.saveState();
        UIManager.updateUI();

        // --- TRIGGER ANIMASI & BROADCAST KHUSUS JORAN EVENT ---
        if (reward.type === 'random_event_rod') { 
            this.showJackpotAnimation(itemNameForBroadcast, reward.icon || 'fa-bolt');
            ChatManager.broadcastEventWin(GameStateManager.state.username, itemNameForBroadcast);
        } else {
            UIManager.showCustomAlert("GACHA RESULT", `Selamat! Dapat:\n${prizeName}`, [{text:"AMBIL"}], "success");
        }
    },
    
    // --- ANIMASI MEWAH (Injected CSS via _weekly_event.css) ---
    showJackpotAnimation(itemName, iconClass) {
        const html = `
            <div class="jackpot-overlay" onclick="this.remove()">
                <div class="jackpot-rays"></div>
                <div class="jackpot-content">
                    <div style="font-size:1.5rem; color:gold; margin-bottom:20px;">🎉 JACKPOT! 🎉</div>
                    <i class="fas ${iconClass} jackpot-icon"></i>
                    <div class="jackpot-title">CONGRATULATIONS</div>
                    <div class="jackpot-item">${itemName}</div>
                    <div style="margin-top:30px; color:#aaa; font-size:0.8rem;">(Klik layar untuk tutup)</div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    renderMissionCard(id, icon, title, current, target) {
        const isClaimed = this.data.claimedMissions.includes(id);
        const progress = Math.min(100, (current / target) * 100);
        const canClaim = current >= target && !isClaimed;
        return `<div class="mission-card-event"><i class="${icon}" style="margin-right:15px; color:#00d2ff; font-size:1.2rem;"></i><div style="flex:1;"><b style="font-size:0.85rem;">${title}</b><div style="font-size:0.7rem; color:#aaa; margin-top:2px;">${current.toLocaleString()} / ${target.toLocaleString()}</div><div class="mission-progress-container"><div class="mission-progress-fill" style="width:${progress}%"></div></div></div><button class="btn-confirm" style="margin-left:15px; min-width:80px; font-size:0.7rem; opacity:${canClaim || isClaimed ? 1 : 0.5}" onclick="${canClaim ? `app.weeklyEvent.claimMission('${id}')` : ''}">${isClaimed ? '<i class="fas fa-check"></i>' : (canClaim ? 'KLAIM' : '<i class="fas fa-lock"></i>')}</button></div>`;
    },
    async renderRankMission(title, type, targetRank, icon) {
        const myId = GameStateManager.state.user.id;
        const missionId = `rank_${type}_${targetRank}`;
        const isClaimed = this.data.claimedMissions.includes(missionId);
        let isQualified = false;
        try {
            const orderCol = type === 'fish' ? 'best_fish_price' : (type === 'money' ? 'money' : 'level');
            const { data } = await DatabaseManager.client.from('profiles').select('id').order(orderCol, { ascending: false }).limit(targetRank);
            if (data) isQualified = data.some(p => p.id === myId);
        } catch (e) { console.error(e); }
        return `<div class="mission-card-event"><i class="fas ${icon}" style="margin-right:15px; color:gold; font-size:1.2rem;"></i><div style="flex:1;"><b style="font-size:0.85rem;">${title}</b><br><small style="color:${isQualified ? '#00ff88' : '#ff4444'}">${isQualified ? '✓ Terpenuhi' : '✗ Belum Rank '+targetRank}</small></div><button class="btn-confirm" style="min-width:80px; font-size:0.7rem; opacity:${isQualified || isClaimed ? 1 : 0.5}" onclick="${isQualified && !isClaimed ? `app.weeklyEvent.claimMission('${missionId}')` : ''}">${isClaimed ? 'LULUS' : 'KLAIM'}</button></div>`;
    },
    claimMission(id) {
        if (this.data.claimedMissions.includes(id)) return;
        this.data.claimedMissions.push(id);
        this.data.tokens.blue++; 
        this.saveEventData(); 
        this.updateCounters();
        this.renderTabContent(this.activeTab); 
        UIManager.showCustomAlert("BERHASIL", "Token Biru diklaim!", [{ text: "OK" }], "success");
    },
    updateCounters() {
        const b = document.getElementById('ev-blue-count');
        const r = document.getElementById('ev-red-count');
        if(b) b.innerText = this.data.tokens.blue;
        if(r) r.innerText = this.data.tokens.red;
    },
    closeEvent() {
        if(this.isSpinning) return;
        const modal = document.getElementById('modal-weekly-event');
        if(modal) modal.remove();
    }
};

export default WeeklyEventManager;