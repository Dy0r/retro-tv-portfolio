import * as THREE from 'three';
import { tokenColor } from '../styles/tokens.js';
import { LAMP_POSITION, LAMP_BULB_OFFSET } from './room.js';

// Warm desk lamp as the key light, cool CRT glow from the screen, and a very low
// cool fill so shadows never go fully black. The neon city light lives in
// window.js and the teal LED strips in leds.js.
export function buildLights({ screenCenter, lampTarget }) {
  const lights = new THREE.Group();
  lights.name = 'Lights';

  const bulb = LAMP_POSITION.clone().add(LAMP_BULB_OFFSET);

  // A narrower cone aimed at the console and cartridges, so it doesn't wash out the screen.
  const lamp = new THREE.SpotLight(tokenColor('--light-lamp'), 4.5, 4, 0.62, 0.65, 2);
  lamp.position.copy(bulb);
  lamp.target.position.copy(lampTarget);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(1024, 1024);
  lamp.shadow.bias = -0.0004;
  lamp.shadow.normalBias = 0.01;
  lamp.shadow.radius = 4;

  // Soft spill from the lamp onto the wall behind it.
  const lampSpill = new THREE.PointLight(tokenColor('--light-lamp'), 0.5, 1.6, 2);
  lampSpill.position.copy(bulb).add(new THREE.Vector3(-0.05, 0.05, -0.15));

  // Out in the room, in front of the screen: lights the room the way a TV's glow
  // does, without blasting the console and cartridge sitting right below it.
  const crt = new THREE.PointLight(tokenColor('--light-crt'), 1.6, 3.5, 2);
  crt.name = 'CRTGlow';
  crt.position.copy(screenCenter).add(new THREE.Vector3(0, 0.08, 0.7));

  const fill = new THREE.HemisphereLight(tokenColor('--light-fill'), tokenColor('--scene-floor'), 0.3);

  lights.add(lamp, lamp.target, lampSpill, crt, fill);
  return lights;
}
