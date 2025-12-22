import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
const { createClient } = supabase;

export const DatabaseManager = {
    client: null,
    
    init: async function() {
        this.client = createClient(SUPABASE_URL, SUPABASE_KEY);
    },
    
    // Game data methods
    async loadGameData(userId) {
        const { data } = await this.client
            .from('game_data')
            .select('*')
            .eq('user_id', userId);
        return data;
    },
    
    async saveGameData(userId, gameData) {
        try {
            const dataToSave = {
                money: gameData.money,
                level: gameData.level,
                owned_rods: gameData.owned_rods,
                current_rod: gameData.current_rod,
                unlocked_fish: gameData.unlocked_fish,
                best_fish: gameData.best_fish,
                diamonds: gameData.diamonds,
                current_exp: gameData.current_exp,
                inventory_items: gameData.inventory_items,
                rod_levels: gameData.rod_levels,
                last_login_date: gameData.last_login_date,
                mission_data: gameData.mission_data,
                activeBuffs: gameData.activeBuffs
            };

            const { data, error } = await this.client
                .from('game_data')
                .update(dataToSave)
                .eq('user_id', userId)
                .select();

            if (error) throw error;
            return data;

        } catch (error) {
            console.error("DatabaseManager: Failed to save game data.", error);
            throw error;
        }
    },
    
    // Inventory methods
    async loadInventory(userId) {
        const { data } = await this.client.from('fish_inventory').select('*').eq('user_id', userId);
        return data;
    },
    
    async addFishToInventory(userId, fish) {
        const { data, error } = await this.client
            .from('fish_inventory')
            .insert({
                user_id: userId,
                fish_name: fish.name,
                rarity: fish.rarity,
                price: fish.price
            })
            .select();
        return { data, error };
    },
    
    // Authentication methods
    async signIn(email, password) {
        return await this.client.auth.signInWithPassword({ email, password });
    },
    
    async signUp(email, password, options) {
        return await this.client.auth.signUp({ email, password, options });
    },
    
    async signOut() {
        return await this.client.auth.signOut();
    },
    
    async getSession() {
        return await this.client.auth.getSession();
    },
    
    // Chat methods
    async loadChatMessages(limit = 50) {
        const { data } = await this.client
            .from('chat_messages')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);
        return data;
    },
    
    // UPDATE: Menambahkan parameter replyTo (default null)
    async sendChatMessage(userId, username, message, replyTo = null) {
        const payload = {
            user_id: userId,
            username: username,
            message: message
        };

        // Jika ada reply data, tambahkan ke payload
        if (replyTo) {
            payload.reply_to = replyTo; // Pastikan kolom 'reply_to' tipe JSONB sudah dibuat di database
        }

        return await this.client
            .from('chat_messages')
            .insert(payload);
    }
};