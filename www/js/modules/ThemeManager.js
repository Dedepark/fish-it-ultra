const ThemeManager = {
    intervalId: null,
    cycles: [
        { name: "Malam Pekat", startHour: 0, startMin: 0, gradient: "linear-gradient(180deg, #050510 0%, #0A0A1E 100%)", accent: "#4d4dff", glow: "rgba(77, 77, 255, 0.3)", panelBg: "rgba(0, 0, 0, 0.7)" },
        { name: "Malam Menjelang Fajar", startHour: 3, startMin: 0, gradient: "linear-gradient(180deg, #0A0A1E 0%, #151530 100%)", accent: "#6666ff", glow: "rgba(102, 102, 255, 0.35)", panelBg: "rgba(0, 0, 0, 0.65)" },
        { name: "Fajar Astronomis", startHour: 3, startMin: 30, gradient: "linear-gradient(180deg, #1B1B3A 0%, #2A2A55 100%)", accent: "#8e8eff", glow: "rgba(142, 142, 255, 0.4)", panelBg: "rgba(0, 0, 0, 0.6)" },
        { name: "Blue Hour (Fajar)", startHour: 4, startMin: 15, gradient: "linear-gradient(180deg, #2E2E5A 0%, #4A5B8C 100%)", accent: "#00d2ff", glow: "rgba(0, 210, 255, 0.5)", panelBg: "rgba(0, 0, 0, 0.5)" },
        { name: "Golden Hour Pertama", startHour: 5, startMin: 30, gradient: "linear-gradient(180deg, #6A93C8 0%, #FFD700 70%, #FFA07A 100%)", accent: "#FFD700", glow: "rgba(255, 215, 0, 0.6)", panelBg: "rgba(0, 0, 0, 0.4)" },
        { name: "Sunrise", startHour: 6, startMin: 0, gradient: "linear-gradient(180deg, #9370DB 0%, #FF69B4 50%, #FF4500 100%)", accent: "#FF4500", glow: "rgba(255, 69, 0, 0.5)", panelBg: "rgba(0, 0, 0, 0.5)" },
        { name: "Pagi Hari", startHour: 6, startMin: 30, gradient: "linear-gradient(180deg, #87CEEB 0%, #FFB347 100%)", accent: "#00a8ff", glow: "rgba(0, 168, 255, 0.5)", panelBg: "rgba(0, 0, 0, 0.2)" },
        { name: "Siang Bolong (Midday)", startHour: 9, startMin: 0, gradient: "linear-gradient(180deg, #1E90FF 0%, #87CEEB 100%)", accent: "#ffffff", glow: "rgba(255, 255, 255, 0.8)", panelBg: "rgba(0, 0, 0, 0.3)" },
        { name: "Sore Hari", startHour: 15, startMin: 0, gradient: "linear-gradient(180deg, #4da6ff 0%, #6495ED 100%)", accent: "#f1c40f", glow: "rgba(241, 196, 15, 0.5)", panelBg: "rgba(0, 0, 0, 0.3)" },
        { name: "Golden Hour Kedua", startHour: 17, startMin: 0, gradient: "linear-gradient(180deg, #4682B4 0%, #F4A460 60%, #FF8C00 100%)", accent: "#FF8C00", glow: "rgba(255, 140, 0, 0.6)", panelBg: "rgba(0, 0, 0, 0.45)" },
        { name: "Sunset", startHour: 18, startMin: 0, gradient: "linear-gradient(180deg, #8A2BE2 0%, #FF00FF 50%, #DC143C 100%)", accent: "#FF00FF", glow: "rgba(255, 0, 255, 0.5)", panelBg: "rgba(0, 0, 0, 0.6)" },
        { name: "Afterglow", startHour: 18, startMin: 30, gradient: "linear-gradient(180deg, #483D8B 0%, #FFB6C1 70%, #FFA500 100%)", accent: "#FFB6C1", glow: "rgba(255, 182, 193, 0.5)", panelBg: "rgba(0, 0, 0, 0.6)" },
        { name: "Senja Nautikal", startHour: 19, startMin: 15, gradient: "linear-gradient(180deg, #191970 0%, #0F0F2D 100%)", accent: "#7d5fff", glow: "rgba(125, 95, 255, 0.4)", panelBg: "rgba(0, 0, 0, 0.65)" },
        { name: "Malam Awal", startHour: 20, startMin: 0, gradient: "linear-gradient(180deg, #2F2F4F 0%, #0A0A1E 100%)", accent: "#3c40c6", glow: "rgba(60, 64, 198, 0.4)", panelBg: "rgba(0, 0, 0, 0.7)" },
        { name: "Malam Penuh", startHour: 23, startMin: 0, gradient: "linear-gradient(180deg, #050510 0%, #0A0A1E 100%)", accent: "#4d4dff", glow: "rgba(77, 77, 255, 0.3)", panelBg: "rgba(0, 0, 0, 0.75)" }
    ],

    init() {
        this.updateTheme();
        this.intervalId = setInterval(() => this.updateTheme(), 1000);
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