import * as THREE from "three";
import { gsap } from "gsap";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { IMAGES, MODELS } from "../config/assest.js";
import vertexShader from "../shaders/water/vertex.glsl";
import fragmentShader from "../shaders/water/fragment.glsl";

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/gltf/");
dracoLoader.preload();

function isMobileDevice() {
  return /Mobi|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|OperaMini|Android/i.test(
    navigator.userAgent
  );
}

if (!isMobileDevice()) {
  const webGLEffect = (container, img, texture, planeWidth = 1, glbPath = null) => {
    const imageContainer = document.querySelector(container);
    const imageElement = document.querySelector(img);

    let easeFactor = 0.2;
    let scene, camera, renderer, planeMesh, glbModel;
    let mousePosition = { x: 0.5, y: 0.5 };
    let targetMousePosition = { x: 0.5, y: 0.5 };
    let aberrationIntensity = 0;
    let prevPosition = { x: 0.5, y: 0.5 };

    // Drag-to-rotate state (scoped per webGLEffect instance)
    let isDraggingGlb = false;
    let dragPrev = { x: 0, y: 0 };
    let glbVelocity = { x: 0, y: 0 };
    const GLB_SENSITIVITY = 0.005;
    const GLB_X_CLAMP = Math.PI / 3; // ±60° vertical
    const GLB_INERTIA_DECAY = 0.92;
    let dragResumeTimer = null;

    function initializeScene(texture) {
      scene = new THREE.Scene();

      camera = new THREE.PerspectiveCamera(
        75,
        (imageElement.offsetWidth / planeWidth / imageElement.offsetHeight) *
          1.3,
        0.01,
        100
      );
      camera.position.z = 1;

      planeMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2, 64, 64),
        new THREE.ShaderMaterial({
          uniforms: {
            uFrequency: new THREE.Uniform(new THREE.Vector2(0, 0)),
            uMouse: new THREE.Uniform(new THREE.Vector2()),
            uPrevMouse: new THREE.Uniform(new THREE.Vector2()),
            uAberrationIntensity: new THREE.Uniform(0.0),
            uTexture: new THREE.Uniform(texture),
          },
          vertexShader,
          fragmentShader,
        })
      );

      scene.add(planeMesh);

      if (glbPath) {
        const loader = new GLTFLoader();
        loader.setDRACOLoader(dracoLoader);
        loader.load(glbPath, (gltf) => {
          // Remove Coca-Cola specific 'tab' and 'can' references.
          // Directly use the scene or the first child if it's wrapped.
          const sourceModel = gltf.scene;
          glbModel = sourceModel.clone(true);
          
          const box = new THREE.Box3().setFromObject(glbModel);
          const center = new THREE.Vector3();
          box.getCenter(center);
          glbModel.position.sub(center);

          // Preserving the existing 0.35 scale as a starting point.
          // Note: Since these are different products, 0.35 might be too big for a macbook or too small for a watch.
          glbModel.scale.set(0.35, 0.35, 0.35);
          scene.add(glbModel);

        });
      }

      renderer = new THREE.WebGLRenderer({ alpha: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
      renderer.setSize(imageElement.offsetWidth, imageElement.offsetHeight);

      imageContainer.appendChild(renderer.domElement);

      // Cursor cue on the container
      imageContainer.style.cursor = "grab";

      // Drag-to-rotate on the rendered canvas (not imageContainer, so
      // setPointerCapture works on the element that receives pointer events)
      const glCanvas = renderer.domElement;

      glCanvas.addEventListener("pointerdown", (e) => {
        if (!glbModel) return;
        isDraggingGlb = true;
        dragPrev = { x: e.clientX, y: e.clientY };
        glbVelocity = { x: 0, y: 0 };
        imageContainer.style.cursor = "grabbing";
        glCanvas.setPointerCapture(e.pointerId);
        glCanvas.style.touchAction = "none";
        if (dragResumeTimer) clearTimeout(dragResumeTimer);
      });

      glCanvas.addEventListener("pointermove", (e) => {
        if (!isDraggingGlb || !glbModel) return;
        const dx = e.clientX - dragPrev.x;
        const dy = e.clientY - dragPrev.y;
        dragPrev = { x: e.clientX, y: e.clientY };

        glbVelocity.x = dy * GLB_SENSITIVITY;
        glbVelocity.y = dx * GLB_SENSITIVITY;

        glbModel.rotation.y += dx * GLB_SENSITIVITY;
        glbModel.rotation.x = THREE.MathUtils.clamp(
          glbModel.rotation.x + dy * GLB_SENSITIVITY,
          -GLB_X_CLAMP,
          GLB_X_CLAMP
        );
      });

      const endGlbDrag = (e) => {
        if (!isDraggingGlb) return;
        isDraggingGlb = false;
        imageContainer.style.cursor = "grab";
        try { glCanvas.releasePointerCapture(e.pointerId); } catch (_) {}
        dragResumeTimer = setTimeout(() => {
          glCanvas.style.touchAction = "";
          // Inertia velocity will have decayed by 1.5s — zero it to resume idle spin
          glbVelocity = { x: 0, y: 0 };
        }, 1500);
      };

      glCanvas.addEventListener("pointerup",     endGlbDrag);
      glCanvas.addEventListener("pointercancel", endGlbDrag);

      window.addEventListener("resize", () => {
        camera.aspect =
          imageElement.offsetWidth / planeWidth / imageElement.offsetHeight;
        camera.updateProjectionMatrix();

        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
        renderer.setSize(imageElement.offsetWidth, imageElement.offsetHeight);
      });
    }

    const t = new THREE.TextureLoader().load(texture);

    initializeScene(t);

    const clock = new THREE.Clock();
    let deltaTime = null;

    let mouseE = false;
    animateScene();

    function animateScene() {
      requestAnimationFrame(animateScene);

      deltaTime = clock.getDelta();

      mousePosition.x += (targetMousePosition.x - mousePosition.x) * easeFactor;
      mousePosition.y += (targetMousePosition.y - mousePosition.y) * easeFactor;

      planeMesh.material.uniforms.uMouse.value.set(
        mousePosition.x,
        1.0 - mousePosition.y
      );

      planeMesh.material.uniforms.uPrevMouse.value.set(
        prevPosition.x,
        1.0 - prevPosition.y
      );

      aberrationIntensity = Math.max(0.0, aberrationIntensity - 0.05);

      planeMesh.material.uniforms.uAberrationIntensity.value =
        aberrationIntensity;

      if (glbModel) {
        if (!isDraggingGlb) {
          // Idle auto-spin (paused during drag and for 1.5s after)
          if (Math.abs(glbVelocity.x) > 0.0001 || Math.abs(glbVelocity.y) > 0.0001) {
            // Apply inertia from last drag
            glbModel.rotation.y += glbVelocity.y;
            glbModel.rotation.x = THREE.MathUtils.clamp(
              glbModel.rotation.x + glbVelocity.x,
              -GLB_X_CLAMP,
              GLB_X_CLAMP
            );
            glbVelocity.x *= GLB_INERTIA_DECAY;
            glbVelocity.y *= GLB_INERTIA_DECAY;
          } else {
            // Resume idle spin only when inertia has fully decayed
            glbModel.rotation.y += 0.005;
          }
        }
      }

      renderer.render(scene, camera);
    }

    imageContainer.addEventListener("mousemove", handleMouseMove);
    imageContainer.addEventListener("mouseenter", handleMouseEnter);
    imageContainer.addEventListener("mouseleave", handleMouseLeave);

    function handleMouseMove(event) {
      easeFactor = 0.05;
      let rect = imageContainer.getBoundingClientRect();
      prevPosition = { ...targetMousePosition };

      targetMousePosition.x = (event.clientX - rect.left) / rect.width;
      targetMousePosition.y = (event.clientY - rect.top) / rect.height;

      aberrationIntensity = 1;
    }

    function handleMouseEnter(event) {
      mouseE = true;
      gsap.to(planeMesh.material.uniforms.uFrequency.value, {
        x: 3,
        y: 3,
        duration: 1,
      });

      easeFactor = 0.05;
      let rect = imageContainer.getBoundingClientRect();

      mousePosition.x = targetMousePosition.x =
        (event.clientX - rect.left) / rect.width;
      mousePosition.y = targetMousePosition.y =
        (event.clientY - rect.top) / rect.height;
    }

    function handleMouseLeave() {
      mouseE = false;
      gsap.to(planeMesh.material.uniforms.uFrequency.value, {
        x: 0,
        y: 0,
        duration: 1,
      });
      gsap.to(planeMesh.material.uniforms.uTime, {
        value: 0,
        duration: 1,
      });

      easeFactor = 0.05;
      targetMousePosition = { ...prevPosition };
    }
  };

  const img1 = document.querySelector(".page7-part1-right"); 
  const img2 = document.querySelector(".page7-part2-left");
  const img3 = document.querySelector(".page7-part2-right-ig");


 img1.addEventListener(
    "mouseenter",
    webGLEffect(
      ".page7-part1-right",
      ".page7-part1-right>img",
      "/imgs/job22.jpg",
      1
    )
  );

  img2.addEventListener(
    "mouseenter",
    webGLEffect(
      ".page7-part2-left", 
      ".page7-part2-left>img", 
      "/imgs/job11.jpg",
      1
    )
  );
  img3.addEventListener(
    "mouseenter",
    webGLEffect(
      ".page7-part2-right-ig",
      ".page7-part2-right-ig>img",
      "/imgs/job33.jpg",
      2
    )
  );
} else {
  document.querySelector(".page7-part1-right>img").style.opacity = 1;
  document.querySelector(".page7-part2-left>img").style.opacity = 1;
  document.querySelector(".page7-part2-right-ig img").style.opacity = 1;
}