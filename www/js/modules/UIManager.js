import { formatMoney, getRank, RARITY_ORDER, FISH_MASTER, RODS_DB } from '../config.js';
import { GameStateManager } from './GameStateManager.js';
import { SoundManager } from './SoundManager.js';
import { DatabaseManager } from './DatabaseManager.js';
import { InventoryManager } from './InventoryManager.js';
import { ShopManager } from './ShopManager.js';
import { MissionManager } from './MissionManager.js';
import { EventManager } from './EventManager.js';
import { ChatManager } from './ChatManager.js';

export const UIManager = {
    init: function() {
        // Modal Close Buttons
        document.querySelectorAll('.btn-close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                const modalId = btn.closest('.modal').id;
                this.closeModal(modalId);
            });
        });
        
        // Navigation
        document.querySelectorAll('nav button').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.getAttribute('onclick').match(/'([^']+)'/)[1];
                this.nav(page);
            });
        });
        
        // Floating Buttons
        const missionBtn = document.querySelector('.mission-btn');
        if(missionBtn) missionBtn.addEventListener('click', () => MissionManager.openDailyMissions());
        
        const loginBtn = document.querySelector('.login-btn');
        if(loginBtn) loginBtn.addEventListener('click', () => MissionManager.openDailyLogin());
        
        // Settings & Profile
        document.querySelector('.btn-icon').addEventListener('click', () => {
            this.showModal('modal-settings');
        });
        
        document.querySelector('.user-info').addEventListener('click', () => {
            this.viewProfile(GameStateManager.state.user.id);
        });
        
        // Event Sidebar Toggles
        const sidebarToggle = document.getElementById('event-sidebar-toggle');
        if(sidebarToggle) sidebarToggle.addEventListener('click', () => EventManager.toggleEventSidebar());
        
        const closeSidebar = document.querySelector('.close-sidebar-btn');
        if(closeSidebar) closeSidebar.addEventListener('click', () => EventManager.toggleEventSidebar());
        
        // Click Sound
        document.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                SoundManager.play('click');
            }
        });
    },
    
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        document.getElementById(screenId).classList.remove('hidden');
    },
    
    showModal(modalId) {
        document.getElementById(modalId).classList.remove('hidden');
    },
    
    // --- MODIFIKASI FUNGSI CLOSE MODAL (ANIMASI TUTUP) ---
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        
        // KHUSUS CUSTOM ALERT: Handle Animasi Tutup
        if (modalId === 'modal-custom-alert') {
            // Jika sudah hidden, abaikan
            if (modal.classList.contains('hidden')) return;

            // Tambahkan kelas animasi tutup
            modal.classList.add('alert-closing');
            
            // Tunggu animasi CSS selesai (500ms) baru sembunyikan total
            setTimeout(() => {
                modal.classList.add('hidden');
                modal.classList.remove('alert-closing'); // Reset untuk pemakaian berikutnya
            }, 500); // Waktu harus sinkron dengan durasi animasi CSS
            
        } else {
            // Modal biasa langsung tutup
            modal.classList.add('hidden');
        }
    },
    
    nav(page) {
        document.querySelectorAll('nav button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = Array.from(document.querySelectorAll('nav button')).find(
            btn => btn.getAttribute('onclick').includes(page)
        );
        
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
        
        document.querySelectorAll('.panel').forEach(panel => {
            panel.classList.add('hidden');
        });
        const fishingArea = document.getElementById('fishing-area');
        if (fishingArea) {
            fishingArea.classList.add('hidden');
        }

        const floatBtns = document.getElementById('floating-buttons');
        const sidebarBtn = document.getElementById('event-sidebar-toggle'); 

        if (page === 'fishing') {
            document.getElementById('fishing-area').classList.remove('hidden');
            if (floatBtns) floatBtns.classList.remove('hidden');
            if (sidebarBtn) sidebarBtn.classList.remove('hidden');
        } else {
            if (floatBtns) floatBtns.classList.add('hidden');
            if (sidebarBtn) sidebarBtn.classList.add('hidden');
            
            if (GameStateManager.state.eventSidebarOpen) {
                EventManager.toggleEventSidebar();
            }
            
            const targetPanel = document.getElementById(`panel-${page}`);
            if (targetPanel) {
                targetPanel.classList.remove('hidden');
                
                if (page === 'inventory') {
                    if (GameStateManager.state.activeInvTab === 'fish') {
                        InventoryManager.renderFishInventory();
                    } else {
                        InventoryManager.renderItemsInventory();
                    }
                } else if (page === 'shop') {
                    ShopManager.renderShop();
                } else if (page === 'index') {
                    this.renderIndex();
                }
            }
        }
        
        if (page === 'index') {
            this.renderIndex();
        } else if (page === 'chat') {
            GameStateManager.state.lastViewedChatTime = Date.now();
            this.updateChatBadge(0);
            const chatContainer = document.getElementById('chat-messages');
            if (chatContainer) {
                setTimeout(() => {
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }, 0);
            }
        } else if (page === 'inventory') {
            GameStateManager.state.lastViewedInventoryTime = Date.now();
            this.updateInventoryNotification(false);
        }
    },
    
    updateUI(element, value) {
        if (element === 'status') {
            document.getElementById('status-text').textContent = value;
            return;
        }
        
        document.getElementById('display-username').textContent = GameStateManager.state.username;
        document.getElementById('header-level-badge').textContent = `LV.${GameStateManager.state.gameData.level}`;
        document.getElementById('header-exp-bar').style.width = 
            `${(GameStateManager.state.gameData.current_exp / (GameStateManager.state.gameData.level * 10)) * 100}%`;
        
        document.getElementById('display-money').textContent = formatMoney(GameStateManager.state.gameData.money);
        document.getElementById('display-diamonds').textContent = GameStateManager.state.gameData.diamonds;
        
        const currentRodId = GameStateManager.state.gameData.current_rod;
        const rod = RODS_DB.find(r => r.id === currentRodId) || RODS_DB[0];

        const rodLvl = GameStateManager.state.gameData.rod_levels[rod.id] || 0;
        const totalPower = rod.power + (rodLvl * 0.5);
        
        const rodNameEl = document.getElementById('rod-name');
        rodNameEl.textContent = rod.name;
        
        if (rod.id >= 100) {
            rodNameEl.style.color = rod.color || '#00ff88';
            rodNameEl.style.textShadow = `0 0 5px ${rod.color}`;
        } else {
            rodNameEl.style.color = '#fff';
            rodNameEl.style.textShadow = 'none';
        }

        document.getElementById('rod-power-display').textContent = `Power: ${totalPower.toFixed(1)}x`;
    },
    
    updateInventoryNotification(show) {
        const badge = document.getElementById('inventory-badge');
        
        if (show) {
            GameStateManager.state.newFishCount++;
            badge.textContent = GameStateManager.state.newFishCount;
            badge.classList.remove('hidden');
        } else {
            GameStateManager.state.newFishCount = 0;
            badge.classList.add('hidden');
        }
    },
    
    updateChatBadge(count) {
        const badge = document.getElementById('chat-badge');
        
        if (count > 0) {
            badge.textContent = count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    },
    
    showCustomAlert(title, message, buttons, type = 'warning') {
        const modal = document.getElementById('modal-custom-alert');
        const titleEl = document.getElementById('custom-alert-title');
        const messageEl = document.getElementById('custom-alert-message');
        const scrollBox = document.querySelector('.alert-msg-scroll-box');
        const confirmBtn = document.getElementById('custom-alert-confirm');
        const cancelBtn = document.getElementById('custom-alert-cancel');
        
        // Reset state bersih (jaga-jaga jika dipanggil beruntun)
        modal.classList.remove('alert-closing');
        
        titleEl.textContent = title;
        messageEl.textContent = message;
        
        if (message.length > 25) { 
            scrollBox.classList.add('is-long-text');
        } else {
            scrollBox.classList.remove('is-long-text');
        }

        modal.className = 'modal';
        if (type === 'success') {
            modal.classList.add('alert-success');
        }
        
        confirmBtn.textContent = 'OK';
        confirmBtn.onclick = () => {
            this.closeModal('modal-custom-alert');
        };
        
        cancelBtn.classList.add('hidden');
        
        if (buttons && buttons.length > 0) {
            const confirmBtnData = buttons.find(btn => btn.isConfirm);
            const cancelBtnData = buttons.find(btn => btn.isCancel);
            
            if (confirmBtnData) {
                confirmBtn.textContent = confirmBtnData.text;
                confirmBtn.onclick = () => {
                    if (confirmBtnData.onClick) {
                        confirmBtnData.onClick();
                    }
                    this.closeModal('modal-custom-alert');
                };
            }
            
            if (cancelBtnData) {
                cancelBtn.textContent = cancelBtnData.text;
                cancelBtn.classList.remove('hidden');
                cancelBtn.onclick = () => {
                    if (cancelBtnData.onClick) {
                        cancelBtnData.onClick();
                    }
                    this.closeModal('modal-custom-alert');
                };
            }
        }
        
        // --- KLIK DI LUAR KONTEN UNTUK MENUTUP ---
        // Kita pasang event di wrapper 'modal' (area transparan/kosong)
        modal.onclick = (e) => {
            // Cek apakah yang diklik benar-benar area kosong (modal wrapper)
            // Bukan konten alert atau anaknya
            if (e.target === modal) {
                this.closeModal('modal-custom-alert');
            }
        };
        
        this.showModal('modal-custom-alert');
    },
    
    // ... (Sisa fungsi renderIndex, viewProfile, dsb tetap sama) ...
    renderIndex() {
        const container = document.getElementById('index-list');
        const counter = document.getElementById('fish-counter');
        
        if (GameStateManager.state.flatIndexList.length === 0) {
            GameStateManager.state.flatIndexList = [];
            RARITY_ORDER.forEach(rarity => {
                FISH_MASTER[rarity].forEach(fish => {
                    GameStateManager.state.flatIndexList.push({
                        ...fish,
                        rarity: rarity
                    });
                });
            });
        }
        
        const sortedFish = [...GameStateManager.state.flatIndexList].sort((a, b) => {
            const rarityDiff = getRank(b.rarity) - getRank(a.rarity);
            if (rarityDiff !== 0) return rarityDiff;
            return a.name.localeCompare(b.name);
        });
        
        container.innerHTML = '';
        
        let foundCount = 0;
        let currentRarity = null;
        
        sortedFish.forEach(fish => {
            const isFound = GameStateManager.state.gameData.unlocked_fish.includes(fish.name);
            
            if (isFound) {
                foundCount++;
            }
            
            if (fish.rarity !== currentRarity) {
                currentRarity = fish.rarity;
                const header = document.createElement('div');
                header.className = 'rarity-header';
                header.textContent = currentRarity;
                container.appendChild(header);
            }
            
            const fishCard = document.createElement('div');
            fishCard.className = `fish-item ${isFound ? fish.class : 'fish-locked'}`;
            
            if (isFound) {
                fishCard.innerHTML = `
                    <div class="fish-icon">🐟</div> <div class="fish-name">${fish.name}</div>
                    <div class="fish-price">${formatMoney(fish.price)}</div>
                `;
            } else {
                fishCard.innerHTML = `
                    <div class="fish-icon">❓</div> <div class="fish-name">???</div>
                    <div class="fish-price">???</div>
                `;
            }
            
            container.appendChild(fishCard);
        });
        
        counter.textContent = `${foundCount}/${sortedFish.length} ditemukan`;
    },
    
    async viewProfile(userId = GameStateManager.state.user.id) {
        if (userId === GameStateManager.state.user.id) {
            const modal = document.getElementById('modal-profile');
            const username = document.getElementById('prof-username');
            const levelBadge = document.getElementById('prof-level-badge');
            const money = document.getElementById('prof-money');
            const diamonds = document.getElementById('prof-diamonds');
            const rod = document.getElementById('prof-rod');
            const bestFish = document.getElementById('prof-best-fish');
            const actions = document.getElementById('prof-actions');
            
            username.textContent = GameStateManager.state.username;
            levelBadge.textContent = `LV. ${GameStateManager.state.gameData.level}`;
            money.textContent = formatMoney(GameStateManager.state.gameData.money);
            diamonds.textContent = `💎 ${GameStateManager.state.gameData.diamonds}`;
            
            const currentRodId = GameStateManager.state.gameData.current_rod;
            const currentRod = RODS_DB.find(r => r.id === currentRodId) || RODS_DB[0];

            const rodLvl = GameStateManager.state.gameData.rod_levels[currentRod.id] || 0;
            rod.textContent = `${currentRod.name} (Lv.${rodLvl})`;
            
            if (GameStateManager.state.gameData.best_fish) {
                bestFish.textContent = `${GameStateManager.state.gameData.best_fish.name} (${GameStateManager.state.gameData.best_fish.rarity}) - ${formatMoney(GameStateManager.state.gameData.best_fish.price)}`;
            } else {
                bestFish.textContent = "Belum ada data";
            }
            
            actions.classList.add('hidden');
            this.showModal('modal-profile');
        } else {
            this.showCustomAlert("INFO", "Fitur melihat profil pemain lain belum tersedia", [{ text: "OK" }]);
        }
    },

    async viewOtherUserProfile(userId, username) {
        const modal = document.getElementById('modal-profile');
        const usernameEl = document.getElementById('prof-username');
        const levelBadgeEl = document.getElementById('prof-level-badge');
        const moneyEl = document.getElementById('prof-money');
        const diamondsEl = document.getElementById('prof-diamonds');
        const rodEl = document.getElementById('prof-rod');
        const bestFishEl = document.getElementById('prof-best-fish');
        const actionsEl = document.getElementById('prof-actions');

        usernameEl.textContent = "Memuat...";
        levelBadgeEl.textContent = "LV. ?";
        moneyEl.textContent = "Rp 0";
        diamondsEl.textContent = "💎 0";
        rodEl.textContent = "-";
        bestFishEl.textContent = "Memuat...";
        actionsEl.classList.add('hidden');

        this.showModal('modal-profile');

        try {
            const { data: gameData, error } = await DatabaseManager.client
                .from('game_data')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error) throw error;

            if (gameData) {
                usernameEl.textContent = username;
                levelBadgeEl.textContent = `LV. ${gameData.level}`;
                moneyEl.textContent = formatMoney(gameData.money || 0);
                diamondsEl.textContent = `💎 ${gameData.diamonds || 0}`;

                const currentRod = RODS_DB.find(r => r.id === gameData.current_rod) || RODS_DB[0];
                const rodLvl = gameData.rod_levels[gameData.current_rod] || 0;
                rodEl.textContent = `${currentRod.name} (Lv.${rodLvl})`;

                if (gameData.best_fish) {
                    bestFishEl.textContent = `${gameData.best_fish.name} (${gameData.best_fish.rarity}) - ${formatMoney(gameData.best_fish.price)}`;
                } else {
                    bestFishEl.textContent = "Belum ada data";
                }

                actionsEl.classList.remove('hidden');
                GameStateManager.state.targetUserId = userId;
                GameStateManager.state.targetUsername = username;
            } else {
                usernameEl.textContent = username;
                bestFishEl.textContent = "Data tidak ditemukan";
            }
        } catch (error) {
            console.error("Error loading user profile:", error);
            usernameEl.textContent = username;
            bestFishEl.textContent = "Gagal memuat data";
        }
    },
    
    updateBuffTimers() {
        const container = document.getElementById('active-buff-container');
        const now = Date.now();
        
        const expiredBefore = GameStateManager.state.activeBuffs.length;
        GameStateManager.state.activeBuffs = GameStateManager.state.activeBuffs.filter(
            buff => buff.endTime > now
        );
        
        if (expiredBefore > GameStateManager.state.activeBuffs.length) {
            GameStateManager.saveState();
        }
        
        container.innerHTML = '';
        
        GameStateManager.state.activeBuffs.forEach(buff => {
            const buffIcon = document.createElement('div');
            buffIcon.className = 'buff-icon';
            const timeLeft = Math.ceil((buff.endTime - now) / 1000);
            if (buff.type === 'luck') {
                buffIcon.innerHTML = `+${Math.round(buff.boost * 100)}%<br>${timeLeft}s`;
            }
            container.appendChild(buffIcon);
        });
    },

    openGiveMoneyModal() {
        const modal = document.getElementById('modal-give-money');
        const targetUsernameEl = document.getElementById('give-money-target');
        
        if (GameStateManager.state.targetUsername) {
            targetUsernameEl.textContent = GameStateManager.state.targetUsername;
            targetUsernameEl.style.color = '#00d2ff';
        }
        
        document.getElementById('input-give-money').value = '';
        this.showModal('modal-give-money');
    },

    openGiveFishModal() {
        const modal = document.getElementById('modal-give-fish');
        const targetUsernameEl = document.getElementById('give-fish-target');
        const fishListEl = document.getElementById('give-fish-list');
        
        if (GameStateManager.state.targetUsername) {
            targetUsernameEl.textContent = GameStateManager.state.targetUsername;
            targetUsernameEl.style.color = '#00d2ff';
        }
        
        this.renderGiveFishList(fishListEl);
        this.showModal('modal-give-fish');
    },

    renderGiveFishList(fishListEl) {
        fishListEl.innerHTML = '';
        const unlockedFish = GameStateManager.state.inventory.filter(fish => !fish.is_locked);
        
        if (unlockedFish.length === 0) {
            fishListEl.innerHTML = '<p style="text-align:center; color:#888;">Tidak ada ikan yang bisa diberikan (semua terkunci).</p>';
            return;
        }
        
        const groupedFish = {};
        unlockedFish.forEach(fish => {
            const key = `${fish.fish_name}_${fish.rarity}`;
            if (!groupedFish[key]) {
                const originalFishData = FISH_MASTER[fish.rarity]?.find(f => f.name === fish.fish_name);
                const cssClass = originalFishData ? originalFishData.class : `fish-${fish.rarity.toLowerCase()}`;
                
                groupedFish[key] = {
                    fish_name: fish.fish_name,
                    rarity: fish.rarity,
                    price: fish.price,
                    class: cssClass,
                    count: 0,
                    ids: []
                };
            }
            groupedFish[key].count++;
            groupedFish[key].ids.push(fish.id);
        });
        
        let groupedArray = Object.values(groupedFish);

        groupedArray.sort((a, b) => {
            const rankA = getRank(a.rarity);
            const rankB = getRank(b.rarity);
            
            if (rankA !== rankB) return rankB - rankA;
            return a.fish_name.localeCompare(b.fish_name);
        });
        
        groupedArray.forEach(fishGroup => {
            const fishCard = document.createElement('div');
            fishCard.className = `fish-item ${fishGroup.class}`;
            fishCard.innerHTML = `
                <div class="fish-icon">🐟</div> <div class="fish-name">${fishGroup.fish_name}</div>
                <div class="fish-price">${formatMoney(fishGroup.price)}</div>
                <div class="fish-count">x${fishGroup.count}</div>
            `;
            
            fishCard.addEventListener('click', () => {
                document.querySelectorAll('#give-fish-list .fish-item').forEach(card => {
                    card.classList.remove('selected');
                });
                fishCard.classList.add('selected');
                
                GameStateManager.state.selectedGiveFish = {
                    ...fishGroup,
                    idToDelete: fishGroup.ids[0] 
                };
            });
            
            fishListEl.appendChild(fishCard);
        });
    },

    async processGiveMoney() {
        const inputEl = document.getElementById('input-give-money');
        if (!inputEl) return;
        
        const amount = parseInt(inputEl.value);
        if (isNaN(amount) || amount < 100) {
            this.showCustomAlert("ERROR", "Jumlah uang tidak valid. Minimal 100.", [{ text: "OK" }]);
            return;
        }
        
        if (amount > GameStateManager.state.gameData.money) {
            this.showCustomAlert("ERROR", "Uang tidak cukup.", [{ text: "OK" }]);
            return;
        }
        
        try {
            // Optimistic Update
            GameStateManager.state.gameData.money -= amount; 
            
            const { error } = await DatabaseManager.client.rpc('give_money', {
                target_user_id: GameStateManager.state.targetUserId,
                amount: amount,
                sender_username: GameStateManager.state.username,
                target_username: GameStateManager.state.targetUsername
            });
            
            if (error) throw error;
            
            await GameStateManager.saveState();
            
            // --- FIX BROADCAST UANG ---
            // Panggil broadcast manual karena RPC mungkin tidak mengirim pesan chat
            await ChatManager.broadcastGiveMoney(
                GameStateManager.state.username,
                GameStateManager.state.targetUsername,
                amount
            );

            this.updateUI(); 
            this.closeModal('modal-give-money');
            this.showCustomAlert("BERHASIL", `Berhasil kirim ${formatMoney(amount)} ke ${GameStateManager.state.targetUsername}.`, [{ text: "OK" }], 'success');
        } catch (error) {
            console.error("Error giving money:", error);
            // Rollback
            GameStateManager.state.gameData.money += amount;
            this.updateUI(); 
            this.showCustomAlert("ERROR", "Gagal: " + error.message, [{ text: "OK" }]);
        }
    },

    async processGiveFish() {
        if (!GameStateManager.state.selectedGiveFish) {
            this.showCustomAlert("ERROR", "Pilih ikan yang ingin diberikan.", [{ text: "OK" }]);
            return;
        }
        
        const selectedFish = GameStateManager.state.selectedGiveFish;
        const fishIdToDelete = selectedFish.idToDelete; 
        
        this.showCustomAlert(
            "KONFIRMASI",
            `Kirim 1x ${selectedFish.fish_name} ke ${GameStateManager.state.targetUsername}?`,
            [
                { text: "Batal", isCancel: true },
                {
                    text: "Ya, Kirim",
                    isConfirm: true,
                    onClick: async () => {
                        try {
                            // Panggil RPC
                            // NOTE: Error PGRST203 biasanya karena ketidakcocokan parameter DB.
                            // Pastikan di SQL Database fungsi 'give_fish' memiliki parameter 'fish_id_to_delete' (bigint).
                            const { error } = await DatabaseManager.client.rpc('give_fish', {
                                target_user_id: GameStateManager.state.targetUserId,
                                fish_name: selectedFish.fish_name,
                                rarity: selectedFish.rarity,
                                price: selectedFish.price,
                                sender_username: GameStateManager.state.username,
                                target_username: GameStateManager.state.targetUsername,
                                fish_id_to_delete: fishIdToDelete 
                            });
                            
                            if (error) throw error;
                            
                            // Hapus ikan dari inventory lokal (JS)
                            const indexToRemove = GameStateManager.state.inventory.findIndex(fish => fish.id === fishIdToDelete);
                            if (indexToRemove !== -1) {
                                GameStateManager.state.inventory.splice(indexToRemove, 1);
                            }
                            
                            GameStateManager.groupInventoryItems();
                            InventoryManager.renderInventory(); 
                            await GameStateManager.saveState();
                            
                            // --- FIX BROADCAST IKAN ---
                            // Panggil broadcast manual
                            await ChatManager.broadcastGiveFish(
                                GameStateManager.state.username,
                                GameStateManager.state.targetUsername,
                                selectedFish.fish_name,
                                selectedFish.rarity
                            );
                            
                            this.closeModal('modal-give-fish');
                            this.showCustomAlert("BERHASIL", "Ikan terkirim!", [{ text: "OK" }], 'success');
                            
                        } catch (error) {
                            console.error("Error giving fish:", error);
                            // Pesan error spesifik jika masalah parameter DB
                            let errMsg = error.message;
                            if (error.code === 'PGRST203') {
                                errMsg = "Server Error: Fungsi database tidak cocok. Mohon hubungi admin untuk update fungsi 'give_fish'.";
                            }
                            this.showCustomAlert("ERROR", errMsg, [{ text: "OK" }]);
                        }
                    }
                }
            ]
        );
    }
};