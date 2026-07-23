import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { IMAGES, MODELS } from "../config/assest.js";
import loaderVertexShader from "../shaders/loader/vertex.glsl";
import loaderFragmentShader from "../shaders/loader/fragment.glsl";

gsap.registerPlugin(ScrollTrigger);

(() => {
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";
})();

const scene = new THREE.Scene();

// Single model group — only the Apple Watch Ultra 2 is loaded now.
const modelGroups = [
  new THREE.Group(), // index 0: Apple Watch Ultra 2
];
modelGroups.forEach((g) => {
  g.visible = false;
  scene.add(g);
});

const canvas = document.querySelector(".webgl");

let texturesReady = false;
let modelsLoadedCount = 0;
const TOTAL_MODELS = 1; // single watch only

// productModels[0] is the normalized Apple Watch object
const productModels = [null];

// ── Single model path — iPhone/MacBook refs removed ───────────────────────────
const MODEL_PATHS = [MODELS.appleWatch];

// Normalized target height for every model — keeps watch, phone, and laptop
// visually consistent in the same camera frame (camera.position.z = 4.6)
const TARGET_SIZE = 3.5;

const centerAndScaleModel = (model) => {
  const box = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);
  // Translate so the model's bounding-box centre sits at origin
  model.position.sub(center);

  // Scale uniformly so the longest dimension == TARGET_SIZE
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const scale = TARGET_SIZE / maxDim;
  model.scale.setScalar(scale);

  return model;
};

// ─── Swap logic ──────────────────────────────────────────────────────────────
// currentModelIndex tracks which slot is currently visible.
// On the very first model this is set to 0 after all models load.
let currentModelIndex = 0;

/**
 * Cross-fade from the currently visible model to the next one.
 * Uses Three.js group traversal to fade material opacity so the swap
 * doesn't pop. Duration is intentionally short (0.5s) to feel snappy.
 *
 * @param {number} nextIndex - 0, 1, or 2
 */
const swapToModel = (nextIndex) => {
  const prev = modelGroups[currentModelIndex];
  const next = modelGroups[nextIndex];

  if (!productModels[nextIndex]) {
    // Model not loaded yet (e.g. heavy Apple Watch still downloading on first visit).
    // Skip gracefully — the cycle will catch it on the next repeat.
    return;
  }

  // Fade out current
  prev.traverse((child) => {
    if (child.isMesh && child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((mat) => {
        mat.transparent = true;
        gsap.to(mat, { opacity: 0, duration: 0.4, ease: "power1.in" });
      });
    }
  });

  // Make next group visible and fade in
  next.visible = true;
  next.traverse((child) => {
    if (child.isMesh && child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((mat) => {
        mat.transparent = true;
        mat.opacity = 0;
        gsap.to(mat, { opacity: 1, duration: 0.5, ease: "power1.out" });
      });
    }
  });

  // Hide prev after fade completes
  gsap.delayedCall(0.45, () => {
    prev.visible = false;
    // Reset prev opacity for when it becomes current again
    prev.traverse((child) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat) => { mat.opacity = 1; });
      }
    });
  });

  currentModelIndex = nextIndex;
};

// ─── Intro animation (fires once textures AND the watch model are ready) ──────
const tryStartIntro = () => {
  if (!texturesReady || modelsLoadedCount < TOTAL_MODELS) return;
  afterLoadedTheContent();
};

