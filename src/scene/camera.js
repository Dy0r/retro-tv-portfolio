import * as THREE from 'three';
import { gsap } from 'gsap';
import { DAMPING } from '../motion/eases.js';

// Camera rig: named framings ("poses"). Two ways to get to one:
//  - setPose: frame-rate-independent damping toward it, so it feels the same at
//    60, 120 or 144 Hz;
//  - tweenTo: an authored GSAP move with a named ease and duration (INTRO etc.).
//
// Phones held upright: a pose can name the `width` (metres) that must stay in view.
// On narrow screens the lens widens a little (fovForAspect) and, if that still isn't
// enough, the camera steps back along its line of sight until that width fits.
// `narrowShift` (optional) slides the whole shot sideways/up on narrow screens, to
// centre on what matters most there. Wide screens are untouched.

const BASE_FOV = 35;
const PORTRAIT_EXTRA_FOV = 30; // added in proportion to how tall the screen is
const DEG = Math.PI / 180;

export function fovForAspect(aspect) {
  return aspect >= 1 ? BASE_FOV : BASE_FOV + (1 - aspect) * PORTRAIT_EXTRA_FOV;
}

export function createCameraRig(camera, poses) {
  const target = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const goalPos = new THREE.Vector3();
  const goalLook = new THREE.Vector3();
  const fromPos = new THREE.Vector3();
  const fromLook = new THREE.Vector3();
  const tweenState = { t: 0 };
  const offset = new THREE.Vector3();
  let tween = null;
  let orbit = null;
  let current = null;

  // Where the camera stands and looks for a pose on this screen (see above).
  function frame(pose, outPos, outLook) {
    outPos.copy(pose.position);
    outLook.copy(pose.lookAt);
    if (camera.aspect < 1 && pose.narrowShift) {
      outPos.add(pose.narrowShift);
      outLook.add(pose.narrowShift);
    }
    if (!pose.width) return;
    const halfH = Math.atan(Math.tan((camera.fov * DEG) / 2) * camera.aspect);
    offset.subVectors(outPos, outLook);
    const distance = offset.length();
    const needed = pose.width / 2 / Math.tan(halfH);
    if (needed > distance) outPos.copy(outLook).addScaledVector(offset, needed / distance);
  }

  function stopTween() {
    tween?.kill();
    tween = null;
  }

  function setPose(name, { instant = false } = {}) {
    const pose = poses[name];
    if (!pose) return;
    stopTween();
    current = name;
    frame(pose, goalPos, goalLook);
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
    current = name;
    fromPos.copy(camera.position);
    fromLook.copy(lookAt);
    frame(pose, goalPos, goalLook);
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

  // After a resize: re-frame the current pose for the new screen shape.
  function refit() {
    if (!current || tween) return;
    frame(poses[current], goalPos, goalLook);
    camera.position.copy(goalPos);
    lookAt.copy(goalLook);
    camera.lookAt(lookAt);
  }

  return { setPose, tweenTo, update, refit, enableDevOrbit };
}
