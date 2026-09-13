import * as THREE from 'three';

const colors = {
  silhouette: 0x192842,
  silhouetteDeep: 0x101b31,
  steel: 0x334962,
  trim: 0x536a7d,
  window: 0xffc77d,
  windowDim: 0xc88762,
  sun: 0xf1b06f
};

const basic = (color, options = {}) => new THREE.MeshBasicMaterial({
  color,
  transparent: !!options.transparent,
  opacity: options.opacity ?? 1,
  depthWrite: options.depthWrite ?? true,
  fog: options.fog ?? true,
  toneMapped: false
});

const matrix = (x, y, z, sx, sy, sz, rz = 0) => new THREE.Matrix4().compose(
  new THREE.Vector3(x, y, z),
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rz),
  new THREE.Vector3(sx, sy, sz)
);

const instances = (root, name, geometry, material, transforms) => {
  if (!transforms.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  mesh.name = name;
  mesh.userData.background = true;
  transforms.forEach((transform, index) => mesh.setMatrixAt(index, transform));
  mesh.instanceMatrix.needsUpdate = true;
  root.add(mesh);
  return mesh;
};

export function createSkyTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#071329');
  gradient.addColorStop(.46, '#273d63');
  gradient.addColorStop(.78, '#63758f');
  gradient.addColorStop(1, '#b8785e');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const haze = context.createLinearGradient(0, canvas.height * .58, 0, canvas.height * .9);
  haze.addColorStop(0, 'rgba(165,166,177,0)');
  haze.addColorStop(.6, 'rgba(221,164,127,.12)');
  haze.addColorStop(1, 'rgba(241,178,112,.22)');
  context.fillStyle = haze;
  context.fillRect(0, canvas.height * .5, canvas.width, canvas.height * .5);
  context.fillStyle = 'rgba(218,227,240,.32)';
  for (let i = 0; i < 34; i++) {
    const x = (i * 83) % canvas.width;
    const y = 28 + ((i * 47) % 135);
    context.fillRect(x, y, i % 4 === 0 ? 2 : 1, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

const hasGround = (platforms, x) => platforms.some((platform) => Number(platform.y) === 0 && x >= Number(platform.x) && x <= Number(platform.x) + Number(platform.width));

export function createFactoryBackdrop({ length = 64, platforms = [] } = {}) {
  const root = new THREE.Group();
  root.name = 'twilight-factory-backdrop';
  root.userData.background = true;
  const cityBase = new THREE.Mesh(new THREE.BoxGeometry(length + 70, 18, 5), basic(colors.silhouetteDeep));
  cityBase.position.set(length / 2, -9.2, -13);
  cityBase.userData.background = true;
  root.add(cityBase);
  const buildings = [];
  const roofs = [];
  const towers = [];
  const chimneys = [];
  const foundations = [];
  const cranePosts = [];
  const craneArms = [];
  const catwalks = [];
  const windowTransforms = [];
  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
  const roofGeometry = new THREE.BoxGeometry(1, 1, 1);
  const towerGeometry = new THREE.CylinderGeometry(.58, .78, 1, 8);
  const chimneyGeometry = new THREE.CylinderGeometry(.13, .18, 1, 8);
  const windowGeometry = new THREE.PlaneGeometry(.28, .38);
  const bodyMaterial = basic(colors.silhouette);
  const deepMaterial = basic(colors.silhouetteDeep);
  const steelMaterial = basic(colors.steel);
  const trimMaterial = basic(colors.trim);
  const windowMaterial = basic(colors.window, { transparent: true, opacity: .88, depthWrite: false });
  const dimWindowMaterial = basic(colors.windowDim, { transparent: true, opacity: .72, depthWrite: false });

  for (let x = 3.5, index = 0; x < length + 5; x += 11.5, index++) {
    const grounded = hasGround(platforms, x);
    if (!grounded) continue;
    const form = index % 3;
    const width = 4.8 + (index % 2) * 1.2;
    const height = 5.5 + (index % 4) * 1.45;
    const depth = 1.5 + form * .28;
    const z = -10 - (form % 2) * 1.55;
    buildings.push(matrix(x, height / 2 - .28, z, width, height, depth));
    roofs.push(matrix(x, height + .04, z, width * 1.08, .16, depth * 1.12, form === 1 ? .03 : 0));
    foundations.push(matrix(x, -.6, z + .02, width + .5, 1.2, depth + .26));
    const windowRows = Math.max(2, Math.floor(height / 1.5));
    const columns = Math.max(3, Math.floor(width / 1.15));
    for (let row = 0; row < windowRows; row++) {
      for (let column = 0; column < columns; column++) {
        if ((row + column + index) % 5 === 0) continue;
        const wx = x - width * .38 + column * (width * .76 / Math.max(1, columns - 1));
        const wy = 1.05 + row * ((height - 1.55) / Math.max(1, windowRows - 1));
        windowTransforms.push(matrix(wx, wy, z + depth / 2 + .012, 1, 1, 1));
      }
    }
    const towerX = x + (form === 2 ? width * .34 : -width * .32);
    const towerHeight = height + 2.4 + (index % 2) * 1.2;
    towers.push(matrix(towerX, towerHeight / 2 - .18, z - .18, 1, towerHeight, 1));
    chimneys.push(matrix(x - width * .27, height + 1.15, z - .08, 1, 2.3 + (index % 2) * .5, 1));
    chimneys.push(matrix(x + width * .18, height + .78, z - .12, .8, 1.55, .8));
    const craneX = x - width * .52;
    const craneHeight = height * .72 + 2.4;
    cranePosts.push(matrix(craneX, craneHeight / 2 - .18, -8.75, .16, craneHeight, .16));
    cranePosts.push(matrix(craneX + width * .92, craneHeight / 2 - .18, -8.75, .12, craneHeight * .58, .12));
    craneArms.push(matrix(craneX + width * .42, craneHeight - .16, -8.75, width * .92, .14, .14, form === 1 ? -.09 : .08));
    catwalks.push(matrix(x, height * .54, -8.58, width * 1.16, .10, .13));
    catwalks.push(matrix(x, height * .54 + .34, -8.58, width * 1.16, .06, .07));
  }

  instances(root, 'factory-buildings', buildingGeometry, bodyMaterial, buildings);
  instances(root, 'factory-rooflines', roofGeometry, deepMaterial, roofs);
  instances(root, 'factory-foundations', buildingGeometry, deepMaterial, foundations);
  instances(root, 'cooling-towers', towerGeometry, steelMaterial, towers);
  instances(root, 'chimneys', chimneyGeometry, deepMaterial, chimneys);
  instances(root, 'crane-posts', buildingGeometry, trimMaterial, cranePosts);
  instances(root, 'crane-arms', buildingGeometry, trimMaterial, craneArms);
  instances(root, 'connected-catwalks', buildingGeometry, steelMaterial, catwalks);
  if (windowTransforms.length) {
    const lit = new THREE.InstancedMesh(windowGeometry, windowMaterial, windowTransforms.length);
    lit.name = 'factory-window-lights';
    lit.userData.background = true;
    windowTransforms.forEach((transform, index) => lit.setMatrixAt(index, transform));
    lit.instanceMatrix.needsUpdate = true;
    root.add(lit);
  }
  const distantWindows = windowTransforms.filter((_, index) => index % 4 === 0);
  if (distantWindows.length) {
    const dim = new THREE.InstancedMesh(windowGeometry, dimWindowMaterial, distantWindows.length);
    dim.name = 'factory-window-dim';
    dim.userData.background = true;
    distantWindows.forEach((transform, index) => dim.setMatrixAt(index, transform));
    dim.instanceMatrix.needsUpdate = true;
    root.add(dim);
  }

  const halo = new THREE.Mesh(new THREE.CircleGeometry(4.6, 40), basic(colors.sun, { transparent: true, opacity: .11, depthWrite: false, fog: false }));
  halo.name = 'sunset-halo';
  halo.position.set(length * .42, 7.2, -26);
  halo.userData.background = true;
  root.add(halo);
  const sun = new THREE.Mesh(new THREE.CircleGeometry(2.25, 32), basic(0xffc883, { transparent: true, opacity: .82, depthWrite: false, fog: false }));
  sun.name = 'sunset-disc';
  sun.position.set(length * .42, 7.2, -26.15);
  sun.userData.background = true;
  root.add(sun);
  return root;
}
