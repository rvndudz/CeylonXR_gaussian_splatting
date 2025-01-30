import * as GaussianSplats3D from 'gaussian-splats-3d';
import * as THREE from 'three';

async function loadGardenScene() {
  const viewerOptions = {
    cameraUp: [0, -1, 0],
    initialCameraPosition: [-3.99198, -6.83456, -0.16008],
    initialCameraLookAt: [2.26601, -3.31786, 1.17009],
    antialiased: false,
    splatRenderMode: GaussianSplats3D.SplatRenderMode.ThreeD,
    sphericalHarmonicsDegree: 0
  };

  const s3Url = "https://ceylonxr.s3.eu-north-1.amazonaws.com/ella.ksplat";

  // Detect if we're on localhost (or 127.0.0.1).
  const hostname = window.location.hostname;
  const isLocalhost = (hostname === 'localhost' || hostname === '127.0.0.1');

  try {
    // Fetch the splat file 
    
    // Choose the appropriate file URL depending on environment
    let response;
    if (isLocalhost) {
      response = await fetch('./assets/scenes/ella.ksplat');
    } else {
      response = await fetch(s3Url);
    }

    if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);

    const contentLength = response.headers.get("Content-Length");
    if (!contentLength) {
      console.warn("No content-length available, progress bar may not work correctly.");
    }

    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
    let loadedBytes = 0;

    // Read stream in chunks
    const reader = response.body.getReader();
    let chunks = [];

    const progressBar = document.getElementById("progress-bar");

    // 🔥 STEP 1: Show Rotating Placeholder Sphere
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 5);

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const geometry = new THREE.SphereGeometry(1, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
    const placeholder = new THREE.Mesh(geometry, material);
    scene.add(placeholder);

    function animate() {
      requestAnimationFrame(animate);
      placeholder.rotation.y += 0.01;
      renderer.render(scene, camera);
    }
    animate();

    // 🔥 STEP 2: Download Model and Show Progress
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      loadedBytes += value.byteLength; // ✅ Fixed from `value.length`

      if (totalBytes > 0) {
        const percent = (loadedBytes / totalBytes) * 100;
        progressBar.style.width = `${percent}%`;
      }
    }

    // Combine all chunks into a single buffer
    const fileBuffer = new Uint8Array(loadedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      fileBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    // Load the model
    const splatBuffer = await GaussianSplats3D.KSplatLoader.loadFromFileData(fileBuffer.buffer);
    
    // Hide progress bar
    progressBar.parentElement.style.display = "none";

    const viewer = new GaussianSplats3D.Viewer(viewerOptions);
    viewer.addSplatBuffers([splatBuffer]);
    viewer.start();

    // 🔥 STEP 3: Remove Placeholder Sphere Once Model Loads
    scene.remove(placeholder);
    document.body.removeChild(renderer.domElement);
  } catch (error) {
    console.error("Failed to load the Ella scene from S3:", error);
  }
}

loadGardenScene().catch(error => {
  console.error("Unexpected error:", error);
});
