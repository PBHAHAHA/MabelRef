/**
 * [INPUT]: 依赖 sceneStore 状态库、hitTesting/editorTransforms 纯函数、canvas/viewportZoom 的锚点缩放，以及 DOM Pointer/Wheel/Keyboard 事件
 * [OUTPUT]: 对外提供 createEditorController——把指针交互翻译为选择/框选/拖拽/角点等比缩放/删除/锚点缩放/中键平移，自身不含几何计算
 * [POS]: engine/editor 的交互状态机（唯一 DOM 胶水层），所有数学委托纯函数，视口经 getView/setView 回调外置
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { getIdsInRect, getTopmostHit, normalizeRect } from './hitTesting.mjs'
import {
  getHandleAt,
  getHandleCursor,
  getRotationAngleDelta,
  ROTATION_HANDLE_DISTANCE_PX,
  getSelectionBounds,
  moveNodePatch,
  resizeNodePatch,
  rotateNodePatch
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
  let isSpacePressed = false

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

  const getHandleAtEvent = (event) => {
    const bounds = getSelectionBounds(store.getSelectedNodes())
    if (!bounds) return null

    const view = getView()

    return getHandleAt(
      bounds,
      toWorld(event),
      HANDLE_RADIUS_PX / view.zoom,
      ROTATION_HANDLE_DISTANCE_PX / view.zoom
    )
  }

  const setCursor = (cursor) => {
    element.style.cursor = cursor
  }

  const updateHoverCursor = (event) => {
    if (isSpacePressed) {
      setCursor('grab')
      return
    }

    const handle = getHandleAtEvent(event)
    if (handle) {
      setCursor(getHandleCursor(handle))
      return
    }

    const hit = getTopmostHit(store.getNodes(), toWorld(event))

    setCursor(hit ? 'move' : 'default')
  }

  const handlePointerDown = (event) => {
    if (event.button === 1 || (event.button === 0 && isSpacePressed)) {
      drag = { mode: 'pan', clientX: event.clientX, clientY: event.clientY, view: getView() }
      element.setPointerCapture(event.pointerId)
      event.preventDefault()
      return
    }
    if (event.button !== 0) return

    const world = toWorld(event)
    const bounds = getSelectionBounds(store.getSelectedNodes())
    const handle = getHandleAtEvent(event)

    if (handle) {
      setCursor(handle.id === 'rotate' ? 'grabbing' : getHandleCursor(handle))
      drag =
        handle.id === 'rotate'
          ? {
              mode: 'rotate',
              handle,
              start: world,
              snapshot: snapshotSelected()
            }
          : { mode: 'resize', bounds, handle, snapshot: snapshotSelected() }
    } else {
      const hit = getTopmostHit(store.getNodes(), world)

      if (hit) {
        if (event.shiftKey) store.toggleSelection(hit.id)
        else if (!store.isSelected(hit.id)) store.setSelection([hit.id])
        drag = { mode: 'move', start: world, snapshot: snapshotSelected() }
        setCursor('move')
      } else {
        drag = { mode: 'marquee', start: world, additive: event.shiftKey }
        setCursor('crosshair')
      }
    }

    drag.startClientX = event.clientX
    drag.startClientY = event.clientY
    element.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event) => {
    if (!drag) {
      updateHoverCursor(event)
      return
    }

    if (drag.mode === 'pan') {
      const view = drag.view

      setView({
        zoom: view.zoom,
        x: view.x + event.clientX - drag.clientX,
        y: view.y + event.clientY - drag.clientY
      })
      setCursor('grabbing')
      return
    }

    const world = toWorld(event)

    if (drag.mode === 'marquee') {
      marquee = normalizeRect(drag.start, world)
      notifyOverlay()
      setCursor('crosshair')
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
      setCursor('move')
    }
    if (drag.mode === 'resize') {
      drag.snapshot.forEach((node, id) =>
        patches.set(id, resizeNodePatch(node, drag.bounds, drag.handle, world))
      )
      setCursor(getHandleCursor(drag.handle))
    }
    if (drag.mode === 'rotate') {
      const delta = getRotationAngleDelta({
        center: drag.handle.center,
        start: drag.start,
        point: world
      })

      drag.snapshot.forEach((node, id) =>
        patches.set(id, rotateNodePatch(node, delta, drag.handle.center))
      )
      setCursor('grabbing')
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
    updateHoverCursor(event)
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
    if (event.code === 'Space' && !event.repeat) {
      isSpacePressed = true
      setCursor('grab')
      event.preventDefault()
      return
    }

    if (bindKeyboard && (event.key === 'Delete' || event.key === 'Backspace')) {
      onHistoryPoint?.()
      store.removeSelected()
    }
  }

  const handleKeyUp = (event) => {
    if (event.code === 'Space') {
      isSpacePressed = false
      setCursor('default')
      event.preventDefault()
    }
  }

  const handleBlur = () => {
    isSpacePressed = false
    setCursor('default')
  }

  element.addEventListener('pointerdown', handlePointerDown)
  element.addEventListener('pointermove', handlePointerMove)
  element.addEventListener('pointerup', handlePointerUp)
  element.addEventListener('pointercancel', handlePointerUp)
  if (bindWheel) element.addEventListener('wheel', handleWheel, { passive: false })
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('blur', handleBlur)

  return {
    getMarquee: () => marquee,

    destroy() {
      element.removeEventListener('pointerdown', handlePointerDown)
      element.removeEventListener('pointermove', handlePointerMove)
      element.removeEventListener('pointerup', handlePointerUp)
      element.removeEventListener('pointercancel', handlePointerUp)
      if (bindWheel) element.removeEventListener('wheel', handleWheel)
      setCursor('default')
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }
}
