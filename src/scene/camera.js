import * as THREE from 'three';
import { gsap } from 'gsap';
import { DAMPING } from '../motion/eases.js';

// Camera rig: named framings ("poses"). Two ways to get to one:
//  - setPose: frame-rate-independent damping toward it, so it feels the same at
//    60, 120 or 144 Hz;
//  - tweenTo: an authored GSAP move with a named ease and duration (INTRO etc.).

export function createCameraRig(camera, poses) {
  const target = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const goalPos = new THREE.Vector3();
  const goalLook = new THREE.Vector3();
  const fromPos = new THREE.Vector3();
  const fromLook = new THREE.Vector3();
  const tweenState = { t: 0 };
  let tween = null;
  let orbit = null;

  function stopTween() {
    tween?.kill();
    tween = null;
  }

  function setPose(name, { instant = false } = {}) {
    const pose = poses[name];
    if (!pose) return;
    stopTween();
    goalPos.copy(pose.position);
    goalLook.copy(pose.lookAt);
    if (instant) {
      camera.position.copy(goalPos);
      lookAt.copy(goalLook);
      camera.lookAt(lookAt);
    }
  }

  function applyTween() {
    camera.position.lerpVectors(fromPos, goalPos, tweenState.t);
    lookAt.lerpVectors(fromLook, goalLook, tweenState.t);
    camera.lookAt(lookAt);
  }

  // Returns the GSAP tween so it can sit inside a timeline.
  function tweenTo(name, { duration, ease }) {
    const pose = poses[name];
    stopTween();
    fromPos.copy(camera.position);
    fromLook.copy(lookAt);
    goalPos.copy(pose.position);
    goalLook.copy(pose.lookAt);
    tweenState.t = 0;
    tween = gsap.to(tweenState, {
      t: 1,
      duration,
      ease,
      onUpdate: applyTween,
      onComplete: () => (tween = null),
    });
    return tween;
  }

  function update(dt) {
    if (orbit?.enabled) {
      orbit.update(dt);
      return;
    }
    if (tween) return;
    // 1 - e^(-k·dt): the same fraction of the remaining distance per second, at any frame rate.
    const t = 1 - Math.exp(-DAMPING.camera * dt);
    camera.position.lerp(goalPos, t);
    lookAt.lerp(goalLook, t);
    camera.lookAt(lookAt);
  }

  // Dev-only: press O to orbit freely with the mouse, press O again to return.
  async function enableDevOrbit(domElement) {
    const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
    orbit = new OrbitControls(camera, domElement);
    orbit.enableDamping = true;
    orbit.enabled = false;
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'o' && e.key !== 'O') return;
      orbit.enabled = !orbit.enabled;
      if (orbit.enabled) orbit.target.copy(target.copy(lookAt));
    });
  }

  return { setPose, tweenTo, update, enableDevOrbit };
}
