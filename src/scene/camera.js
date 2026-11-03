import * as THREE from 'three';
import { DAMPING } from '../motion/eases.js';

// Camera rig: named framings ("poses") and frame-rate-independent damping toward
// the active one, so the move feels the same at 60, 120 or 144 Hz.
// The real INTRO / INSERTING moves (GSAP, named eases) come in later passes.

export function createCameraRig(camera, poses) {
  const target = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const goalPos = new THREE.Vector3();
  const goalLook = new THREE.Vector3();
  let orbit = null;

  function setPose(name, { instant = false } = {}) {
    const pose = poses[name];
    if (!pose) return;
    goalPos.copy(pose.position);
    goalLook.copy(pose.lookAt);
    if (instant) {
      camera.position.copy(goalPos);
      lookAt.copy(goalLook);
      camera.lookAt(lookAt);
    }
  }

  function update(dt) {
    if (orbit?.enabled) {
      orbit.update(dt);
      return;
    }
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

  return { setPose, update, enableDevOrbit };
}
