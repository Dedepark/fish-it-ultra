import { RODS_DB, ENCHANT_STONES, POTIONS } from '../config.js';
import { formatMoney } from '../config.js';
import { GameStateManager } from './GameStateManager.js';
import { DatabaseManager } from './DatabaseManager.js';
import { UIManager } from './UIManager.js';

export const ShopManager = {
    init: function() {
        // Set up shop tab switching
        document.querySelectorAll('#panel-shop .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('onclick').match(/'([^']+)'/)[1];
                this.switchShopTab(tab);
            });
        });
    },
    
    switchShopTab(tab) {
        GameStateManager.state.activeShopTab = tab;
        const idx = tab === 'rods' ? 0 : tab === 'stones' ? 1 : 2;
        
        document.querySelectorAll('#panel-shop .tab-btn').forEach(b => {
            b.classList.remove('active');
        });
        document.querySelectorAll('#panel-shop .tab-btn')[idx].classList.add('active');
        
        document.querySelectorAll('.shop-content').forEach(c => {
            c.classList.add('hidden');
        });
        document.getElementById(`shop-${tab}`).classList.remove('hidden');
        
        this.renderShop();
    },
    
    renderShop() {
        this.renderRods();
        this.renderStones();
        this.renderPotions();
    },
    
renderRods() {
    const container = document.getElementById('shop-rods');
    container.innerHTML = '';
    
    RODS_DB.forEach(rod => {
        const isOwned = GameStateManager.state.gameData.owned_rods.includes(rod.id);
        const isEquipped = GameStateManager.state.gameData.current_rod === rod.id;
        const level = GameStateManager.state.gameData.rod_levels[rod.id] || 0;
        
        const rodCard = document.createElement('div');
        rodCard.className = 'shop-item-card';
        
        let buttonHtml = '';
        if (isOwned) {
            // Jika sudah dimiliki, cukup tampilkan levelnya, tanpa tombol
            buttonHtml = `<small style="color:gold">Dimiliki (Lv.${level})</small>`;
        } else {
            // Jika belum dimiliki, tampilkan tombol beli
            buttonHtml = `<button onclick="app.shop.buyRod(${rod.id})" class="btn-buy-money">BELI (${formatMoney(rod.price)})</button>`;
        }
        
        rodCard.innerHTML = `
            <!-- GANTI IKON DI SINI -->
            <span style="font-size: 2rem; margin-bottom: 5px; display: block;">🎣</span>
            <b>${rod.name}</b>
            <small>Power: ${rod.power}x</small>
            ${buttonHtml}
        `;
        
        container.appendChild(rodCard);
    });
},
    
    renderStones() {
        const container = document.getElementById('shop-stones');
        container.innerHTML = '';
        
        ENCHANT_STONES.forEach(stone => {
            const stoneCard = document.createElement('div');
            stoneCard.className = 'shop-item-card';
            stoneCard.style.borderColor = stone.color;
            
            stoneCard.innerHTML = `
                <i class="fa-solid fa-gem" style="color:${stone.color};font-size:2rem;margin-bottom:5px;"></i>
                <b>${stone.name}</b>
                <small>Chance:${stone.chance*100}%</small>
                <button onclick="app.shop.buyItem('${stone.id}',${stone.price})" class="btn-buy-dia">${stone.price} 💎</button>
            `;
            
            container.appendChild(stoneCard);
        });
    },
    
    renderPotions() {
        const container = document.getElementById('shop-potions');
        container.innerHTML = '';
        
        POTIONS.forEach(potion => {
            const potionCard = document.createElement('div');
            potionCard.className = 'shop-item-card';
            potionCard.style.borderColor = potion.color;
            
            potionCard.innerHTML = `
                <i class="fa-solid fa-flask" style="color:${potion.color};font-size:2rem;margin-bottom:5px;"></i>
                <b>${potion.name}</b>
                <small>Luck +${potion.boost*100}%</small>
                <button onclick="app.shop.buyItem('${potion.id}',${potion.price})" class="btn-buy-dia">${potion.price} 💎</button>
            `;
            
            container.appendChild(potionCard);
        });
    },
    
    async buyRod(id) {
        const rod = RODS_DB[id];
        
        if (GameStateManager.state.gameData.money < rod.price) {
            UIManager.showCustomAlert("GAGAL", "Uang kurang", [{ text: "OK" }]);
            return;
        }
        
        GameStateManager.state.gameData.money -= rod.price;
        GameStateManager.state.gameData.owned_rods.push(id);
        
        await GameStateManager.saveState();
        UIManager.updateUI();
        this.renderShop();
    },
    
    async buyItem(id, price) {
        if (GameStateManager.state.gameData.diamonds < price) {
            UIManager.showCustomAlert("GAGAL", "Berlian kurang", [{ text: "OK" }]);
            return;
        }
        
        GameStateManager.state.gameData.diamonds -= price;
        
        if (!GameStateManager.state.gameData.inventory_items[id]) {
            GameStateManager.state.gameData.inventory_items[id] = 0;
        }
        
        GameStateManager.state.gameData.inventory_items[id]++;
        
        await GameStateManager.saveState();
        UIManager.updateUI();
        
        UIManager.showCustomAlert("SUKSES", "Item dibeli!", [{ text: "OK" }], 'success');
    },
    
async equipRod(id) {
    GameStateManager.state.gameData.current_rod = id;
    
    await GameStateManager.saveState();
    
    // --- TAMBAHKAN INI ---
    // Perbarui UI untuk menampilkan joran baru yang aktif
    UIManager.updateUI();
}
};