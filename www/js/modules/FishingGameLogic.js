import { RODS_DB, FISH_MASTER } from '../config.js';
import { SoundManager } from './SoundManager.js';
import { GameStateManager } from './GameStateManager.js';
import { DatabaseManager } from './DatabaseManager.js';
import { UIManager } from './UIManager.js';
import { MissionManager } from './MissionManager.js';
import { ChatManager } from './ChatManager.js';
import { InventoryManager } from './InventoryManager.js';

export const FishingGameLogic = {
    init: function() {
        document.getElementById('btn-cast').addEventListener('click', this.handleCastBtn.bind(this));
        document.getElementById('btn-auto').addEventListener('click', this.toggleAutoFishing.bind(this));
    },
    
    castLine() {
        SoundManager.play('cast');
        if (GameStateManager.state.isFishing) return;
        
        GameStateManager.state.isFishing = true;
        UIManager.updateUI('status', "MENUNGGU"); 
        document.getElementById('bobber').classList.remove('hidden');
        document.getElementById('btn-cast').disabled = true;
        GameStateManager.state.totalCasts++;
        
        // --- AMBIL JORAN BY ID (BIAR JORAN EVENT KEBACA) ---
        const currentRodId = GameStateManager.state.gameData.current_rod;
        const rod = RODS_DB.find(r => r.id === currentRodId) || RODS_DB[0];
        // ----------------------------------------------------
        
        const rodLvl = GameStateManager.state.gameData.rod_levels[rod.id] || 0;
        const totalPower = rod.power + (rodLvl * 0.5);
        
        // --- PERBAIKAN 1: KECEPATAN ---
        // Lama: Math.max(1000, ...) -> Mentok 1 detik
        // Baru: Math.max(100, ...) -> Bisa secepat 0.1 detik kalau power dewa
        // Pembagi juga digedein dikit (totalPower * 0.8) biar makin ngaruh statsnya
        const wait = Math.max(100, (Math.random() * 3000 + 1000) / (totalPower * 0.8));
        
        GameStateManager.state.timers.push(setTimeout(this.fishBite.bind(this), wait));
    },
    
    fishBite() {
        GameStateManager.state.canCatch = true;
        UIManager.updateUI('status', "TARIK"); 
        document.getElementById('bobber').style.transform = "scale(1.3) rotate(20deg)";
        
        // Kalau Auto Fishing + Joran Event (Power > 5000), tarik instan (100ms)
        const rodIdx = GameStateManager.state.gameData.current_rod;
        const rod = RODS_DB.find(r => r.id === rodIdx) || RODS_DB[0];
        const delay = (GameStateManager.state.isAutoFishing && rod.power > 5000) ? 100 : 500;

        if (GameStateManager.state.isAutoFishing) {
            setTimeout(() => this.reelIn(), delay);
            return;
        }
        
        const btn = document.getElementById('btn-cast');
        btn.disabled = false;
        btn.innerText = "TARIK"; 
        btn.classList.add('btn-pull');
        
        // Waktu reaksi (makin tinggi power, makin lama waktu buat klik sebelum lepas)
        const reactionTime = 1500 + (rod.power * 0.1); 

        GameStateManager.state.timers.push(setTimeout(() => {
            if (GameStateManager.state.canCatch) {
                this.resetFishing("IKAN LEPAS!");
            }
        }, reactionTime));
    },
    
    handleCastBtn() {
        if (!GameStateManager.state.isFishing) {
            this.castLine();
        } else if (GameStateManager.state.canCatch) {
            this.reelIn();
        } else {
            this.resetFishing("TERLALU CEPAT!");
        }
    },
    
    async reelIn() {
        if (GameStateManager.state.isFishing && !GameStateManager.state.canCatch) return;

        SoundManager.play('reel');
        GameStateManager.state.canCatch = false;
        
        const fish = this.gachaFish();
        
        GameStateManager.addExperience(1);
        
        if (!GameStateManager.state.gameData.unlocked_fish.includes(fish.name)) {
            GameStateManager.state.gameData.unlocked_fish.push(fish.name);
            if (!document.getElementById('panel-index').classList.contains('hidden')) {
                UIManager.renderIndex();
            }
        }
        
        // LEADERBOARD HARIAN
        if (GameStateManager.state.user && GameStateManager.state.user.id) {
            try {
                const { data: profile } = await DatabaseManager.client
                    .from('profiles')
                    .select('best_fish_price')
                    .eq('id', GameStateManager.state.user.id)
                    .single();

                const currentDailyBest = profile ? profile.best_fish_price : 0;

                if (fish.price > currentDailyBest) {
                    await DatabaseManager.client
                        .from('profiles')
                        .update({ 
                            best_fish_price: fish.price,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', GameStateManager.state.user.id);
                    
                    GameStateManager.state.gameData.best_fish = fish;
                }
            } catch (err) {
                console.error("Leaderboard update error", err);
            }
        }

        MissionManager.updateMissionProgress(fish);

        const { error } = await DatabaseManager.addFishToInventory(
            GameStateManager.state.user.id,
            fish
        );

        if (!error) {
            await GameStateManager.saveState();

            // INTEGRASI EVENT MINGGUAN
            import('./WeeklyEventManager.js').then(({ default: WeeklyEventManager }) => {
                WeeklyEventManager.onFishCaught();
            });
            
            this.resetFishing(fish.name.toUpperCase()); 

            if (fish.rarity === 'ASTRAL') {
                ChatManager.broadcastAstralCatch(GameStateManager.state.username, fish.name);
            }
        } else {
            this.resetFishing("GAGAL SIMPAN");
        }
    },
    
    gachaFish() {
        const rodIdx = GameStateManager.state.gameData.current_rod;
        const rod = RODS_DB.find(r => r.id === rodIdx) || RODS_DB[0]; // FIX ID
        const rodLvl = GameStateManager.state.gameData.rod_levels[rod.id] || 0;
        const totalPower = rod.power + (rodLvl * 0.5);
        
        let roll = Math.random() * 100;
        
        // --- PERBAIKAN 2: LUCK ---
        let luckBonus = totalPower * 0.003; 
        
        const now = Date.now();
        GameStateManager.state.activeBuffs = GameStateManager.state.activeBuffs.filter(b => b.endTime > now);
        GameStateManager.state.activeBuffs.forEach(b => {
            luckBonus += (b.boost * 20); // Boost luck dari potion juga digedein
        });
        
        const finalLuck = roll + luckBonus;
        
        let pool = [];
        let rarity = "";
        
        // Tiering juga disesuaikan biar luck tinggi gak cuma dapet sampah
        if (finalLuck > 120.0) { // Butuh luck bonus buat tembus ini pasti
            pool = FISH_MASTER.ASTRAL; rarity = "ASTRAL";
        } else if (finalLuck > 105.0) { 
            pool = FISH_MASTER.MISTIS; rarity = "MISTIS";
        } else if (finalLuck > 95.0) { 
            pool = FISH_MASTER.LEGENDARY; rarity = "LEGENDARY";
        } else if (finalLuck > 80.0) { 
            pool = FISH_MASTER.EPIC; rarity = "EPIC";
        } else if (finalLuck > 60.0) { 
            pool = FISH_MASTER.RARE; rarity = "RARE";
        } else {
            pool = FISH_MASTER.COMMON; rarity = "COMMON";
        }
        
        // Fallback kalau pool kosong (misal belum ada ikan astral di config)
        if (!pool || pool.length === 0) {
            pool = FISH_MASTER.COMMON;
            rarity = "COMMON";
        }
        
        const fish = pool[Math.floor(Math.random() * pool.length)];
        return { ...fish, rarity: rarity };
    },
    
    resetFishing(msg) {
        GameStateManager.state.isFishing = false;
        GameStateManager.state.canCatch = false;
        UIManager.updateUI('status', msg);
        document.getElementById('bobber').classList.add('hidden');
        document.getElementById('bobber').style.transform = "none";
        
        const btn = document.getElementById('btn-cast');
        btn.disabled = false;
        btn.innerText = "CAST";
        btn.classList.remove('btn-pull');
        
        GameStateManager.state.timers.forEach(t => clearTimeout(t));
        GameStateManager.state.timers = [];
        
        // Auto fishing delay dipercepat buat joran dewa
        const rodIdx = GameStateManager.state.gameData.current_rod;
        const rod = RODS_DB.find(r => r.id === rodIdx) || RODS_DB[0];
        const autoDelay = (rod.power > 5000) ? 200 : 1000;

        if (GameStateManager.state.isAutoFishing) {
            setTimeout(this.castLine.bind(this), autoDelay);
        }
    },
    
    toggleAutoFishing() {
        GameStateManager.state.isAutoFishing = !GameStateManager.state.isAutoFishing;
        const btn = document.getElementById('btn-auto');
        btn.innerText = `AUTO: ${GameStateManager.state.isAutoFishing ? 'ON' : 'OFF'}`;
        
        if (GameStateManager.state.isAutoFishing && !GameStateManager.state.isFishing) {
            this.castLine();
        }
    }
};