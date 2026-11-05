import * as THREE from 'three';
import { loadModel, loadingManager } from './models.js';
import { buildCartridge, CARTRIDGE_SIZE } from './placeholders.js';
import { DAMPING } from '../motion/eases.js';
import { assetUrl } from '../assetUrl.js';
import { tokenColor } from '../styles/tokens.js';

// One cartridge per project, standing in a fanned row next to the console.
// Colour and label art come from each project's file in content/projects/, never from code.
// The cartridge for the project selected on the TV lifts slightly (no glow).

const textureLoader = new THREE.TextureLoader(loadingManager);
const SPACING = 0.085;
const LIFT = 0.028; // metres the selected cartridge rises

export async function buildCartridges(projects, origin) {
  const template = await loadModel('cartridge', buildCartridge);
  const row = new THREE.Group();
  row.name = 'Cartridges';
  const bySlug = new Map();

  projects.forEach((project, i) => {
    const cart = template.clone(true);
    cart.name = `Cartridge:${project.slug}`;
    cart.userData.slug = project.slug;
    cart.userData.amount = 0; // 0 = resting, 1 = fully selected

    cart.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.userData.slug = project.slug;
      obj.material = obj.material.clone();
      if (obj.name === 'Label') {
        const map = textureLoader.load(assetUrl(project.labelImage));
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = 4;
        obj.material.map = map;
        // Slightly dimmed and fully matte, so lamp light on white label text never glows.
        obj.material.color.copy(tokenColor('--scene-label-tint'));
        obj.material.roughness = 1;
        obj.material.metalness = 0;
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

  let selected = null;
  let held = null; // the cartridge being animated in/out of the console: left alone here
  const carts = [...bySlug.values()];

  return {
    row,
    bySlug,
    // Pass a project slug, or null to rest them all (e.g. on About/Contact pages).
    setSelected(slug) {
      selected = slug;
    },
    // Hand a cartridge over to an animation (insert/eject), or pass null to take it back.
    hold(slug) {
      held = slug;
    },
    update(dt) {
      const t = 1 - Math.exp(-DAMPING.cartridge * dt);
      for (let i = 0; i < carts.length; i++) {
        const cart = carts[i];
        if (cart.userData.slug === held) continue;
        const goal = cart.userData.slug === selected ? 1 : 0;
        const a = cart.userData.amount + (goal - cart.userData.amount) * t;
        cart.userData.amount = a;
        cart.position.y = a * LIFT;
      }
    },
  };
}
