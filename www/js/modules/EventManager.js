import { EVENT_DATA } from '../config.js';
import { GameStateManager } from './GameStateManager.js';

export const EventManager = {
    eventTimerInterval: null, // Variabel simpan timer countdown
    snowInterval: null,       // Variabel simpan timer salju

    init: function() {
        this.setEventEndTime();
        this.updateEventTimer();
        // Simpan ID interval ke variabel this
        this.eventTimerInterval = setInterval(this.updateEventTimer.bind(this), 1000);
        this.createEventParticles();
    },
    
    setEventEndTime() {
        const [day, month, year] = EVENT_DATA.endDate.split('-').map(Number);
        const eventEndDate = new Date(year, month - 1, day, 23, 59, 59);
        GameStateManager.state.eventEndTime = eventEndDate.getTime();
    },
    
    updateEventTimer() {
        const now = Date.now();
        const endTime = GameStateManager.state.eventEndTime;
        
        if (now > endTime) {
            const el = document.getElementById('event-countdown');
            if(el) el.textContent = "BERAKHIR";
            return;
        }
        
        const timeLeft = endTime - now;
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        
        const el = document.getElementById('event-countdown');
        if(el) el.textContent = `${days}h ${hours}j ${minutes}m ${seconds}d`;
    },
    
    toggleEventSidebar() {
        const sidebar = document.getElementById('event-sidebar');
        GameStateManager.state.eventSidebarOpen = !GameStateManager.state.eventSidebarOpen;
        
        if (GameStateManager.state.eventSidebarOpen) {
            sidebar.classList.add('active');
        } else {
            sidebar.classList.remove('active');
        }
    },
    
    createEventParticles() {
        const overlay = document.getElementById('event-overlay');
        if(!overlay) return; // Safety check
        
        // Spawn awal
        for (let i = 0; i < 15; i++) {
            setTimeout(() => {
                this.createParticle(overlay);
            }, i * 500);
        }
        
        // Spawn terus menerus (Disimpan ke variabel biar bisa distop saat logout)
        this.snowInterval = setInterval(() => {
            if (Math.random() < 0.4) { 
                this.createParticle(overlay);
            }
        }, 1500);
    },
    
    createParticle(container) {
        // Cek kalau container masih ada (biar gak error pas logout mendadak)
        if(!document.body.contains(container)) return;

        const particle = document.createElement('div');
        particle.className = 'event-crystal';
        particle.innerHTML = '❄️';
        
        // --- LOGIKA KEDALAMAN (DEPTH) ---
        const depthRoll = Math.random();
        let duration;
        
        if (depthRoll < 0.5) {
            particle.classList.add('crystal-small');
            duration = 15 + Math.random() * 5; 
        } else if (depthRoll < 0.8) {
            particle.classList.add('crystal-medium');
            duration = 8 + Math.random() * 4; 
        } else {
            particle.classList.add('crystal-large');
            duration = 4 + Math.random() * 2; 
        }
        
        const left = Math.random() * 100;
        particle.style.left = `${left}%`;
        particle.style.animationDuration = `${duration}s`;
        
        container.appendChild(particle);
        
        setTimeout(() => {
            if(particle && particle.parentNode) particle.remove();
        }, duration * 1000);
    },

    // --- INI FUNGSI YANG HILANG KEMARIN ---
    cleanup() {
        // Matikan timer countdown event
        if (this.eventTimerInterval) {
            clearInterval(this.eventTimerInterval);
            this.eventTimerInterval = null;
        }
        
        // Matikan spawn salju (biar gak numpuk memory leak)
        if (this.snowInterval) {
            clearInterval(this.snowInterval);
            this.snowInterval = null;
        }
    }
};