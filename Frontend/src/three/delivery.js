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
const robotModelGroup = new THREE.Group();
robotModelGroup.position.y = 0;
scene.add(robotModelGroup);

const canvas = document.querySelector(".webgl");

let texturesReady = false;
let modelReady = false;

const tryStartIntro = () => {
  if (!texturesReady || !modelReady || !robotModel) return;
  afterLoadedTheContent();
};

const afterLoadedTheContent = () => {
  if (!robotModel) {
    document.body.style.overflow = "initial";
    document.documentElement.style.overflow = "initial";
    if (canvas) canvas.style.pointerEvents = "initial";
    gsap.to("nav", { opacity: 1 });
    return;
  }

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

  tl.from(
    robotModel.position,
    {
      y: -3.5,
      ease: "power1.out",
      duration: 1,
    },
    "a"
  );

  tl.from(
    robotModel.rotation,
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

let robotModel = null;
const ROBOT_MODEL = MODELS.deliveryBot;
const TARGET_SIZE = 3.5;

const centerAndScaleModel = (model) => {
  const box = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);
  model.position.sub(center);

  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const scale = TARGET_SIZE / maxDim;
  model.scale.setScalar(scale);

  return model;
};

gltfLoader.load(
  ROBOT_MODEL,
  (gltf) => {
    let sourceModel = gltf.scene;
    robotModel = centerAndScaleModel(sourceModel.clone(true));
    robotModelGroup.add(robotModel);
    modelReady = true;
    tryStartIntro();
  },
  undefined,
  (error) => {
    console.error("Failed to load robot model:", error);
    texturesReady && afterLoadedTheContent();
  }
);

const cursor = { x: 0, y: 0 };
let rotationFlag = false;

canvas.addEventListener("mousemove", (dets) => {
  cursor.x = dets.clientX / window.innerWidth;
  cursor.y = dets.clientY / window.innerHeight;

  rotationFlag = cursor.x < 0.5;

  gsap.to(camera.position, {
    x: -cursor.x * 0.7,
    duration: 0.5,
    ease: "linear",
  });
});

let flagIndex = 0; // 0: White, 1: Black, 2: Red
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
    // Add sound if necessary, though file path might be missing
    // const switchAudio = new Audio("./sounds/canSwitch3.wav");
    // switchAudio.playbackRate = 3.0;
    // switchAudio.play().catch(()=>{});
    lineAnimation.restart();
  }

  const rotationDirection = rotationFlag ? -1 : 1;
  gsap.to(robotModel.rotation, {
    y: robotModel.rotation.y + Math.PI * 2 * rotationDirection,
    duration: 0.8,
    ease: "power2.inOut"
  });
  
  gsap.to("#page1", {
    backgroundColor: themes[nextIndex],
    duration: 0.8
  });

  flagIndex = nextIndex;
};

canvas.addEventListener("click", () => {
  updateAnimation(true);
});

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

const ambientLight = new THREE.AmbientLight("#ffffff", 2);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight("#fffff0", 5);
directionalLight.position.set(2, 1.5, 2);
scene.add(directionalLight);

let scrollY = window.screenY;
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

const sizes = { width: window.innerWidth, height: window.innerHeight };

const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100);
camera.position.set(0, 0, 4.6);
camera.lookAt(0, 0, 0);
scene.add(camera);

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
