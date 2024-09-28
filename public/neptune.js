window.addEventListener('load', async function() {
    console.log("Script started");

    if (typeof THREE === 'undefined') {
        console.error('Three.js is not loaded');
        return;
    }

    if (typeof THREE.OrbitControls === 'undefined') {
        console.error('OrbitControls is not loaded');
        return;
    }

    // Your Neptune visualization code here
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minDistance = 10;
    controls.maxDistance = 50;

    function createNeptuneTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1024; // Reduced from 2048 for better performance
        const ctx = canvas.getContext('2d');

        const noise = new SimplexNoise();

        function fbm(x, y, octaves) {
            let value = 0;
            let amplitude = 0.5;
            let frequency = 1;
            for (let i = 0; i < octaves; i++) {
                value += amplitude * (noise.noise2D(x * frequency, y * frequency) + 1) / 2;
                amplitude *= 0.5;
                frequency *= 2;
            }
            return value;
        }

        const imageData = ctx.createImageData(canvas.width, canvas.height);
        const data = imageData.data;

        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const nx = x / canvas.width - 0.5;
                const ny = y / canvas.height - 0.5;
                const r = Math.sqrt(nx*nx + ny*ny);
                const angle = Math.atan2(ny, nx);

                const turbulence = fbm(nx * 3, ny * 3, 4); // Reduced octaves
                const swirl = fbm(
                    nx * 2 + 0.1 * Math.cos(angle * 3 + r * 10),
                    ny * 2 + 0.1 * Math.sin(angle * 3 + r * 10),
                    2
                );

                const index = (y * canvas.width + x) * 4;
                data[index] = Math.floor(100 + 50 * (turbulence * swirl)); // Red
                data[index + 1] = Math.floor(180 + 75 * swirl); // Green
                data[index + 2] = Math.floor(200 + 55 * turbulence); // Blue
                data[index + 3] = 255; // Alpha
            }
        }

        ctx.putImageData(imageData, 0, 0);

        // Add some brighter swirls
        ctx.globalCompositeOperation = 'lighten';
        for (let i = 0; i < 3; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const radius = Math.random() * 200 + 100;
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }

        return canvas;
    }

    const neptuneTexture = new THREE.CanvasTexture(createNeptuneTexture());

    const geometry = new THREE.SphereGeometry(5, 64, 64); // Reduced resolution
    const material = new THREE.MeshStandardMaterial({
        map: neptuneTexture,
        bumpMap: neptuneTexture,
        bumpScale: 0.05,
        metalness: 0.1,
        roughness: 0.8,
        transparent: true,
        opacity: 0.95  // Adjust this value to control opacity (0.0 to 1.0)
    });
    const neptune = new THREE.Mesh(geometry, material);
    scene.add(neptune);

    // Enhance glow effect
    const glowGeometry = new THREE.SphereGeometry(5.1, 64, 64);
    const glowMaterial = new THREE.ShaderMaterial({
        uniforms: {
            c: { type: "f", value: 0.1 },
            p: { type: "f", value: 1.2 },
            glowColor: { type: "c", value: new THREE.Color(0x4169E1) },
            viewVector: { type: "v3", value: camera.position }
        },
        vertexShader: `
            uniform vec3 viewVector;
            varying float intensity;
            void main() {
                gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
                vec3 actual_normal = vec3(modelMatrix * vec4(normal, 0.0));
                intensity = pow( dot(normalize(viewVector), actual_normal), 6.0 );
            }
        `,
        fragmentShader: `
            uniform vec3 glowColor;
            varying float intensity;
            void main() {
                gl_FragColor = vec4( glowColor * intensity, 1.0 );
            }
        `,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true
    });
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(glowMesh);

    const clock = new THREE.Clock();

    // Adjust lighting
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x4169E1, 0.3);
    scene.add(hemisphereLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);

    const gui = new dat.GUI();
    const neptuneControlsObj = {
        bumpScale: 0.05,
        rotationSpeed: 0.001,
        dayLength: 16.11,
    };
    gui.add(neptuneControlsObj, 'bumpScale', 0, 0.2).name('Surface Detail').onChange((value) => {
        material.bumpScale = value;
    });
    gui.add(neptuneControlsObj, 'rotationSpeed', 0, 0.01).name('Rotation Speed');
    gui.add(neptuneControlsObj, 'dayLength', 5, 30).name('Day Length (hours)');

    // Add Neptune Opacity control
    gui.add(material, 'opacity', 0.5, 1).name('Neptune Opacity').onChange((value) => {
        material.needsUpdate = true;
    });

    // Create stars
    const starCount = 10000;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
        const i3 = i * 3;
        starPositions[i3] = (Math.random() - 0.5) * 2000;
        starPositions[i3 + 1] = (Math.random() - 0.5) * 2000;
        starPositions[i3 + 2] = (Math.random() - 0.5) * 2000;

        const color = new THREE.Color();
        color.setHSL(Math.random() * 0.2 + 0.5, 0.8, Math.random() * 0.5 + 0.5);
        starColors[i3] = color.r;
        starColors[i3 + 1] = color.g;
        starColors[i3 + 2] = color.b;

        starSizes[i] = Math.random() * 4 + 0.5;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    starGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));

    const starMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 }
        },
        vertexShader: `
            attribute float size;
            attribute vec3 color;
            varying vec3 vColor;
            void main() {
                vColor = color;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            void main() {
                if (length(gl_PointCoord - vec2(0.5, 0.5)) > 0.5) discard;
                gl_FragColor = vec4(vColor, 1.0);
            }
        `,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        transparent: true
    });

    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    camera.position.set(0, 0, 20);

    scene.background = new THREE.Color(0x000008);  // Very dark blue background

    // Adjust Neptune's position and scale
    neptune.position.set(0, 0, 0);
    neptune.scale.set(1, 1, 1);

    // Fetch trajectory data
    const trajectoryData = await getTrajectoryData();
    if (!trajectoryData) {
        console.error("Failed to load trajectory data");
        return;
    }

    const scale = 100; // Adjusted scale factor
    const smoothFactor = 10; // Number of interpolated points between each original point

    // Create a smooth curve
    const curve = new THREE.CatmullRomCurve3(
        trajectoryData.x.map((_, i) => new THREE.Vector3(
            trajectoryData.x[i] * scale,
            trajectoryData.y[i] * scale,
            trajectoryData.z[i] * scale
        ))
    );

    const points = curve.getPoints(trajectoryData.x.length * smoothFactor);
    const trajectoryGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const trajectoryMaterial = new THREE.LineBasicMaterial({ color: 0xffff00 });
    const trajectoryLine = new THREE.Line(trajectoryGeometry, trajectoryMaterial);
    scene.add(trajectoryLine);

    // Add helper spheres to visualize trajectory points (optional)
    const sphereGeometry = new THREE.SphereGeometry(0.5, 32, 32);
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    trajectoryData.x.forEach((_, i) => {
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.set(
            trajectoryData.x[i] * scale,
            trajectoryData.y[i] * scale,
            trajectoryData.z[i] * scale
        );
        scene.add(sphere);
    });

    // Adjust camera to fit both Neptune and the trajectory
    const neptuneBox = new THREE.Box3().setFromObject(neptune);
    const trajectoryBox = new THREE.Box3().setFromObject(trajectoryLine);
    const combinedBox = neptuneBox.union(trajectoryBox);

    const center = combinedBox.getCenter(new THREE.Vector3());
    const size = combinedBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 * Math.tan(fov * 2));

    cameraZ *= 1.5; // Add some space between camera and objects
    camera.position.set(center.x, center.y, cameraZ);
    camera.lookAt(center);

    const minZ = combinedBox.min.z;
    const cameraToFarEdge = minZ < 0 ? -minZ + cameraZ : cameraZ - minZ;

    camera.far = cameraToFarEdge * 3;
    camera.updateProjectionMatrix();
    controls.target.copy(center);
    controls.update();

    function animate() {
        requestAnimationFrame(animate);
        
        const elapsedTime = clock.getElapsedTime();
        
        neptune.rotation.y += neptuneControlsObj.rotationSpeed;
        
        // Update based on camera distance
        const distance = camera.position.distanceTo(neptune.position);
        const normalizedDistance = Math.max(0, Math.min(1, (distance - controls.minDistance) / (controls.maxDistance - controls.minDistance)));
        
        // Adjust glow intensity
        glowMaterial.uniforms.c.value = 0.1 + normalizedDistance * 0.2;
        
        glowMaterial.uniforms.viewVector.value = new THREE.Vector3().subVectors(camera.position, glowMesh.position);
        
        controls.update();
        
        const time = Date.now() * 0.0005;
        starMaterial.uniforms.time.value = time;
        stars.rotation.y = time * 0.1;

        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const infoDiv = document.getElementById('info');

    window.addEventListener('mousemove', (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(neptune);

        if (intersects.length > 0) {
            infoDiv.style.display = 'block';
            infoDiv.innerHTML = `
                <h3>Neptune</h3>
                <p>Eighth planet from the Sun</p>
                <p>Diameter: 49,244 km</p>
                <p>Day length: ${neptuneControlsObj.dayLength.toFixed(2)} hours</p>
                <p>Rotation speed: ${neptuneControlsObj.rotationSpeed.toFixed(4)}</p>
            `;
        } else {
            infoDiv.style.display = 'none';
        }
    });

    console.log("Setup complete");
});