const afterLoadedTheContent = () => {
  // Show the watch (index 0)
  modelGroups[0].visible = true;
  currentModelIndex = 0;

  const tl = gsap.timeline();

  tl.to(LoaderPlane.scale, {
    x: 4,
    y: 4,
    z: 4,
    duration: 2,
  });

  tl.to(LoaderPlane.material.uniforms.uOffset, {
    value: 1,
    duration: 1.5,
  });

  tl.to("nav", {
    opacity: 1,
  });

  // Intro: first model rises from below
  const firstModel = productModels[0];
  tl.from(
    firstModel.position,
    {
      y: -3.5,
      ease: "power1.out",
      duration: 1,
    },
    "a"
  );

  tl.from(
    firstModel.rotation,
    {
      y: Math.PI * 2.2,
      x: Math.PI * 1.5,
      ease: "power1.out",
      duration: 1,
      onComplete: () => {
        document.body.style.overflow = "initial";
        document.documentElement.style.overflow = "initial";
        canvas.style.pointerEvents = "initial";
      },
    },
    "a"
  );

  clutterAnimation(".page1-main>h1");
  tl.from(
    ".page1-main>h1>span",
    {
      opacity: 0,
      ease: "power1.out",
      stagger: {
        amount: 1,
        from: "x",
      },
    },
    "a"
  );

  clutterAnimation(".page1-footer-title>h1");
  tl.from(
    ".page1-footer-title>h1>span",
    {
      opacity: 0,
      y: 50,
      textContent: getRandomText(4),
      stagger: {
        amount: randomTextAnimationSpeed,
        from: "x",
      },
      onStart: () => {
        robotAnimationLoop();
      },
    },
    "a"
  );

  tl.from(
    ".three-loder",
    {
      width: "0",
    },
    "a"
  );
};

// ─── Loading manager (textures) ───────────────────────────────────────────────
let checkLoadingStart = true;
const loadingManager = new THREE.LoadingManager(
  () => {
    texturesReady = true;
    tryStartIntro();
  },
  (itemUrl, itemsLoaded, itemsTotal) => {
    if (checkLoadingStart) {
      checkLoadingStart = false;
      gsap.to(".main-loader", {
        backgroundColor: "transparent",
      });
    }
  }
);

// ─── Loaders ─────────────────────────────────────────────────────────────────
const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/gltf/");
dracoLoader.preload();
gltfLoader.setDRACOLoader(dracoLoader);
const textureLoader = new THREE.TextureLoader(loadingManager);

const displacementTexture = textureLoader.load(IMAGES.displacement);
displacementTexture.colorSpace = THREE.NoColorSpace;
displacementTexture.minFilter = THREE.LinearFilter;
displacementTexture.magFilter = THREE.LinearFilter;
displacementTexture.generateMipmaps = false;

const video = document.querySelector(".main-loader>video");
const videoTexture = new THREE.VideoTexture(video);

const LoaderPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({
    vertexShader: loaderVertexShader,
    fragmentShader: loaderFragmentShader,
    uniforms: {
      uDisplacement: new THREE.Uniform(displacementTexture),
      uCocaColaTexture: new THREE.Uniform(videoTexture),
      uOffset: new THREE.Uniform(0),
    },
    transparent: true,
  })
);
scene.add(LoaderPlane);

// ─── Load the Apple Watch and apply red tint ──────────────────────────────────
// ⚠️  Performance note: apple_watch_ultra_2.glb is ~15MB. Compress before prod.
//
// Material strategy:
//   RECOLORED (#C41E3A): body parts with beige/brown base colours (0.26–0.52)
//   SKIPPED: pure-black mats (screen/trim), BLEND mats (glass/display), texture mats
//
// Materials classified as "body/band":
//   [0,2,5,7,8,9,10,11,12,13,15] — brown/beige and existing red-ish tones
//   [14,27] — grey casing hardware (tinted red too for coherence)
const BODY_MAT_INDICES = new Set([0, 2, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 27, 29]);

const RED_WATCH = new THREE.Color("#C41E3A");

const applyRedTint = (model) => {
  // Collect the GLTF material instances by index using userData stored on mesh
  const materialsSeen = new Map(); // mat object → already processed
  model.traverse((child) => {
    if (!child.isMesh) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach((mat) => {
      if (materialsSeen.has(mat)) return;
      materialsSeen.set(mat, true);

      // Skip: transparent/blend materials (glass, display, screen face)
      if (mat.transparent && mat.opacity < 1) return;
      // Skip: materials with a base colour texture (watch face graphics etc.)
      if (mat.map) return;
      // Skip: pure black materials (screen, black trim)
      const col = mat.color;
      if (col && col.r < 0.05 && col.g < 0.05 && col.b < 0.05) return;

      // Everything that's left is physical body / band — recolor it
      mat.color.set(RED_WATCH);
    });
  });
};

