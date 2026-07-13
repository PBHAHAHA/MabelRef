/**
 * [INPUT]: 依赖 sceneStore 状态库、hitTesting/editorTransforms 纯函数、canvas/viewportZoom 的锚点缩放，以及 DOM Pointer/Wheel/Keyboard 事件
 * [OUTPUT]: 对外提供 createEditorController——把指针交互翻译为选择/框选/拖拽/角点等比缩放/删除/锚点缩放/中键平移，自身不含几何计算
 * [POS]: engine/editor 的交互状态机（唯一 DOM 胶水层），所有数学委托纯函数，视口经 getView/setView 回调外置
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { getIdsInRect, getTopmostHit, normalizeRect } from './hitTesting.mjs'
import {
  getHandleAt,
  getSelectionBounds,
  getUniformScale,
  moveNodePatch,
  scaleNodePatch
} from './editorTransforms.mjs'
import { getAnchoredZoomView, getWheelZoomFactor } from '../../canvas/viewportZoom.mjs'

const HANDLE_RADIUS_PX = 10
const CLICK_DISTANCE_PX = 4

export function createEditorController({
  element,
  store,
  getView,
  setView,
  onOverlayChange,
  onHistoryPoint,
  bindWheel = true,
  bindKeyboard = true
}) {
  let drag = null
  let marquee = null

  const notifyOverlay = () => onOverlayChange?.()

  const toWorld = (event) => {
    const rect = element.getBoundingClientRect()
    const view = getView()

    return {
      x: (event.clientX - rect.left - view.x) / view.zoom,
      y: (event.clientY - rect.top - view.y) / view.zoom
    }
  }

  const snapshotSelected = () =>
    new Map(store.getSelectedNodes().map((node) => [node.id, { ...node }]))

  const handlePointerDown = (event) => {
    if (event.button === 1) {
      drag = { mode: 'pan', clientX: event.clientX, clientY: event.clientY, view: getView() }
      element.setPointerCapture(event.pointerId)
      event.preventDefault()
      return
    }
    if (event.button !== 0) return

    const world = toWorld(event)
    const view = getView()
    const bounds = getSelectionBounds(store.getSelectedNodes())
    const handle = bounds && getHandleAt(bounds, world, HANDLE_RADIUS_PX / view.zoom)

    if (handle) {
      drag = { mode: 'scale', handle, snapshot: snapshotSelected() }
    } else {
      const hit = getTopmostHit(store.getNodes(), world)

      if (hit) {
        if (event.shiftKey) store.toggleSelection(hit.id)
        else if (!store.isSelected(hit.id)) store.setSelection([hit.id])
        drag = { mode: 'move', start: world, snapshot: snapshotSelected() }
      } else {
        drag = { mode: 'marquee', start: world, additive: event.shiftKey }
      }
    }

    drag.startClientX = event.clientX
    drag.startClientY = event.clientY
    element.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event) => {
    if (!drag) return

    if (drag.mode === 'pan') {
      const view = drag.view

      setView({
        zoom: view.zoom,
        x: view.x + event.clientX - drag.clientX,
        y: view.y + event.clientY - drag.clientY
      })
      return
    }

    const world = toWorld(event)

    if (drag.mode === 'marquee') {
      marquee = normalizeRect(drag.start, world)
      notifyOverlay()
      return
    }

    // 首次真实位移才记历史点: 纯点击选中不产生历史噪音
    if (!drag.historyTaken) {
      drag.historyTaken = true
      onHistoryPoint?.()
    }

    const patches = new Map()

    if (drag.mode === 'move') {
      const delta = { x: world.x - drag.start.x, y: world.y - drag.start.y }

      drag.snapshot.forEach((node, id) => patches.set(id, moveNodePatch(node, delta)))
    }
    if (drag.mode === 'scale') {
      const scale = getUniformScale({ handle: drag.handle, point: world })

      drag.snapshot.forEach((node, id) =>
        patches.set(id, scaleNodePatch(node, drag.handle.anchor, scale))
      )
    }

    store.applyPatches(patches)
  }

  const handlePointerUp = (event) => {
    if (!drag) return

    const clickDistance = Math.hypot(
      event.clientX - (drag.startClientX ?? event.clientX),
      event.clientY - (drag.startClientY ?? event.clientY)
    )

    if (drag.mode === 'marquee') {
      if (clickDistance <= CLICK_DISTANCE_PX) {
        if (!drag.additive) store.setSelection([])
      } else {
        const ids = getIdsInRect(store.getNodes(), marquee)

        store.setSelection(drag.additive ? [...store.getSelectedIds(), ...ids] : ids)
      }
      marquee = null
      notifyOverlay()
    }

    drag = null
  }

  const handleWheel = (event) => {
    event.preventDefault()

    const rect = element.getBoundingClientRect()
    const view = getView()
    const next = getAnchoredZoomView({
      anchor: { x: event.clientX - rect.left, y: event.clientY - rect.top },
      currentPosition: { x: view.x, y: view.y },
      currentZoom: view.zoom,
      nextZoom: view.zoom * getWheelZoomFactor(event.deltaY)
    })

    setView({ zoom: next.nextZoom, x: next.position.x, y: next.position.y })
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      onHistoryPoint?.()
      store.removeSelected()
    }
  }

  element.addEventListener('pointerdown', handlePointerDown)
  element.addEventListener('pointermove', handlePointerMove)
  element.addEventListener('pointerup', handlePointerUp)
  element.addEventListener('pointercancel', handlePointerUp)
  if (bindWheel) element.addEventListener('wheel', handleWheel, { passive: false })
  if (bindKeyboard) window.addEventListener('keydown', handleKeyDown)

  return {
    getMarquee: () => marquee,

    destroy() {
      element.removeEventListener('pointerdown', handlePointerDown)
      element.removeEventListener('pointermove', handlePointerMove)
      element.removeEventListener('pointerup', handlePointerUp)
      element.removeEventListener('pointercancel', handlePointerUp)
      if (bindWheel) element.removeEventListener('wheel', handleWheel)
      if (bindKeyboard) window.removeEventListener('keydown', handleKeyDown)
    }
  }
}
