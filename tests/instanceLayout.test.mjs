import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  INSTANCE_FLOATS,
  buildInstanceBuffer,
  getViewTransform,
  writeInstance
} from '../src/renderer/src/engine/instanceLayout.mjs'

const applyInstance = (data, offset, local) => ({
  x: data[offset] * local.x + data[offset + 2] * local.y + data[offset + 4],
  y: data[offset + 1] * local.x + data[offset + 3] * local.y + data[offset + 5]
})

const applyView = (transform, world) => ({
  x: world.x * transform[0] + transform[2],
  y: world.y * transform[1] + transform[3]
})

describe('engine instance layout', () => {
  it('maps the unit quad to the world rectangle without rotation', () => {
    const data = new Float32Array(INSTANCE_FLOATS)

    writeInstance(data, 0, { x: 100, y: 50, width: 200, height: 80 })

    assert.deepEqual(applyInstance(data, 0, { x: 0, y: 0 }), { x: 100, y: 50 })
    assert.deepEqual(applyInstance(data, 0, { x: 1, y: 1 }), { x: 300, y: 130 })
  })

  it('applies node scale before translation', () => {
    const data = new Float32Array(INSTANCE_FLOATS)

    writeInstance(data, 0, { x: 10, y: 10, width: 100, height: 100, scaleX: 0.5, scaleY: 2 })

    assert.deepEqual(applyInstance(data, 0, { x: 1, y: 1 }), { x: 60, y: 210 })
  })

  it('rotates the quad around its origin in degrees', () => {
    const data = new Float32Array(INSTANCE_FLOATS)

    writeInstance(data, 0, { x: 0, y: 0, width: 100, height: 50, rotation: 90 })
    const corner = applyInstance(data, 0, { x: 1, y: 0 })

    assert.ok(Math.abs(corner.x) < 1e-4)
    assert.ok(Math.abs(corner.y - 100) < 1e-4)
  })

  it('packs opacity, grayscale and uv into the instance record', () => {
    const data = new Float32Array(INSTANCE_FLOATS)

    writeInstance(data, 0, {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      opacity: 0.5,
      grayscale: 1,
      uv: [0.1, 0.2, 0.9, 0.8]
    })

    assert.equal(data[6], 0.5)
    assert.equal(data[7], 1)
    assert.deepEqual([...data.slice(8, 12)].map(Number), [
      Math.fround(0.1),
      Math.fround(0.2),
      Math.fround(0.9),
      Math.fround(0.8)
    ])
  })

  it('builds one record per node with defaults applied', () => {
    const buffer = buildInstanceBuffer([
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 20, y: 0, width: 10, height: 10 }
    ])

    assert.equal(buffer.length, 2 * INSTANCE_FLOATS)
    assert.equal(buffer[6], 1)
    assert.equal(buffer[INSTANCE_FLOATS + 4], 20)
  })

  it('view transform maps world points into clip space with flipped Y', () => {
    const transform = getViewTransform({ zoom: 1, x: 0, y: 0, width: 800, height: 600 })

    assert.deepEqual(applyView(transform, { x: 0, y: 0 }), { x: -1, y: 1 })
    assert.deepEqual(applyView(transform, { x: 800, y: 600 }), { x: 1, y: -1 })
    assert.deepEqual(applyView(transform, { x: 400, y: 300 }), { x: 0, y: 0 })
  })

  it('view transform honours zoom and pan like the canvas viewport', () => {
    const transform = getViewTransform({ zoom: 2, x: 100, y: 40, width: 800, height: 600 })
    const clip = applyView(transform, { x: 50, y: 50 })

    // world 50 → screen 50*2+100=200 → clip 200/400-1=-0.5
    assert.ok(Math.abs(clip.x - -0.5) < 1e-9)
    // world 50 → screen 50*2+40=140 → clip 1-140/300
    assert.ok(Math.abs(clip.y - (1 - 140 / 300)) < 1e-9)
  })
})
