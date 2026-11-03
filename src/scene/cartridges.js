import * as THREE from 'three';
import { loadModel, loadingManager } from './models.js';
import { buildCartridge, CARTRIDGE_SIZE } from './placeholders.js';

// One cartridge per project, standing in a fanned row next to the console.
// Colour and label art come from projects.json, never from code.

const textureLoader = new THREE.TextureLoader(loadingManager);
const SPACING = 0.085;

export async function buildCartridges(projects, origin) {
  const template = await loadModel('cartridge', buildCartridge);
  const row = new THREE.Group();
  row.name = 'Cartridges';
  const bySlug = new Map();

  projects.forEach((project, i) => {
    const cart = template.clone(true);
    cart.name = `Cartridge:${project.slug}`;
    cart.userData.slug = project.slug;

    cart.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.material = obj.material.clone();
      if (obj.name === 'Label') {
        const map = textureLoader.load(project.labelImage);
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = 4;
        obj.material.map = map;
        obj.material.color.set(0xffffff);
      } else {
        obj.material.color.set(project.cartridgeColor);
      }
    });

    // Upright, label toward the camera, each one slightly behind the last so they fan out.
    cart.position.set(i * SPACING, 0, -i * (CARTRIDGE_SIZE.depth * 0.6));
    cart.rotation.y = -0.18;
    row.add(cart);
    bySlug.set(project.slug, cart);
  });

  row.position.copy(origin);
  return { row, bySlug };
}
