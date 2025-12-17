import { DatabaseManager } from './DatabaseManager.js';
import { UIManager } from './UIManager.js';
import { getRank } from '../config.js'; 

export const GameStateManager = {
    state: {
        user: null,
        username: "Player",
        targetUserId: null,
        targetUsername: null,
        gameData: {
            money: 0,
            diamonds: 0,
            level: 1,
            current_exp: 0,
            owned_rods: [0],
            current_rod: 0,
            unlocked_fish: [],
            inventory_items: {},
            rod_levels: {},
            mission_data: {
                date: null,
                progress: {}
            },
            last_login_date: null,
            activeBuffs: []
        },
        inventory: [],
        groupedInventory: [],
        selectedFish: null,
        isFishing: false,
        canCatch: false,
        isAutoFishing: false,
        isSelfCatch: false,
        timers: [],
        alertCallback: null,
        totalCasts: 0,
        activeNotificationCount: 0,
        eventSidebarOpen: false,
        eventEndTime: null,
        chatMessagesLoaded: false,
        lastChatMessageId: null,
        unreadChatCount: 0,
        newFishCount: 0,
        lastViewedChatTime: null,
        lastViewedInventoryTime: null,
        invPage: 0,
        indexPage: 0,
        itemsPerPage: 20,
        flatIndexList: [],
        observer: null,
        activeShopTab: 'rods',
        activeInvTab: 'fish',
        activeBuffs: []
    },
    
    init: async function() {
        console.log("GameStateManager: Initializing...");
        
        const { data: { session } } = await DatabaseManager.getSession();
        
        if (session) {
            console.log("GameStateManager: Session found for user:", session.user.id);
            this.state.user = session.user;
            if (session.user.user_metadata?.username) {
                this.state.username = session.user.user_metadata.username;
            }
            
            const gameData = await DatabaseManager.loadGameData(this.state.user.id);
    
            if (gameData && gameData.length > 0) {
                this.state.gameData = this.sanitizeGameData(gameData[0]);
            } else {
                this.state.gameData = this.getDefaultGameData();
                await DatabaseManager.saveGameData(this.state.user.id, this.state.gameData);
            }
            
            if (this.state.gameData.activeBuffs) {
                const now = Date.now();
                this.state.activeBuffs = this.state.gameData.activeBuffs.filter(b => b.endTime > now);
                this.state.gameData.activeBuffs = this.state.activeBuffs;
            } else {
                this.state.activeBuffs = [];
            }
            
            const inventory = await DatabaseManager.loadInventory(this.state.user.id);
    
            if (inventory) {
                this.state.inventory = inventory.map(fish => ({ 
                    ...fish, 
                    is_locked: !!fish.is_locked 
                }));
                this.groupInventoryItems();
            }
        } else {
            console.log("GameStateManager: No session found.");
        }
    },
        
    sanitizeGameData(gameData) {
        return {
            ...gameData,
            diamonds: gameData.diamonds || 0,
            level: gameData.level || 1,
            current_exp: gameData.current_exp || 0,
            inventory_items: gameData.inventory_items || {},
            rod_levels: gameData.rod_levels || {},
            mission_data: {
                date: gameData.mission_data?.date || null,
                progress: gameData.mission_data?.progress || {},
                claimed: gameData.mission_data?.claimed || []
            },
            best_fish: gameData.best_fish || null,
            activeBuffs: gameData.activeBuffs || [] 
        };
    },
    
    getDefaultGameData() {
        return {
            money: 0,
            diamonds: 0,
            level: 1,
            current_exp: 0,
            current_rod: 0,
            owned_rods: [0],
            unlocked_fish: [],
            inventory_items: {},
            rod_levels: {},
            mission_data: {
                date: null,
                progress: {},
                claimed: []
            },
            last_login_date: null,
            best_fish: null,
            activeBuffs: [] 
        };
    },
        
    async saveState() {
        if (!this.state.user || !this.state.user.id) {
            return; 
        }

        try {
            this.state.gameData.activeBuffs = this.state.activeBuffs;
            
            // 1. Simpan Data Game Utama (JSON)
            await DatabaseManager.saveGameData(this.state.user.id, this.state.gameData);

            // 2. 🔥 UPDATE LEADERBOARD (SYNC PROFILES) 🔥
            // Ini yang bikin Leaderboard lu gak error lagi
            await DatabaseManager.client.from('profiles').update({
                money: this.state.gameData.money,
                level: this.state.gameData.level
            }).eq('id', this.state.user.id);

        } catch (error) {
            console.error("GameStateManager: Failed to save game data.", error);
        }
    },
        
    groupInventoryItems() {
        const grouped = {};
        this.state.inventory.forEach(item => {
            const key = `${item.fish_name}_${item.rarity}`;
            if (!grouped[key]) {
                grouped[key] = {
                    fish_name: item.fish_name,
                    rarity: item.rarity,
                    price: item.price,
                    count: 0,
                    lockedCount: 0,
                    ids: [],
                    isAllLocked: false
                };
            }
            
            grouped[key].count++;
            grouped[key].ids.push(item.id);
            
            if (item.is_locked) {
                grouped[key].lockedCount++;
            }
            
            grouped[key].isAllLocked = grouped[key].count === grouped[key].lockedCount;
        });
        
        let groupedArray = Object.values(grouped);
    
        groupedArray.sort((a, b) => {
            if (a.isAllLocked && !b.isAllLocked) return -1;
            if (!a.isAllLocked && b.isAllLocked) return 1;
    
            const rankA = typeof getRank === 'function' ? getRank(a.rarity) : 0;
            const rankB = typeof getRank === 'function' ? getRank(b.rarity) : 0;
    
            if (rankA !== rankB) return rankB - rankA;
    
            return a.fish_name.localeCompare(b.fish_name);
        });
    
        this.state.groupedInventory = groupedArray;
    },
        
    addExperience(amount) {
        this.state.gameData.current_exp += amount;
        const requiredExp = this.state.gameData.level * 10;
        
        if (this.state.gameData.current_exp >= requiredExp) {
            this.state.gameData.level++;
            this.state.gameData.current_exp = 0;
            this.state.gameData.diamonds += 100;
            
            UIManager.showCustomAlert(
                "LEVEL UP!", 
                `Naik ke Lv.${this.state.gameData.level}!\nHadiah: 100 Berlian`, 
                [{text: "MANTAP"}], 
                'success'
            );
            
            // Trigger save biar level baru langsung update di leaderboard
            this.saveState();
        }
        
        UIManager.updateUI();
    }
};