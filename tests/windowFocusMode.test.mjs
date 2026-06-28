import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applyCanvasFocusMode } from '../src/main/windowFocusMode.mjs'

describe('canvas focus window mode', () => {
  it('raises the window above other apps when enabled', () => {
    const calls = []
    const window = {
      setAlwaysOnTop(enabled, level) {
        calls.push(['alwaysOnTop', enabled, level])
      },
      setVisibleOnAllWorkspaces(enabled) {
        calls.push(['visibleOnAllWorkspaces', enabled])
      }
    }

    applyCanvasFocusMode(window, true)

    assert.deepEqual(calls, [
      ['alwaysOnTop', true, 'screen-saver'],
      ['visibleOnAllWorkspaces', true]
    ])
  })

  it('restores the window level when disabled', () => {
    const calls = []
    const window = {
      setAlwaysOnTop(enabled, level) {
        calls.push(['alwaysOnTop', enabled, level])
      },
      setVisibleOnAllWorkspaces(enabled) {
        calls.push(['visibleOnAllWorkspaces', enabled])
      }
    }

    applyCanvasFocusMode(window, false)

    assert.deepEqual(calls, [
      ['alwaysOnTop', false, 'normal'],
      ['visibleOnAllWorkspaces', false]
    ])
  })
})