MODEL_PATHS.forEach((path, i) => {
  gltfLoader.load(
    path,
    (gltf) => {
      const model = centerAndScaleModel(gltf.scene.clone(true));
      applyRedTint(model);
      productModels[i] = model;
      modelGroups[i].add(model);
      modelsLoadedCount++;
      tryStartIntro();
    },
    undefined,
    (error) => {
      console.error(`Failed to load model [${i}] ${path}:`, error);
      modelsLoadedCount++;
      tryStartIntro();
    }
  );
});

// ─── Drag-to-rotate state ────────────────────────────────────────────────────
let isDragging = false;
let prevPointer = { x: 0, y: 0 };
let dragVelocity = { x: 0, y: 0 }; // used for inertia after release
const DRAG_SENSITIVITY = 0.005;
const X_CLAMP = Math.PI / 3; // ±60° vertical clamp — prevents upside-down flip
const INERTIA_DECAY = 0.93;   // velocity multiplied per frame after release
let autoResumeTimeout = null;

// Set the initial cursor so the user knows the canvas is interactive
canvas.style.cursor = "grab";

const cursor = { x: 0, y: 0 };
let rotationFlag = false;

canvas.addEventListener("mousemove", (dets) => {
  // Skip camera parallax while actively dragging — the two movements fight
  if (isDragging) return;

  cursor.x = dets.clientX / window.innerWidth;
  cursor.y = dets.clientY / window.innerHeight;

  rotationFlag = cursor.x < 0.5;

  gsap.to(camera.position, {
    x: -cursor.x * 0.7,
    duration: 0.5,
    ease: "linear",
  });
});

let flagIndex = 0; // cycles 0 → 1 → 2 for heading/theme animation (no model swap)
const themes = ["#ffffff", "#000", "#d91921"];

const page1Heading1 = document.querySelector(".page1-heading1");
const page1Heading2 = document.querySelector(".page1-heading2");
const page1Heading3 = document.querySelector(".page1-heading3");

const page1Para1 = document.querySelector(".page1-para1");
const page1Para2 = document.querySelector(".page1-para2");
const page1Para3 = document.querySelector(".page1-para3");

const headings = [page1Heading1, page1Heading2, page1Heading3];
const paras = [page1Para1, page1Para2, page1Para3];

const clutterAnimation = (element) => {
  const htmlTag = document.querySelector(element);
  let clutter = "";
  htmlTag.textContent.split("").forEach((word) => {
    clutter += `<span class="inline-block text-span">${word}</span>`;
  });
  htmlTag.innerHTML = clutter;
};

function getRandomText(length) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ!$&?";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

const randomTextAnimation = [
  "<h1>Real-Time &nbsp; Prices</h1>",
  "<h1>Verified &nbsp; Sellers</h1>",
  "<h1>Best Deal &nbsp; Guaranteed</h1>",
];
const randomTextAnimationSpeed = 0.5;

const updateAnimation = (sound) => {
  const currentIndex = flagIndex;
  const nextIndex = (flagIndex + 1) % 3;

  // Slide headings
  gsap.to(headings[currentIndex], {
    top: "100%",
    onComplete: () => {
      gsap.to(headings[nextIndex], {
        top: "0",
      });
    },
  });

  gsap.to(paras[currentIndex], {
    top: "100%",
    onComplete: () => {
      gsap.to(paras[nextIndex], {
        top: "0",
      });
    },
  });

  document.querySelector(".page1-footer-title>h1").innerHTML = randomTextAnimation[nextIndex];
  clutterAnimation(".page1-footer-title>h1");

  gsap.from(".page1-footer-title>h1>span", {
    opacity: 0,
    y: 50,
    textContent: getRandomText(4),
    stagger: {
      amount: randomTextAnimationSpeed,
      from: "x",
    },
  });

  if (sound) {
    lineAnimation.restart();
  }

  // Model stays fixed — no swap needed with a single watch.
  // Theme/background colour still cycles per the existing logic.
  gsap.to("#page1", {
    backgroundColor: themes[nextIndex],
    duration: 0.8,
  });

  flagIndex = nextIndex;
};

canvas.addEventListener("click", () => {
  updateAnimation(true);
});

