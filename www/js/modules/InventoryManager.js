import { ENCHANT_STONES, POTIONS, formatMoney, RODS_DB, FISH_MASTER } from '../config.js';
import { GameStateManager } from './GameStateManager.js';
import { DatabaseManager } from './DatabaseManager.js';
import { UIManager } from './UIManager.js';

export const InventoryManager = {
    selectedEnchantRodId: null,
    inventoryChannel: null, 

    init: function() {
        // Tab switching logic
        document.querySelectorAll('#panel-inventory .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('onclick').match(/'([^']+)'/)[1];
                this.switchInvTab(tab);
            });
        });
        
        // Sell button
        const sellBtn = document.querySelector('.btn-sell');
        if(sellBtn) sellBtn.addEventListener('click', this.sellAll.bind(this));
    },
    
    async loadInventory() {
        const inventory = await DatabaseManager.loadInventory(GameStateManager.state.user.id);
        
        if (inventory) {
            GameStateManager.state.inventory = inventory.map(fish => ({ 
                ...fish, 
                is_locked: !!fish.is_locked 
            }));
            GameStateManager.groupInventoryItems();
        }
    },
    
    setupInventoryListener() {
        if (this.inventoryChannel) {
            DatabaseManager.client.removeChannel(this.inventoryChannel);
        }

        this.inventoryChannel = DatabaseManager.client
            .channel('public:fish_inventory')
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'fish_inventory',
                    filter: `user_id=eq.${GameStateManager.state.user.id}`
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newFish = payload.new;
                        
                        // SATPAM ANTI DUPLIKAT
                        const isDuplicate = GameStateManager.state.inventory.some(item => item.id === newFish.id);
                        if (isDuplicate) return;

                        GameStateManager.state.inventory.push({
                            ...newFish,
                            is_locked: !!newFish.is_locked
                        });
                        
                        GameStateManager.groupInventoryItems();
                        UIManager.updateInventoryNotification(true);
                        
                        if (GameStateManager.state.activeInvTab === 'fish' && 
                            !document.getElementById('panel-inventory').classList.contains('hidden')) {
                            this.renderFishInventory();
                        }

                    } else if (payload.eventType === 'DELETE') {
                        // Listener ini tetap jalan sebagai backup
                        // Tapi UI utama sudah dihandle Optimistic Update di sellAll()
                         GameStateManager.state.inventory = GameStateManager.state.inventory.filter(
                            item => item.id !== payload.old.id
                        );
                        GameStateManager.groupInventoryItems();
                        if (GameStateManager.state.activeInvTab === 'fish') this.renderFishInventory();
                    
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedFish = payload.new;
                        GameStateManager.state.inventory = GameStateManager.state.inventory.map(item => 
                            item.id === updatedFish.id ? { ...updatedFish, is_locked: !!updatedFish.is_locked } : item
                        );
                        GameStateManager.groupInventoryItems();
                        if (GameStateManager.state.activeInvTab === 'fish') this.renderFishInventory();
                    }
                }
            )
            .subscribe();
    },
    
    switchInvTab(tab) {
        GameStateManager.state.activeInvTab = tab;
        const idx = tab === 'fish' ? 0 : 1;
        
        document.querySelectorAll('#panel-inventory .tab-btn').forEach(b => {
            b.classList.remove('active');
        });
        document.querySelectorAll('#panel-inventory .tab-btn')[idx].classList.add('active');
        
        document.querySelectorAll('#panel-inventory .tab-content').forEach(c => {
            c.classList.add('hidden');
        });
        document.getElementById(`inv-tab-${tab}`).classList.remove('hidden');
        
        this.renderInventory();
    },
    
    renderInventory() {
        if (GameStateManager.state.activeInvTab === 'fish') {
            this.renderFishInventory();
        } else {
            this.renderItemsInventory();
        }
    },
    
    renderFishInventory() {
        const container = document.getElementById('inventory-list');
        container.innerHTML = '';
        
        GameStateManager.state.groupedInventory.forEach(item => {
            const originalFishData = FISH_MASTER[item.rarity]?.find(f => f.name === item.fish_name);
            const cssClass = originalFishData ? originalFishData.class : `fish-${item.rarity.toLowerCase()}`;

            const fishCard = document.createElement('div');
            fishCard.className = `fish-item ${cssClass}`;
            
            if (item.isAllLocked) {
                fishCard.classList.add('fish-card-locked');
            }

            fishCard.innerHTML = `
                <div class="fish-icon">🐟</div>
                <div class="fish-name">${item.fish_name}</div>
                <div class="fish-price">${formatMoney(item.price)}</div>
                <div class="fish-count">x${item.count}</div>
                ${item.isAllLocked ? `
                    <div class="lock-overlay">
                        <i class="fa-solid fa-lock"></i>
                        <span>TERKUNCI</span>
                    </div>
                ` : ''}
            `;
            
            fishCard.addEventListener('click', () => {
                this.selectFish(item);
            });
            
            container.appendChild(fishCard);
        });
    },
    
    renderItemsInventory() {
        const container = document.getElementById('items-list');
        container.innerHTML = '';
        
        const ownedRods = GameStateManager.state.gameData.owned_rods;
        const currentRodId = GameStateManager.state.gameData.current_rod;
        const items = GameStateManager.state.gameData.inventory_items;

        let hasContent = false;

        // RENDER JORAN
        if (ownedRods && ownedRods.length > 0) {
            hasContent = true;
            const rodHeader = document.createElement('div');
            rodHeader.className = 'rarity-header';
            rodHeader.textContent = 'JORAN YANG DIMILIKI';
            container.appendChild(rodHeader);

            ownedRods.forEach(rodId => {
                const rod = RODS_DB.find(r => r.id == rodId);
                const rodLvl = GameStateManager.state.gameData.rod_levels[rodId] || 0;
                const isEquipped = (rodId == currentRodId);

                if (rod) {
                    const rodCard = document.createElement('div');
                    rodCard.className = 'shop-item-card';
                    
                    if (isEquipped) rodCard.style.borderColor = '#00ff88'; 

                    const leftAction = isEquipped 
                        ? `<div class="status-equipped">DIPAKAI</div>` 
                        : `<button onclick="app.inventory.equipRod(${rod.id})" class="btn-equip">PAKAI</button>`;

                    rodCard.innerHTML = `
                        <span style="font-size: 2rem; margin-bottom: 5px; display: block;">🎣</span>
                        <b>${rod.name}</b>
                        <small>Power: ${rod.power}x</small>
                        <small style="color:gold">Lv.${rodLvl}</small>
                        <div class="item-actions">
                            ${leftAction}
                            <button onclick="app.inventory.openEnchantModal(${rod.id})" class="btn-enchant">ENCHANT</button>
                        </div>
                    `;
                    container.appendChild(rodCard);
                }
            });
        }

        // RENDER ITEM
        if (items && Object.keys(items).length > 0) {
            hasContent = true;
            const itemHeader = document.createElement('div');
            itemHeader.className = 'rarity-header';
            itemHeader.textContent = 'ITEM KONSUMSI';
            container.appendChild(itemHeader);

            Object.keys(items).forEach(itemId => {
                const count = items[itemId];
                const item = [...ENCHANT_STONES, ...POTIONS].find(i => i.id === itemId);
                
                if (item) {
                    const itemCard = document.createElement('div');
                    itemCard.className = 'shop-item-card';
                    itemCard.style.borderColor = item.color;
                    itemCard.innerHTML = `
                        <i class="fa-solid ${item.type === 'stone' ? 'fa-gem' : 'fa-flask'}" 
                           style="color:${item.color};font-size:2rem;margin-bottom:5px;"></i>
                        <b>${item.name}</b>
                        <small>${item.type === 'stone' ? `Chance:${item.chance*100}%` : `Luck +${item.boost*100}%`}</small>
                        <div class="item-count">x${count}</div>
                        <button onclick="app.inventory.useItem('${itemId}')" class="btn-equip" style="width:100%; margin-top:10px; background:#555 !important; box-shadow:none !important;" disabled>GUNAKAN DI GAME</button>
                    `;
                    
                    itemCard.addEventListener('click', () => {
                       this.useItem(itemId);
                    });

                    container.appendChild(itemCard);
                }
            });
        }

        if (!hasContent) {
            container.innerHTML = '<p style="text-align:center; color:#888;">Kamu belum memiliki item apapun. Beli di Toko!</p>';
        }
    },

    selectFish(fish) {
        GameStateManager.state.selectedFish = fish;
        UIManager.showModal('modal-fish');
        document.getElementById('modal-fish-name').textContent = fish.fish_name;
        document.getElementById('modal-fish-icon').className = `fish-detail-icon ${fish.rarity.toLowerCase()}`;
        document.getElementById('modal-fish-rarity').textContent = fish.rarity;
        document.getElementById('modal-fish-price').textContent = formatMoney(fish.price);
        document.getElementById('modal-fish-count').textContent = `Dimiliki: ${fish.count}`;
        
        const lockBtn = document.getElementById('btn-lock');
        if (fish.isAllLocked) {
            lockBtn.textContent = 'BUKA KUNCI';
        } else {
            lockBtn.textContent = 'KUNCI';
        }
    },
    
    async actionLockFish() {
        if (!GameStateManager.state.selectedFish) return;
        const fish = GameStateManager.state.selectedFish;
        const isAllLocked = fish.isAllLocked;
        
        for (const id of fish.ids) {
            await DatabaseManager.client.from('fish_inventory').update({ is_locked: !isAllLocked }).eq('id', id);
        }
        UIManager.closeModal('modal-fish');
    },
    
    actionShareFish() {
        if (!GameStateManager.state.selectedFish) return;
        const fish = GameStateManager.state.selectedFish;
        const message = `Saya dapat ${fish.fish_name} (${fish.rarity})!`;
        import('./ChatManager.js').then(({ ChatManager }) => {
            ChatManager.sendMessage(message);
        });
        UIManager.closeModal('modal-fish');
    },
    
    // --- FUNGSI JUAL IKAN (OPTIMISTIC UPDATE) ---
    async sellAll() {
        const unlockedFish = GameStateManager.state.inventory.filter(fish => !fish.is_locked);
        
        if (unlockedFish.length === 0) {
            UIManager.showCustomAlert("INFO", "Tidak ada ikan yang bisa dijual (semua terkunci)", [{ text: "OK" }]);
            return;
        }
        
        let totalValue = 0;
        unlockedFish.forEach(fish => { totalValue += fish.price; });
        
        UIManager.showCustomAlert(
            "KONFIRMASI JUAL", 
            `Jual ${unlockedFish.length} ikan seharga ${formatMoney(totalValue)}?`, 
            [
                { text: "Batal", isCancel: true },
                {
                    text: "JUAL",
                    isConfirm: true,
                    onClick: async () => {
                        // 1. Ambil ID ikan yang mau dihapus
                        const idsToDelete = unlockedFish.map(fish => fish.id);
                        
                        // 2. Request ke Database
                        const { error } = await DatabaseManager.client.from('fish_inventory').delete().in('id', idsToDelete);
                        
                        if (!error) {
                            // 3. OPTIMISTIC UPDATE: Langsung update data LOKAL sekarang juga!
                            // Jangan nunggu listener. Hapus manual dari state.
                            GameStateManager.state.inventory = GameStateManager.state.inventory.filter(fish => fish.is_locked);
                            
                            // 4. Update Uang & Save
                            GameStateManager.state.gameData.money += totalValue;
                            GameStateManager.saveState();
                            
                            // 5. Render Ulang UI DETIK ITU JUGA
                            GameStateManager.groupInventoryItems();
                            this.renderFishInventory(); 
                            UIManager.updateUI(); // Update uang di header
                            UIManager.updateInventoryNotification(false); // Reset badge notif
                            
                            UIManager.showCustomAlert("BERHASIL", `Terjual seharga ${formatMoney(totalValue)}!`, [{ text: "OK" }], 'success');
                        } else {
                            UIManager.showCustomAlert("ERROR", "Gagal menjual ikan.", [{ text: "OK" }]);
                        }
                    }
                }
            ]
        );
    },
    
    async useItem(itemId) {
        const item = [...ENCHANT_STONES, ...POTIONS].find(i => i.id === itemId);
        if (!item || !GameStateManager.state.gameData.inventory_items[itemId] || GameStateManager.state.gameData.inventory_items[itemId] <= 0) return;
        
        if (item.type === 'potion') {
            const now = Date.now();
            const endTime = now + (5 * 60 * 1000); 
            GameStateManager.state.activeBuffs.push({ type: 'luck', boost: item.boost, endTime: endTime });
            
            GameStateManager.state.gameData.inventory_items[itemId]--;
            if (GameStateManager.state.gameData.inventory_items[itemId] <= 0) delete GameStateManager.state.gameData.inventory_items[itemId];
            
            await GameStateManager.saveState();
            UIManager.updateUI();
            this.renderItemsInventory();
            UIManager.showCustomAlert("BERHASIL", `${item.name} digunakan!`, [{ text: "OK" }], 'success');
        }
    },

    async equipRod(rodId) {
        GameStateManager.state.gameData.current_rod = rodId;
        await GameStateManager.saveState();
        UIManager.updateUI();
        this.renderItemsInventory();
    },

    openEnchantModal(rodId) {
        this.selectedEnchantRodId = rodId;
        const rod = RODS_DB.find(r => r.id == rodId);
        const currentLevel = GameStateManager.state.gameData.rod_levels[rodId] || 0;

        document.getElementById('enchant-rod-name').textContent = rod.name;
        document.getElementById('enchant-rod-level').textContent = `Level: ${currentLevel}`;

        const stonesContainer = document.getElementById('enchant-stones-list');
        stonesContainer.innerHTML = '';

        const ownedStones = GameStateManager.state.gameData.inventory_items;
        let hasAvailableStones = false;

        ENCHANT_STONES.forEach(stone => {
            const count = ownedStones[stone.id] || 0;
            if (count > 0) {
                hasAvailableStones = true;
                const stoneCard = document.createElement('div');
                stoneCard.className = 'shop-item-card';
                stoneCard.style.borderColor = stone.color;
                stoneCard.innerHTML = `
                    <i class="fa-solid fa-gem" style="color:${stone.color};font-size:2rem;margin-bottom:5px;"></i>
                    <b>${stone.name}</b>
                    <small>Chance: ${stone.chance*100}%</small>
                    <div class="item-count">x${count}</div>
                `;
                stoneCard.addEventListener('click', () => {
                    this.processEnchantment(rodId, stone.id);
                });
                stonesContainer.appendChild(stoneCard);
            }
        });

        if (!hasAvailableStones) {
            stonesContainer.innerHTML = '<p style="text-align:center; color:#888;">Kamu tidak memiliki batu enchant.</p>';
        }

        UIManager.showModal('modal-enchant-rod');
    },

    closeEnchantModal() {
        UIManager.closeModal('modal-enchant-rod');
        this.selectedEnchantRodId = null;
    },

    async processEnchantment(rodId, stoneId) {
        const stone = ENCHANT_STONES.find(s => s.id === stoneId);
        const rod = RODS_DB.find(r => r.id == rodId); 
        const currentLevel = GameStateManager.state.gameData.rod_levels[rodId] || 0;
        
        if (!stone || !rod) return; 

        UIManager.showCustomAlert(
            "KONFIRMASI ENCHANT",
            `Gunakan ${stone.name} (${stone.chance*100}%) pada ${rod.name} Level ${currentLevel}?`,
            [
                { text: "Batal", isCancel: true },
                {
                    text: "Enchant",
                    isConfirm: true,
                    onClick: async () => {
                        // 1. Kurangi jumlah batu
                        GameStateManager.state.gameData.inventory_items[stoneId]--;
                        if (GameStateManager.state.gameData.inventory_items[stoneId] <= 0) {
                            delete GameStateManager.state.gameData.inventory_items[stoneId];
                        }

                        // 2. Cek hasil enchant
                        const success = Math.random() < stone.chance;
                        
                        // 3. Lakukan update level
                        if (success) {
                            GameStateManager.state.gameData.rod_levels[rodId] = currentLevel + 1;
                        }

                        // 4. TUNDA penampilan notifikasi hasil (Fix Race Condition)
                        setTimeout(() => {
                            if (success) {
                                UIManager.showCustomAlert("BERHASIL!", `${rod.name} Level Up ke Lv.${currentLevel + 1}!`, [{ text: "MANTAP" }], 'success');
                            } else {
                                UIManager.showCustomAlert("GAGAL", `${rod.name} gagal di-Enchant. Coba lagi!`, [{ text: "OK" }]);
                            }
                        }, 10); // Delay 10ms

                        // 5. Simpan, tutup modal enchant, dan update UI
                        await GameStateManager.saveState();
                        this.closeEnchantModal(); // Menutup modal enchant rod
                        this.renderItemsInventory();
                        UIManager.updateUI();
                    }
                }
            ]
        );
    }
};