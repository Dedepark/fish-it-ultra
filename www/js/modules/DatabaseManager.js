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
        console.log("DatabaseManager: Preparing to save game data for user:", userId);
        console.log("DatabaseManager: Full gameData object to be saved:", gameData);

        // --- SIAPKAN DATA YANG AKAN DIKIRIM ---
        // Kita hanya mengirim field yang ada di skema database
        // Ini mencegah masalah jika ada properti tambahan di state
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
            activeBuffs: gameData.activeBuffs // Pastikan ini termasuk
        };

        console.log("DatabaseManager: Data to be sent to Supabase:", dataToSave);

        const { data, error } = await this.client
            .from('game_data')
            .update(dataToSave)
            .eq('user_id', userId)
            .select(); // Tambahkan .select() untuk melihat data yang dikembalikan

        if (error) {
            console.error("DatabaseManager: Supabase error details:", error);
            throw error; // Lempar kembali error untuk ditangkap di catch
        }

        console.log("DatabaseManager: Save successful. Returned data:", data);
        return data;

    } catch (error) {
        console.error("DatabaseManager: Failed to save game data.", error);
        // Kita bisa menampilkan pesan error yang lebih spesifik ke user
        // Tapi untuk saat ini, kita log saja untuk debugging
        throw error; // Lempar error agar bisa ditangkap di pemanggil (misalnya di GameStateManager)
    }
},
    
    // Inventory methods
    async loadInventory(userId) {
        const { data } = await this.client
            .from('fish_inventory')
            .select('*')
            .eq('user_id', userId);
            
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
    
    async sendChatMessage(userId, username, message) {
        return await this.client
            .from('chat_messages')
            .insert({
                user_id: userId,
                username: username,
                message: message
            });
    }
};