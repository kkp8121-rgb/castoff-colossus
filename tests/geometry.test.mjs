import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPlayerModel, createBossModel, createPlatformModel, disposeModel } from '../src/models.js';

test('six physical armor plates follow articulated limbs and chassis feet match the collider', () => {
  const model = createPlayerModel(), bounds = new THREE.Box3().setFromObject(model);
  assert.ok(Math.abs(bounds.min.y) < .01); assert.ok(bounds.max.y <= 1.81 && bounds.max.y >= 1.7);
  assert.equal(model.userData.legs.length, 2);
  assert.deepEqual(Object.keys(model.userData.plateParts), ['0', '1', '2', '3', '4', '5']);
  for (const [id, plate] of Object.entries(model.userData.plateParts)) {
    assert.equal(plate.parent, plate.userData.homeParent); assert.equal(plate.userData.plateId, Number(id));
    assert.ok(plate.geometry.attributes.position.count >= 24);
  }
  assert.notEqual(model.userData.plateParts[0].parent, model.userData.plateParts[2].parent);
  disposeModel(model);
});

test('platform visible tops and grounded boss supports match their physical coordinates', () => {
  for (const y of [0, 2.2, 3.1]) {
    const model = createPlatformModel({ id: 'fixture', x: 10, width: 4, y });
    const deck = model.getObjectByName('platform-deck'), bounds = new THREE.Box3().setFromObject(deck);
    assert.ok(Math.abs(bounds.max.y - y) < 1e-6); disposeModel(model);
  }
  for (const type of ['ram', 'spindle', 'crown']) {
    const model = createBossModel(type), bounds = new THREE.Box3().setFromObject(model);
    assert.ok(Math.abs(bounds.min.y) < .05, `${type} feet ${bounds.min.y}`);
    assert.ok(bounds.max.y > 1.5 && bounds.max.y < 4);
    model.traverse(part => { if (part.isMesh) { const coordinates = part.geometry.attributes.position.array; assert.ok(coordinates.every(Number.isFinite)); } });
    disposeModel(model);
  }
});
