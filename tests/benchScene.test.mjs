import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createBenchSpecs,
  getBenchBounds,
  getBenchView,
  layoutBenchNodes
} from '../src/renderer/src/bench/benchScene.mjs'

describe('bench scene', () => {
  it('creates deterministic specs for the same seed', () => {
    const first = createBenchSpecs({ count: 20, seed: 42 })
    const second = createBenchSpecs({ count: 20, seed: 42 })

    assert.deepEqual(first, second)
    assert.equal(first.length, 20)
  })

  it('keeps spec edges within the configured range', () => {
    const specs = createBenchSpecs({ count: 50, minEdge: 512, maxEdge: 1024 })

    for (const spec of specs) {
      assert.ok(spec.width >= 512 && spec.width <= 1024)
      assert.ok(spec.height >= 512 && spec.height <= 1024)
    }
  })

  it('lays nodes out without overlap', () => {
    const specs = createBenchSpecs({ count: 40 })
    const nodes = layoutBenchNodes(specs, { gap: 10 })

    for (let a = 0; a < nodes.length; a += 1) {
      for (let b = a + 1; b < nodes.length; b += 1) {
        const overlaps =
          nodes[a].x < nodes[b].x + nodes[b].width &&
          nodes[a].x + nodes[a].width > nodes[b].x &&
          nodes[a].y < nodes[b].y + nodes[b].height &&
          nodes[a].y + nodes[a].height > nodes[b].y

        assert.equal(overlaps, false)
      }
    }
  })

  it('oscillates the zoom around the fitted view', () => {
    const nodes = layoutBenchNodes(createBenchSpecs({ count: 30 }))
    const bounds = getBenchBounds(nodes)
    const viewport = { width: 1280, height: 800 }
    const zooms = [0, 2000, 4000, 6000].map(
      (elapsedMs) => getBenchView({ elapsedMs, bounds, viewport, zoomPeriodMs: 8000 }).zoom
    )

    assert.ok(zooms[1] > zooms[0]) // 上升沿
    assert.ok(zooms[3] < zooms[2]) // 下降沿
    assert.ok(Math.max(...zooms) / Math.min(...zooms) > 4) // 大范围振荡
  })

  it('keeps the drifting content center inside the viewport mapping', () => {
    const nodes = layoutBenchNodes(createBenchSpecs({ count: 10 }))
    const bounds = getBenchBounds(nodes)
    const viewport = { width: 1000, height: 700 }
    const view = getBenchView({ elapsedMs: 0, bounds, viewport })
    const centerScreenX = (bounds.x + bounds.width / 2) * view.zoom + view.x

    assert.ok(Math.abs(centerScreenX - viewport.width / 2) < viewport.width / 2)
  })
})