// ─── Drag-to-rotate listeners ────────────────────────────────────────────────
canvas.addEventListener("pointerdown", (e) => {
  isDragging = true;
  prevPointer = { x: e.clientX, y: e.clientY };
  dragVelocity = { x: 0, y: 0 };
  canvas.style.cursor = "grabbing";
  // Keep drag alive even if pointer moves outside the canvas boundary
  canvas.setPointerCapture(e.pointerId);
  // Prevent the page from scrolling/panning under a touch drag
  canvas.style.touchAction = "none";
  if (autoResumeTimeout) clearTimeout(autoResumeTimeout);
});

canvas.addEventListener("pointermove", (e) => {
  if (!isDragging) return;

  const dx = e.clientX - prevPointer.x;
  const dy = e.clientY - prevPointer.y;
  prevPointer = { x: e.clientX, y: e.clientY };

  // Store velocity for inertia (last delta, not accumulated)
  dragVelocity.x = dy * DRAG_SENSITIVITY;
  dragVelocity.y = dx * DRAG_SENSITIVITY;

  // Apply to ALL groups so each model keeps its own orientation across swaps
  modelGroups.forEach((group) => {
    group.rotation.y += dx * DRAG_SENSITIVITY;
    group.rotation.x = THREE.MathUtils.clamp(
      group.rotation.x + dy * DRAG_SENSITIVITY,
      -X_CLAMP,
      X_CLAMP
    );
  });
});

const endDrag = (e) => {
  if (!isDragging) return;
  isDragging = false;
  canvas.style.cursor = "grab";
  if (e && e.pointerId != null) {
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  }
  // Re-enable default touch scrolling after a short delay
  // (immediate removal can cause scroll to fire on the same touch-end)
  autoResumeTimeout = setTimeout(() => {
    canvas.style.touchAction = "";
    dragVelocity = { x: 0, y: 0 }; // kill inertia 1.5s after release
  }, 1500);
};

canvas.addEventListener("pointerup",     endDrag);
canvas.addEventListener("pointercancel", endDrag);
// pointerleave is NOT handled here — setPointerCapture keeps events coming
// even outside the canvas, so we only stop on explicit up/cancel.

const threeLoaderLine = document.querySelector(".three-loder-line");
let lineAnimation = null;

const robotAnimationLoop = () => {
  gsap.to(page1Heading1, { top: "0" });
  gsap.to(page1Para1, { top: "0%" });

  lineAnimation = gsap.to(threeLoaderLine, {
    width: "100%",
    duration: 10,
    repeat: -1,
    onRepeat: () => {
      updateAnimation(false);
      threeLoaderLine.style.width = 0;
    },
  });
};

// ─── Lights ───────────────────────────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight("#ffffff", 2);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight("#fffff0", 5);
directionalLight.position.set(2, 1.5, 2);
scene.add(directionalLight);

// ─── Camera ───────────────────────────────────────────────────────────────────
const sizes = { width: window.innerWidth, height: window.innerHeight };

const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100);
camera.position.set(0, 0, 4.6);
camera.lookAt(0, 0, 0);
scene.add(camera);

// ─── Renderer ─────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
});
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));

window.addEventListener("resize", () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
});

// ─── Scroll parallax (canvas zoom on scroll unchanged) ───────────────────────
let scrollY = window.scrollY;
window.addEventListener("scroll", () => {
  scrollY = window.scrollY;
});

gsap.to(".webgl", {
  scale: "1.15",
  scrollTrigger: {
    scroller: "body",
    trigger: "#page1",
    start: "top 0",
    end: "top -100%",
    scrub: 1,
  },
});

// ─── Render loop ──────────────────────────────────────────────────────────────
const tick = () => {
  requestAnimationFrame(tick);

  // Apply decaying inertia when user has released the drag
  if (!isDragging && (Math.abs(dragVelocity.x) > 0.0001 || Math.abs(dragVelocity.y) > 0.0001)) {
    modelGroups.forEach((group) => {
      group.rotation.y += dragVelocity.y;
      group.rotation.x = THREE.MathUtils.clamp(
        group.rotation.x + dragVelocity.x,
        -X_CLAMP,
        X_CLAMP
      );
    });
    dragVelocity.x *= INERTIA_DECAY;
    dragVelocity.y *= INERTIA_DECAY;
  }

  renderer.render(scene, camera);
};
tick();
