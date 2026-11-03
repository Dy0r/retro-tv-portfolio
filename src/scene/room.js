import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { tokenColor } from '../styles/tokens.js';

// Placeholder room shell: floor, ceiling, back wall with a window opening, left
// wall, the low TV stand and a desk lamp. Will be replaced by public/models/room.glb.

export const ROOM = { backZ: -1.2, leftX: -1.9, rightX: 2.6, height: 2.6 };
export const WINDOW = { x: -1.3, y: 1.45, width: 0.8, height: 0.85 };
export const STAND = { width: 1.2, height: 0.45, depth: 0.72, z: -0.74 };
export const LAMP_POSITION = new THREE.Vector3(-0.48, STAND.height, -0.58);
export const LAMP_BULB_OFFSET = new THREE.Vector3(0.1, 0.36, 0.08);

function surface(token, roughness) {
  return new THREE.MeshStandardMaterial({ color: tokenColor(token), roughness });
}

// Back wall as one flat shape with a rectangular hole for the window.
function backWallGeometry() {
  const { leftX, rightX, height } = ROOM;
  const shape = new THREE.Shape();
  shape.moveTo(leftX, 0);
  shape.lineTo(rightX, 0);
  shape.lineTo(rightX, height);
  shape.lineTo(leftX, height);
  shape.closePath();

  const hw = WINDOW.width / 2;
  const hh = WINDOW.height / 2;
  const hole = new THREE.Path();
  hole.moveTo(WINDOW.x - hw, WINDOW.y - hh);
  hole.lineTo(WINDOW.x - hw, WINDOW.y + hh);
  hole.lineTo(WINDOW.x + hw, WINDOW.y + hh);
  hole.lineTo(WINDOW.x + hw, WINDOW.y - hh);
  hole.closePath();
  shape.holes.push(hole);

  return new THREE.ShapeGeometry(shape);
}

function buildLamp() {
  const lamp = new THREE.Group();
  lamp.name = 'Lamp';
  const metal = new THREE.MeshStandardMaterial({ color: tokenColor('--scene-lamp-metal'), roughness: 0.35, metalness: 0.6 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.02, 24), metal);
  base.position.y = 0.01;

  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.42, 8), metal);
  arm.position.set(0.04, 0.2, 0.03);
  arm.rotation.z = -0.25;

  // Shade tilted toward the TV stand.
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.12, 24, 1, true), metal);
  shade.material = metal.clone();
  shade.material.side = THREE.DoubleSide;
  shade.position.copy(LAMP_BULB_OFFSET).add(new THREE.Vector3(0, 0.03, 0));
  shade.rotation.set(0.35, 0, -0.5);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.022, 16, 12),
    new THREE.MeshStandardMaterial({ color: tokenColor('--scene-lamp-bulb'), emissive: tokenColor('--scene-lamp-bulb'), emissiveIntensity: 3 }),
  );
  bulb.position.copy(LAMP_BULB_OFFSET);

  for (const m of [base, arm, shade]) m.castShadow = true;
  lamp.add(base, arm, shade, bulb);
  lamp.position.copy(LAMP_POSITION);
  return lamp;
}

export function buildRoom() {
  const room = new THREE.Group();
  room.name = 'Room';
  const { backZ, leftX, rightX, height } = ROOM;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), surface('--scene-floor', 0.8));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), surface('--scene-ceiling', 0.95));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = height;

  // The wall casts shadows too, so light from outside only enters through the window.
  const wallMaterial = surface('--scene-wall', 0.95);
  wallMaterial.shadowSide = THREE.DoubleSide;
  const backWall = new THREE.Mesh(backWallGeometry(), wallMaterial);
  backWall.position.z = backZ;
  backWall.castShadow = true;
  backWall.receiveShadow = true;

  const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(8, height), wallMaterial);
  sideWall.rotation.y = Math.PI / 2;
  sideWall.position.set(leftX, height / 2, backZ + 4);
  sideWall.receiveShadow = true;

  const stand = new THREE.Mesh(
    new RoundedBoxGeometry(STAND.width, STAND.height, STAND.depth, 3, 0.012),
    surface('--scene-stand', 0.7),
  );
  stand.name = 'Stand';
  stand.position.set(0, STAND.height / 2, STAND.z);
  stand.castShadow = true;
  stand.receiveShadow = true;

  room.add(floor, ceiling, backWall, sideWall, stand, buildLamp());
  room.userData.width = rightX - leftX;
  return room;
}
