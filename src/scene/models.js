import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import availableModels from 'virtual:available-models';

// One LoadingManager for every asset, so the loading screen can show real progress.
export const loadingManager = new THREE.LoadingManager();

const gltfLoader = new GLTFLoader(loadingManager).setMeshoptDecoder(MeshoptDecoder);

// Uses public/models/<name>.glb when that file exists, otherwise the placeholder.
// `availableModels` is the list of .glb files the dev server/build found on disk,
// so a missing model never triggers a failed request.
export async function loadModel(name, buildPlaceholder) {
  if (!availableModels.includes(`${name}.glb`)) return buildPlaceholder();

  const gltf = await gltfLoader.loadAsync(`/models/${name}.glb`);
  gltf.scene.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  return gltf.scene;
}
