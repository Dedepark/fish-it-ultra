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

    // Bounds Default
    bounds: { xMin: -6, xMax: 6, yMin: -3, yMax: 3, zMin: -15, zMax: 5 },

    init: function() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        // Loading Text
        const loadingText = document.createElement('div');
        loadingText.id = 'fish-loading-txt';
        loadingText.innerText = "Menyalakan Cahaya Ilahi...";
        loadingText.style.cssText = "position:absolute; bottom:80px; left:20px; color:rgba(255,255,255,0.5); font-size:10px; z-index:10; pointer-events:none;";
        document.body.appendChild(loadingText); 

        // Setup Scene (Fog Jauh)
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x0b1026, 10, 35); 

        // Camera
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
        this.camera.position.set(0, 0, 8); 

        this.updateBounds(w, h);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(this.renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
        this.scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0x00d2ff, 2.0);
        dirLight.position.set(5, 10, 5);
        this.scene.add(dirLight);

        // 🔥 FITUR GOD RAYS "BLUR ABIS" 🔥
        this.createGodRays();

        // LOAD MULTIPLE FISH
        const loader = new GLTFLoader();
        let loadedCount = 0;

        this.modelFiles.forEach((fileName) => {
            loader.load(fileName, (gltf) => {
                const model = gltf.scene;
                
                const scale = 0.35 + Math.random() * 0.2;
                model.scale.set(scale, scale, scale);
                
                model.position.set(
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 5,
                    -10 
                );

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

    updateBounds: function(width, height) {
        const aspect = width / height;
        const vHeight = 2 * Math.tan((this.camera.fov * Math.PI / 180) / 2) * 8; 
        const vWidth = vHeight * aspect;
        this.bounds.xMin = -vWidth / 1.5; this.bounds.xMax = vWidth / 1.5;
        this.bounds.yMin = -vHeight / 2.5; this.bounds.yMax = vHeight / 2.5;
        this.bounds.zMin = -20; 
        this.bounds.zMax = 6;   
    },

    // 🔥 GENERATOR TEKSTUR GRADASI LEMBUT (RAHASIA BLUR) 🔥
    createSoftBeamTexture: function() {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 128;
        const context = canvas.getContext('2d');
        
        // 1. Gradasi Horizontal (Kiri-Kanan): Transparan -> Putih -> Transparan
        // Ini bikin pinggiran batang jadi hilang (soft edge)
        const gradientX = context.createLinearGradient(0, 0, 32, 0);
        gradientX.addColorStop(0, 'rgba(255, 255, 255, 0)');   // Pinggir Kiri Bening
        gradientX.addColorStop(0.5, 'rgba(255, 255, 255, 1)'); // Tengah Putih
        gradientX.addColorStop(1, 'rgba(255, 255, 255, 0)');   // Pinggir Kanan Bening
        
        context.fillStyle = gradientX;
        context.fillRect(0, 0, 32, 128);
        
        // 2. Gradasi Vertikal (Atas-Bawah): Pudar di ujung bawah
        const gradientY = context.createLinearGradient(0, 0, 0, 128);
        gradientY.addColorStop(0, 'rgba(255, 255, 255, 0)');   // Atas pudar dikit
        gradientY.addColorStop(0.1, 'rgba(255, 255, 255, 1)'); // Dekat atas terang
        gradientY.addColorStop(1, 'rgba(255, 255, 255, 0)');   // Bawah hilang
        
        // Masking (destination-in) untuk gabungin kedua gradasi
        context.globalCompositeOperation = 'destination-in';
        context.fillStyle = gradientY;
        context.fillRect(0, 0, 32, 128);

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    },

    // 🔥 SISTEM GOD RAYS BARU (PAKAI PLANE, BUKAN CYLINDER)
    createGodRays: function() {
        const beamTexture = this.createSoftBeamTexture();
        
        // Material "Hantu" (Additive Blending + Tekstur Gradasi)
        const material = new THREE.MeshBasicMaterial({
            map: beamTexture,
            color: 0x88d2ff,          // Biru Laut
            transparent: true,
            opacity: 0.15,            // Transparansi dasar (nanti diupdate per ray)
            blending: THREE.AdditiveBlending, // KUNCI PENDARAN CAHAYA
            side: THREE.DoubleSide,
            depthWrite: false         // Gak nulis depth, biar tumpuk-menumpuk halus
        });

        // Geometri Bidang Datar Panjang
        // Lebar: 2, Tinggi: 35
        const geometry = new THREE.PlaneGeometry(2, 35);

        // Buat 12 Batang Cahaya
        for (let i = 0; i < 12; i++) {
            const group = new THREE.Group();

            // KITA SILANGKAN 2 BIDANG BIAR KELIHATAN 3D (+ Shape)
            const plane1 = new THREE.Mesh(geometry, material.clone()); // Clone biar bisa beda opacity
            const plane2 = new THREE.Mesh(geometry, material.clone());
            plane2.rotation.y = Math.PI / 2; // Putar 90 derajat

            group.add(plane1);
            group.add(plane2);

            // Logika Speed & Blur
            const speed = 0.3 + Math.random() * 0.8; // Speed goyang
            
            // Makin cepat = Makin transparan/blur
            const opacity = 0.12 / (speed * 0.8); 
            plane1.material.opacity = opacity;
            plane2.material.opacity = opacity;

            // POSISI MENYEBAR DI TENGAH LAYAR
            group.position.set(
                (Math.random() - 0.5) * 18, // X: Sebar lebar di layar
                12,                         // Y: Di atas layar
                -2 - Math.random() * 6      // Z: Agak di belakang ikan
            );

            // ROTASI MIRING SERAGAM KE KIRI
            const baseRotZ = -0.35 + (Math.random() * 0.1); // Miring -0.35 rad
            group.rotation.z = baseRotZ;
            group.rotation.x = -0.1; // Miring depan dikit

            // Simpan data animasi
            group.userData = {
                baseRotZ: baseRotZ,
                speed: speed,
                offset: Math.random() * 10
            };

            this.scene.add(group);
            this.godRays.push(group);
        }
    },

    pickNewTarget: function(fish) {
        if (!fish.model) return;

        const isGlassHit = Math.random() < 0.35;
        let xTarget, yTarget, zTarget;

        if (isGlassHit) {
            zTarget = THREE.MathUtils.randFloat(5, 6);
            xTarget = THREE.MathUtils.randFloat(-2, 2);
            yTarget = THREE.MathUtils.randFloat(-1, 1);
        } else {
            zTarget = THREE.MathUtils.randFloat(this.bounds.zMin, 0);
            xTarget = THREE.MathUtils.randFloat(this.bounds.xMin, this.bounds.xMax);
            yTarget = THREE.MathUtils.randFloat(this.bounds.yMin, this.bounds.yMax);
        }

        fish.targetPosition = new THREE.Vector3(xTarget, yTarget, zTarget);
    },

    animate: function() {
        requestAnimationFrame(this.animate.bind(this));
        if (!this.isVisible) return; 

        const delta = this.clock.getDelta();
        const elapsed = this.clock.getElapsedTime();

        // 🔥 ANIMASI CAHAYA (GOYANG HALUS)
        this.godRays.forEach(group => {
            const wobble = Math.sin(elapsed * group.userData.speed + group.userData.offset) * 0.02;
            group.rotation.z = group.userData.baseRotZ + wobble;
            
            // Efek Napas (Terang-Redup dikit)
            // group.children[0].material.opacity += Math.sin(elapsed * 2) * 0.0005;
        });

        // ANIMASI IKAN
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
                     fish.model.position.set(0,0,-15);
                     this.pickNewTarget(fish);
                }
            }
        });

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
};