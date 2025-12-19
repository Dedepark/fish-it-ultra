import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const Fish3DManager = {
    scene: null, camera: null, renderer: null,
    clock: new THREE.Clock(),
    containerId: 'fish-3d-container',
    isVisible: true,
    
    fishes: [],
    godRays: [], 
    
    modelFiles: ['fish1.glb', 'fish2.glb', 'fish3.glb', 'fish4.glb'],
    bounds: { xMin: -6, xMax: 6, yMin: -3, yMax: 3, zMin: -15, zMax: 5 },

    init: function() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        const loadingText = document.createElement('div');
        loadingText.id = 'fish-loading-txt';
        loadingText.innerText = "Menyalakan Cahaya Ilahi...";
        loadingText.style.cssText = "position:absolute; bottom:80px; left:20px; color:rgba(255,255,255,0.5); font-size:10px; z-index:10; pointer-events:none;";
        document.body.appendChild(loadingText); 

        // 1. Setup Scene & Fog (Warna Fog awal nanti ditimpa updateGodRaysColor)
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x0b1026, 10, 35); 

        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
        this.camera.position.set(0, 0, 8); 

        this.updateBounds(w, h);

        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(this.renderer.domElement);

        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
        this.scene.add(ambientLight);
        
        // Directional Light Awal (Nanti diupdate warnanya)
        const dirLight = new THREE.DirectionalLight(0x00d2ff, 2.0);
        dirLight.position.set(5, 10, 5);
        this.scene.add(dirLight);

        this.createGodRays();

        const loader = new GLTFLoader();
        let loadedCount = 0;

        this.modelFiles.forEach((fileName) => {
            loader.load(fileName, (gltf) => {
                const model = gltf.scene;
                const scale = 0.35 + Math.random() * 0.2;
                model.scale.set(scale, scale, scale);
                model.position.set((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 5, -10);
                this.scene.add(model);
                
                let mixer = null;
                if (gltf.animations.length > 0) {
                    mixer = new THREE.AnimationMixer(model);
                    const action = mixer.clipAction(gltf.animations[0]);
                    action.time = Math.random() * 5; 
                    action.play();
                }

                const fishData = {
                    model: model,
                    mixer: mixer,
                    targetPosition: null,
                    swimSpeed: 0.8 + Math.random() * 0.7, 
                    turnSpeed: 1.0 + Math.random() * 0.5 
                };

                this.pickNewTarget(fishData);
                this.fishes.push(fishData);

                loadedCount++;
                if (loadedCount === this.modelFiles.length) {
                    if(loadingText) loadingText.remove();
                    console.log(`🐟 ${loadedCount} Ikan Siap!`);
                }
            }, undefined, (err) => console.error(err));
        });

        // 2. FORCE SYNC: Ambil warna tema saat ini dari CSS Variable
        // Ini kuncinya! Biar pas loading pertama kali langsung ngikutin warna jam.
        setTimeout(() => {
            const currentThemeColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim();
            if (currentThemeColor) {
                console.log("🎨 Fish3D Sync Color:", currentThemeColor);
                this.updateGodRaysColor(currentThemeColor);
            }
        }, 100); // Delay dikit biar CSS root bener-bener ready

        this.animate();

        window.addEventListener('resize', () => {
            if(!this.camera) return;
            const width = window.innerWidth;
            const height = window.innerHeight;
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
            this.updateBounds(width, height);
        });
    },

    // --- FUNGSI UPDATE WARNA (SINKRON KE THEME) ---
    updateGodRaysColor: function(hexColor) {
        if (!this.godRays || this.godRays.length === 0) return;
        
        // Update warna Batang Cahaya (God Rays)
        this.godRays.forEach(group => {
            group.children.forEach(mesh => {
                if (mesh.material) mesh.material.color.set(hexColor);
            });
        });

        // Update warna Kabut (Fog) biar menyatu
        if (this.scene && this.scene.fog) {
            this.scene.fog.color.set(hexColor);
        }

        // Update warna Cahaya Matahari (Directional Light)
        if (this.scene) {
            const dirLight = this.scene.children.find(c => c.type === "DirectionalLight");
            if (dirLight) dirLight.color.set(hexColor);
        }
    },

    updateBounds: function(width, height) {
        const aspect = width / height;
        const vHeight = 2 * Math.tan((this.camera.fov * Math.PI / 180) / 2) * 8; 
        const vWidth = vHeight * aspect;
        this.bounds.xMin = -vWidth / 1.5; this.bounds.xMax = vWidth / 1.5;
        this.bounds.yMin = -vHeight / 2.5; this.bounds.yMax = vHeight / 2.5;
        this.bounds.zMin = -20; this.bounds.zMax = 6;   
    },

    createSoftBeamTexture: function() {
        const canvas = document.createElement('canvas');
        canvas.width = 32; canvas.height = 128;
        const context = canvas.getContext('2d');
        const gradientX = context.createLinearGradient(0, 0, 32, 0);
        gradientX.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gradientX.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
        gradientX.addColorStop(1, 'rgba(255, 255, 255, 0)');
        context.fillStyle = gradientX;
        context.fillRect(0, 0, 32, 128);
        const gradientY = context.createLinearGradient(0, 0, 0, 128);
        gradientY.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gradientY.addColorStop(0.1, 'rgba(255, 255, 255, 1)');
        gradientY.addColorStop(1, 'rgba(255, 255, 255, 0)');
        context.globalCompositeOperation = 'destination-in';
        context.fillStyle = gradientY;
        context.fillRect(0, 0, 32, 128);
        return new THREE.CanvasTexture(canvas);
    },

    createGodRays: function() {
        const beamTexture = this.createSoftBeamTexture();
        // Default color awal (blue) - nanti langsung ditimpa sama force sync di init()
        const material = new THREE.MeshBasicMaterial({
            map: beamTexture, color: 0x88d2ff, transparent: true,
            opacity: 0.15, blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide, depthWrite: false
        });
        const geometry = new THREE.PlaneGeometry(2, 35);
        for (let i = 0; i < 12; i++) {
            const group = new THREE.Group();
            const plane1 = new THREE.Mesh(geometry, material.clone());
            const plane2 = new THREE.Mesh(geometry, material.clone());
            plane2.rotation.y = Math.PI / 2;
            group.add(plane1); group.add(plane2);
            const speed = 0.3 + Math.random() * 0.8;
            const opacity = 0.12 / (speed * 0.8); 
            plane1.material.opacity = opacity; plane2.material.opacity = opacity;
            group.position.set((Math.random() - 0.5) * 18, 12, -2 - Math.random() * 6);
            const baseRotZ = -0.35 + (Math.random() * 0.1);
            group.rotation.z = baseRotZ; group.rotation.x = -0.1;
            group.userData = { baseRotZ: baseRotZ, speed: speed, offset: Math.random() * 10 };
            this.scene.add(group); this.godRays.push(group);
        }
    },

    pickNewTarget: function(fish) {
        if (!fish.model) return;
        const isGlassHit = Math.random() < 0.35;
        let x, y, z;
        if (isGlassHit) {
            z = THREE.MathUtils.randFloat(5, 6); x = THREE.MathUtils.randFloat(-2, 2); y = THREE.MathUtils.randFloat(-1, 1);
        } else {
            z = THREE.MathUtils.randFloat(this.bounds.zMin, 0); x = THREE.MathUtils.randFloat(this.bounds.xMin, this.bounds.xMax); y = THREE.MathUtils.randFloat(this.bounds.yMin, this.bounds.yMax);
        }
        fish.targetPosition = new THREE.Vector3(x, y, z);
    },

    animate: function() {
        requestAnimationFrame(this.animate.bind(this));
        if (!this.isVisible) return; 
        const delta = this.clock.getDelta();
        const elapsed = this.clock.getElapsedTime();

        this.godRays.forEach(group => {
            const wobble = Math.sin(elapsed * group.userData.speed + group.userData.offset) * 0.02;
            group.rotation.z = group.userData.baseRotZ + wobble;
        });

        this.fishes.forEach(fish => {
            if (!fish.model) return;
            if (fish.mixer) fish.mixer.update(delta);
            if (fish.targetPosition) {
                const dist = fish.model.position.distanceTo(fish.targetPosition);
                if (dist < 0.5) this.pickNewTarget(fish);
                const dummy = new THREE.Object3D();
                dummy.position.copy(fish.model.position);
                dummy.lookAt(fish.targetPosition); 
                fish.model.quaternion.slerp(dummy.quaternion, fish.turnSpeed * delta);
                fish.model.translateZ(fish.swimSpeed * delta); 
                if (Math.abs(fish.model.position.z) > 40) {
                     fish.model.position.set(0,0,-15); this.pickNewTarget(fish);
                }
            }
        });

        if (this.renderer && this.scene && this.camera) this.renderer.render(this.scene, this.camera);
    }
};