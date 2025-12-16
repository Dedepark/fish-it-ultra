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
        
        const rodIdx = GameStateManager.state.gameData.current_rod;
        const rod = RODS_DB[rodIdx] || RODS_DB[0];
        const rodLvl = GameStateManager.state.gameData.rod_levels[rod.id] || 0;
        const totalPower = rod.power + (rodLvl * 0.5);
        
        const wait = Math.max(1000, (Math.random() * 3000 + 2000) / (totalPower * 0.5));
        GameStateManager.state.timers.push(setTimeout(this.fishBite.bind(this), wait));
    },
    
    fishBite() {
        GameStateManager.state.canCatch = true;
        UIManager.updateUI('status', "TARIK"); 
        document.getElementById('bobber').style.transform = "scale(1.3) rotate(20deg)";
        
        if (GameStateManager.state.isAutoFishing) {
            setTimeout(() => this.reelIn(), 500);
            return;
        }
        
        const btn = document.getElementById('btn-cast');
        btn.disabled = false;
        btn.innerText = "TARIK"; 
        btn.classList.add('btn-pull');
        
        GameStateManager.state.timers.push(setTimeout(() => {
            if (GameStateManager.state.canCatch) {
                this.resetFishing("IKAN LEPAS!");
            }
        }, 1500));
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
        
        const currentBest = GameStateManager.state.gameData.best_fish || { price: 0 };
        if (fish.price > currentBest.price) GameStateManager.state.gameData.best_fish = fish;
        MissionManager.updateMissionProgress(fish);

        // --- SIMPAN KE DB SAJA ---
        // JANGAN PUSH KE INVENTORY DI SINI. BIARKAN LISTENER DI InventoryManager YANG KERJA.
        const { data, error } = await DatabaseManager.addFishToInventory(
            GameStateManager.state.user.id,
            fish
        );

        if (!error) {
            GameStateManager.saveState();
            this.resetFishing(fish.name.toUpperCase()); 

            if (fish.rarity === 'ASTRAL') {
                ChatManager.broadcastAstralCatch(GameStateManager.state.username, fish.name);
            }
        } else {
            console.error("Gagal menyimpan ikan:", error);
            this.resetFishing("GAGAL SIMPAN");
        }
    },
    
    gachaFish() {
        const rodIdx = GameStateManager.state.gameData.current_rod;
        const rod = RODS_DB[rodIdx] || RODS_DB[0];
        const rodLvl = GameStateManager.state.gameData.rod_levels[rod.id] || 0;
        const totalPower = rod.power + (rodLvl * 0.5);
        
        let roll = Math.random() * 100;
        let luckBonus = totalPower * 0.0001; 
        
        const now = Date.now();
        GameStateManager.state.activeBuffs = GameStateManager.state.activeBuffs.filter(b => b.endTime > now);
        GameStateManager.state.activeBuffs.forEach(b => {
            luckBonus += (b.boost * 5); 
        });
        
        const finalLuck = roll + luckBonus;
        
        let pool = [];
        let rarity = "";
        
        if (finalLuck > 99.98) { 
            pool = FISH_MASTER.ASTRAL; rarity = "ASTRAL";
        } else if (finalLuck > 99.0) { 
            pool = FISH_MASTER.MISTIS; rarity = "MISTIS";
        } else if (finalLuck > 97.0) { 
            pool = FISH_MASTER.LEGENDARY; rarity = "LEGENDARY";
        } else if (finalLuck > 92.0) { 
            pool = FISH_MASTER.EPIC; rarity = "EPIC";
        } else if (finalLuck > 80.0) { 
            pool = FISH_MASTER.RARE; rarity = "RARE";
        } else {
            pool = FISH_MASTER.COMMON; rarity = "COMMON";
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
        
        if (GameStateManager.state.isAutoFishing) {
            setTimeout(this.castLine.bind(this), 1000);
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