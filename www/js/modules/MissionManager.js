import { DAILY_REWARDS, formatMoney } from '../config.js'; // <<< FIX: IMPORT formatMoney LANGSUNG
import { GameStateManager } from './GameStateManager.js';
import { UIManager } from './UIManager.js';

export const MissionManager = {
    init: function() {
        // Cek dulu user ada gak
        if (!GameStateManager.state.user) return;

        this.checkDailyMissionsReset();
        
        // Timer Jalan Setiap 1 Menit
        setInterval(() => {
            if (!GameStateManager.state.user || !GameStateManager.state.gameData.mission_data) return;
            
            const today = new Date().toDateString();
            if (GameStateManager.state.gameData.mission_data.date === today) {
                
                if (!GameStateManager.state.gameData.mission_data.progress) {
                    GameStateManager.state.gameData.mission_data.progress = {};
                }
                
                // Simpan data (untuk menjaga keaktifan sesi)
                GameStateManager.saveState();

                // UPDATE TAMPILAN LIVE (Supaya gak perlu tutup-buka modal)
                const modal = document.getElementById('modal-missions');
                if (modal && !modal.classList.contains('hidden')) {
                    this.openDailyMissions(); 
                }
            } else {
                this.checkDailyMissionsReset();
            }
        }, 60000); 
    },
    
    checkDailyMissionsReset() {
        // Pengaman: User harus ada
        if (!GameStateManager.state.user) return;

        const today = new Date().toDateString();
        
        if (!GameStateManager.state.gameData.mission_data) {
            GameStateManager.state.gameData.mission_data = { date: null, progress: {}, claimed: [] };
        }

        if (GameStateManager.state.gameData.mission_data.date !== today) {
            console.log("Resetting Daily Missions...");
            GameStateManager.state.gameData.mission_data = {
                date: today,
                progress: {
                    common: 0, rare: 0, epic: 0, legendary: 0, mistis: 0, astral: 0 
                },
                claimed: []
            };
            GameStateManager.saveState();
        }
    },
    
    updateMissionProgress(fish) {
        if (!GameStateManager.state.gameData.mission_data.progress) {
            this.checkDailyMissionsReset();
        }

        const progress = GameStateManager.state.gameData.mission_data.progress;
        const key = fish.rarity.toLowerCase(); 
        
        if (typeof progress[key] === 'undefined') progress[key] = 0;

        if (fish.rarity === 'COMMON') progress.common++;
        if (fish.rarity === 'RARE') progress.rare++;
        if (fish.rarity === 'EPIC') progress.epic++;
        if (fish.rarity === 'LEGENDARY') progress.legendary++;
        if (fish.rarity === 'MISTIS') progress.mistis++;
        if (fish.rarity === 'ASTRAL') progress.astral++;
    },
    
    openDailyMissions() {
        const progress = GameStateManager.state.gameData.mission_data.progress || {};
        const currentMoney = GameStateManager.state.gameData.money || 0; 

        const missions = [
            { t: "100 Common", c: progress.common || 0, m: 100 },
            { t: "50 Rare", c: progress.rare || 0, m: 50 },
            { t: "20 Epic", c: progress.epic || 0, m: 20 },
            { t: "5 Legendary", c: progress.legendary || 0, m: 5 },
            { t: "1 Mistis", c: progress.mistis || 0, m: 1 },
            { t: "1 Astral", c: progress.astral || 0, m: 1 },
            { t: "Uang 500Jt", c: currentMoney, m: 500000000 } 
        ];
        
        let completedCount = missions.filter(m => m.c >= m.m).length;
        const totalBaseMissions = 7;
        
        missions.push({ t: "Semua Selesai", c: completedCount, m: totalBaseMissions });
        if (completedCount >= totalBaseMissions) completedCount++;

        let html = '';
        missions.forEach(mission => {
            let displayCurrent;
            let displayMax;
            
            if (mission.t === "Uang 500Jt") {
                // <<< FIX: MENGGUNAKAN formatMoney LANGSUNG
                displayCurrent = (mission.c >= mission.m) ? formatMoney(mission.m) : formatMoney(mission.c);
                displayMax = formatMoney(mission.m);
            } else {
                displayCurrent = Math.min(mission.c, mission.m);
                displayMax = mission.m;
            }

            const isDone = mission.c >= mission.m;
            const percentage = Math.min(100, (mission.c / mission.m) * 100);
            
            html += `
                <div class="mission-row ${isDone ? 'done' : ''}">
                    <div class="mission-title">
                        <span>${mission.t}</span>
                        ${isDone ? '<i class="fa-solid fa-check" style="color:#2ecc71"></i>' : ''}
                    </div>
                    <div class="mission-mini-bar">
                        <div class="mission-mini-fill" style="width:${percentage}%"></div>
                    </div>
                    <div class="mission-count">${displayCurrent}/${displayMax}</div>
                </div>
            `;
        });
        
        document.getElementById('mission-list').innerHTML = html;
        
        const progressFill = document.getElementById('mission-progress-fill');
        const fillPercent = Math.min(100, (completedCount / 8) * 100);
        progressFill.style.width = `${fillPercent}%`;
        
        const claimedList = GameStateManager.state.gameData.mission_data.claimed || [];
        
        document.querySelectorAll('.chest-icon').forEach(el => {
            const required = parseInt(el.dataset.milestone);
            el.className = 'chest-icon'; 
            el.onclick = null; 
            
            if (claimedList.includes(required)) {
                el.classList.add('claimed');
                el.innerHTML = '<i class="fa-solid fa-check-circle"></i>'; 
            } else if (completedCount >= required) {
                el.classList.add('unlocked');
                el.innerHTML = '<i class="fa-solid fa-box-open"></i>';
                el.onclick = () => this.claimMissionReward(required);
            } else {
                el.innerHTML = '<i class="fa-solid fa-box"></i>';
            }
        });
        
        UIManager.showModal('modal-missions');
    },
    
    async claimMissionReward(milestone) {
        const claimedList = GameStateManager.state.gameData.mission_data.claimed;
        if (claimedList.includes(milestone)) return;
        
        let rewardText = "";
        
        if (milestone === 2) {
            GameStateManager.state.gameData.money += 5000000; rewardText = "5 Juta";
        } else if (milestone === 4) {
            GameStateManager.state.gameData.diamonds += 500; rewardText = "500 Diamond";
        } else if (milestone === 6) {
            GameStateManager.state.gameData.money += 10000000; rewardText = "10 Juta";
        } else if (milestone === 8) {
            GameStateManager.state.gameData.diamonds += 1500; rewardText = "1500 Diamond";
        }
        
        claimedList.push(milestone);
        await GameStateManager.saveState();
        
        this.openDailyMissions();
        UIManager.updateUI();
        
        UIManager.showCustomAlert("HADIAH MISI", `Selamat! Kamu mendapatkan:\n${rewardText}`, [{ text: "MANTAP" }], 'success');
    },
    
    openDailyLogin() {
        const today = new Date().toDateString();
        const lastLoginDate = GameStateManager.state.gameData.last_login_date;
        let todayIndex = new Date().getDay(); 
        
        let html = '';
        DAILY_REWARDS.forEach(reward => {
            const isToday = reward.d === todayIndex;
            const isClaimed = isToday && lastLoginDate === today;
            const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
            
            html += `
                <div class="daily-day ${isToday ? 'active' : ''} ${isClaimed ? 'claimed' : ''}" 
                     onclick="${isToday && !isClaimed ? 'app.mission.claimDailyLoginLogic()' : ''}"> 
                    <div style="font-weight:900;">${dayNames[reward.d]}</div>
                    <i class="fa-solid ${reward.t === 'money' ? 'fa-coins' : 'fa-gem'}" 
                       style="color:${reward.t === 'money' ? 'gold' : '#00d2ff'}"></i>
                    <small>${reward.v / 1000}k</small>
                    ${isToday && !isClaimed ? '<div style="color:#00d2ff;font-size:0.6rem;animation:blink 1s infinite;">KLAIM</div>' : ''}
                    ${isClaimed ? '<i class="fa-solid fa-check" style="color:#2ecc71"></i>' : ''}
                </div>
            `;
        });
        document.getElementById('daily-grid').innerHTML = html;
        UIManager.showModal('modal-daily-login');
    },

    async claimDailyLoginLogic() {
        const today = new Date().toDateString();
        if (GameStateManager.state.gameData.last_login_date === today) return;

        const dayIndex = new Date().getDay();
        const reward = DAILY_REWARDS.find(r => r.d === dayIndex);
        
        if (!reward) return;
        
        if (reward.t === 'money') GameStateManager.state.gameData.money += reward.v;
        else GameStateManager.state.gameData.diamonds += reward.v;
        
        GameStateManager.state.gameData.last_login_date = today;
        await GameStateManager.saveState();
        
        UIManager.updateUI();
        this.openDailyLogin();
        UIManager.showCustomAlert("LOGIN HARIAN", "Hadiah diterima!", [{ text: "OK" }], 'success');
    }
};