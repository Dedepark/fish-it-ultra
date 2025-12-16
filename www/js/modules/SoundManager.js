export const SoundManager = {
    sounds: {
        cast: 'sounds/cast.mp3',
        reel: 'sounds/reel.mp3',
        click: 'sounds/click.mp3'
    },
    
    init: function() {
        for (const key in this.sounds) {
            const audio = new Audio(this.sounds[key]);
            audio.preload = 'auto';
            this.sounds[key] = audio;
        }
    },
    
    play: function(name) {
        const sound = this.sounds[name];
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(e => console.log("Sound error:", e));
        }
    }
};