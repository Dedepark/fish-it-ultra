const ThemeManager = {
    intervalId: null,
    // PERBAIKAN PALET WARNA REALISTIS (GRADASI HALUS)
    cycles: [
        // --- MALAM (00:00 - 03:00) ---
        { 
            name: "Malam Pekat", 
            startHour: 0, startMin: 0, 
            gradient: "linear-gradient(180deg, #020205 0%, #080814 100%)", // Hitam ke biru sangat gelap
            accent: "#4d4dff", glow: "rgba(77, 77, 255, 0.3)", panelBg: "rgba(0, 0, 0, 0.75)" 
        },

        // --- FAJAR (03:00 - 05:59) ---
        { 
            name: "Menjelang Subuh", 
            startHour: 3, startMin: 30, 
            gradient: "linear-gradient(180deg, #0f0c29 0%, #302b63 50%, #24243e 100%)", // Ungu Gelap Misterius
            accent: "#6666ff", glow: "rgba(102, 102, 255, 0.35)", panelBg: "rgba(0, 0, 0, 0.7)" 
        },
        { 
            name: "Blue Hour (Jam Biru)", 
            startHour: 4, startMin: 30, 
            gradient: "linear-gradient(180deg, #000428 0%, #004e92 100%)", // Biru Laut Dalam (Dingin)
            accent: "#00d2ff", glow: "rgba(0, 210, 255, 0.5)", panelBg: "rgba(0, 0, 0, 0.6)" 
        },
        { 
            name: "Fajar Menyingsing (5 Subuh)", // <--- INI FIX UNTUK JAM 5 KAMU
            startHour: 5, startMin: 0, 
            gradient: "linear-gradient(180deg, #2b32b2 0%, #a4508b 100%)", // Biru ke Ungu Pink (Vaporwave alami)
            accent: "#ff7eb3", glow: "rgba(255, 126, 179, 0.5)", panelBg: "rgba(20, 10, 40, 0.5)" 
        },
        { 
            name: "Horizon Pink (Jelang Terbit)", 
            startHour: 5, startMin: 30, 
            gradient: "linear-gradient(180deg, #614385 0%, #516395 40%, #ff9a9e 100%)", // Ungu Langit ke Pink Horizon
            accent: "#ff9a9e", glow: "rgba(255, 154, 158, 0.6)", panelBg: "rgba(40, 20, 60, 0.4)" 
        },

        // --- PAGI (06:00 - 09:00) ---
        { 
            name: "Matahari Terbit (Sunrise)", 
            startHour: 6, startMin: 0, 
            gradient: "linear-gradient(180deg, #3a7bd5 0%, #ffd194 100%)", // Biru Langit ke Emas Lembut
            accent: "#ffd194", glow: "rgba(255, 209, 148, 0.6)", panelBg: "rgba(0, 0, 0, 0.3)" 
        },
        { 
            name: "Pagi Cerah", 
            startHour: 7, startMin: 0, 
            gradient: "linear-gradient(180deg, #00c6ff 0%, #0072ff 100%)", // Biru Langit Segar
            accent: "#ffffff", glow: "rgba(255, 255, 255, 0.7)", panelBg: "rgba(0, 0, 0, 0.2)" 
        },

        // --- SIANG (10:00 - 14:00) ---
        { 
            name: "Siang Terik", 
            startHour: 10, startMin: 0, 
            gradient: "linear-gradient(180deg, #2980b9 0%, #6dd5fa 50%, #ffffff 100%)", // Biru Putih Silau
            accent: "#00d2ff", glow: "rgba(0, 210, 255, 0.8)", panelBg: "rgba(0, 0, 0, 0.25)" 
        },

        // --- SORE (15:00 - 17:30) ---
        { 
            name: "Sore Tenang", 
            startHour: 15, startMin: 0, 
            gradient: "linear-gradient(180deg, #3f2b96 0%, #a8c0ff 100%)", // Biru Ungu Rileks
            accent: "#a8c0ff", glow: "rgba(168, 192, 255, 0.5)", panelBg: "rgba(0, 0, 0, 0.3)" 
        },
        { 
            name: "Golden Hour (Emas)", 
            startHour: 17, startMin: 0, 
            gradient: "linear-gradient(180deg, #f12711 0%, #f5af19 100%)", // Oranye Merah ke Kuning Emas
            accent: "#f5af19", glow: "rgba(245, 175, 25, 0.6)", panelBg: "rgba(50, 20, 0, 0.4)" 
        },

        // --- SENJA (17:45 - 19:00) ---
        { 
            name: "Sunset (Terbenam)", 
            startHour: 17, startMin: 45, 
            gradient: "linear-gradient(180deg, #2c3e50 0%, #fd746c 100%)", // Biru Gelap ke Merah Salmon
            accent: "#fd746c", glow: "rgba(253, 116, 108, 0.6)", panelBg: "rgba(0, 0, 0, 0.5)" 
        },
        { 
            name: "Twilight (Maghrib)", 
            startHour: 18, startMin: 15, 
            gradient: "linear-gradient(180deg, #0F2027 0%, #203A43 50%, #2C5364 100%)", // Hijau Teal Gelap
            accent: "#76b852", glow: "rgba(118, 184, 82, 0.4)", panelBg: "rgba(0, 0, 0, 0.6)" 
        },

        // --- MALAM (19:00++) ---
        { 
            name: "Malam Awal", 
            startHour: 19, startMin: 0, 
            gradient: "linear-gradient(180deg, #141E30 0%, #243B55 100%)", // Biru Metalik Gelap
            accent: "#00d2ff", glow: "rgba(0, 210, 255, 0.3)", panelBg: "rgba(0, 0, 0, 0.7)" 
        },
        { 
            name: "Midnight", 
            startHour: 22, startMin: 0, 
            gradient: "linear-gradient(180deg, #000000 0%, #0f0f0f 100%)", // Pitch Black
            accent: "#ffffff", glow: "rgba(255, 255, 255, 0.2)", panelBg: "rgba(0, 0, 0, 0.8)" 
        }
    ],

    init() {
        this.updateTheme();
        // Cek setiap 1 menit (60000ms) cukup, tidak perlu 1000ms (1 detik) agar performa lebih ringan
        this.intervalId = setInterval(() => this.updateTheme(), 60000); 
    },

    updateTheme() {
        const now = new Date();
        const currentTotalMinutes = (now.getHours() * 60) + now.getMinutes();
        let activeCycle = this.cycles[0];
        const sortedCycles = [...this.cycles].sort((a, b) => (a.startHour * 60 + a.startMin) - (b.startHour * 60 + b.startMin));
        for (let i = 0; i < sortedCycles.length; i++) {
            const cycleTime = (sortedCycles[i].startHour * 60) + sortedCycles[i].startMin;
            if (currentTotalMinutes >= cycleTime) activeCycle = sortedCycles[i];
        }
        this.applyTheme(activeCycle);
    },

    applyTheme(theme) {
        const root = document.documentElement;
        root.style.setProperty('--bg-gradient', theme.gradient);
        root.style.setProperty('--accent-color', theme.accent);
        root.style.setProperty('--accent-glow', theme.glow);
        if(theme.panelBg) root.style.setProperty('--panel-bg', theme.panelBg);

        // --- SINKRON KE FISH3D (Panggil via window.app.fish3d) ---
        if (window.app && window.app.fish3d && typeof window.app.fish3d.updateGodRaysColor === 'function') {
            window.app.fish3d.updateGodRaysColor(theme.accent);
        }
    }
};

export default ThemeManager;