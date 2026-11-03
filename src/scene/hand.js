import * as THREE from 'three';
import { loadGltf } from './models.js';
import { tokenColor } from '../styles/tokens.js';

// The first-person hand for the "hand" insert test (?insert=hand).
// Model: public/models/hand.glb ("Hand animation test" by SantosGabriel, CC BY 4.0,
// credited in site.json). A right hand: in the model, fingers point +Y, the palm
// faces +Z and the thumb is on +X. Its own animation starts with the hand closing
// from open to a loose grip, so we scrub that bit to grip and release.
// A plain black sleeve is added at the wrist.
//
// The hand's origin is moved to the point between thumb and index fingertips when
// gripping, so placing the hand at a point means "grip right here".

const HAND_LENGTH = 0.18; // metres, wrist to middle fingertip
const MODEL_LENGTH = 209; // the same distance in model units
const SCALE = HAND_LENGTH / MODEL_LENGTH;
const GRIP_TIME = 0.5; // seconds into the model's animation where it's gripping
const GRIP_POINT = new THREE.Vector3(50, 131, 56); // between thumb and index tips, model units
const FINGER_TILT = 0.8; // radians the fingers point down from level (a claw from above)
const HAND_YAW = -0.35; // radians the fingers turn from 'left' toward 'into the room'
const WRIST = new THREE.Vector3(0, 27, 0); // wrist joint, model units
// The forearm runs from the wrist back toward the viewer's right shoulder (just
// below and right of the camera), so it reads as *your* arm. It's aimed on its own,
// which gives a natural bend at the wrist.
const ARM_DIRECTION = new THREE.Vector3(0.3, 0.15, 0.94).normalize();
const SLEEVE = { radiusWrist: 0.034, radiusElbow: 0.05, length: 1.1, overlap: 0.015 }; // metres; long enough that its far end stays out of frame

export async function createHand(scene) {
  const gltf = await loadGltf('hand');
  if (!gltf) return null;
  const model = gltf.scene;

  model.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.frustumCulled = false; // skinned: its bounds don't follow the pose
    // The texture's skin tone washes out under the warm lamp; a neutral tint
    // brings it back down without changing its hue.
    obj.material.color.copy(tokenColor('--scene-hand-tint'));
  });

  // Hand orientation: fingers point left (-X) and down, palm faces down, thumb
  // toward the camera (+Z), then turned a little into the room.
  const basis = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, 0, 1), // model X (thumb side) -> toward camera
    new THREE.Vector3(-1, 0, 0), // model Y (fingers) -> left
    new THREE.Vector3(0, -1, 0), // model Z (palm) -> down
  );
  const orient = new THREE.Group();
  orient.quaternion
    .setFromRotationMatrix(basis)
    .premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), FINGER_TILT))
    .premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), HAND_YAW));
  orient.scale.setScalar(SCALE);
  orient.position.copy(GRIP_POINT).multiplyScalar(-SCALE).applyQuaternion(orient.quaternion);
  orient.add(model);

  // Plain black sleeve from the wrist back along the forearm (sized in metres).
  const wrist = WRIST.clone().multiplyScalar(SCALE).applyQuaternion(orient.quaternion).add(orient.position);
  const sleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(SLEEVE.radiusWrist, SLEEVE.radiusElbow, SLEEVE.length, 20, 1, false),
    new THREE.MeshStandardMaterial({ color: tokenColor('--scene-sleeve'), roughness: 0.92 }),
  );
  sleeve.name = 'Sleeve';
  sleeve.castShadow = true;
  // The cylinder's axis is +Y; point it from the wrist toward the elbow.
  sleeve.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), ARM_DIRECTION);
  sleeve.position.copy(ARM_DIRECTION).multiplyScalar(SLEEVE.length / 2 - SLEEVE.overlap).add(wrist);

  const root = new THREE.Group();
  root.name = 'Hand';
  root.visible = false;
  root.add(orient, sleeve);
  scene.add(root);

  const mixer = new THREE.AnimationMixer(model);
  const action = mixer.clipAction(gltf.animations[0]);
  action.play();
  const pose = { grip: 0 };

  function applyGrip() {
    mixer.setTime(pose.grip * GRIP_TIME);
  }
  applyGrip();

  return {
    root,
    pose, // tween pose.grip 0 (open) .. 1 (gripping), with onUpdate: applyGrip
    applyGrip,
  };
}
