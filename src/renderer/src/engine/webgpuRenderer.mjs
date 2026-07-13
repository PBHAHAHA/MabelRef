/**
 * [INPUT]: 依赖 WebGPU（navigator.gpu）、shaders 的 QUAD_SHADER 与 instanceLayout 的实例内存布局
 * [OUTPUT]: 对外提供 createWebGPURenderer，含单级纹理创建、实例缓冲上传、单遍实例化帧渲染与 VRAM 估算
 * [POS]: engine 的 GPU 渲染本体，运行在 Render Worker 内，不接触 DOM 与 Vue
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { QUAD_SHADER } from './shaders.mjs'

const CLEAR_COLOR = { r: 0.078, g: 0.086, b: 0.106, a: 1 }
const TEXTURE_FORMAT = 'rgba8unorm'
export async function createWebGPURenderer(canvas) {
  const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' })
  if (!adapter) throw new Error('WebGPU adapter unavailable')

  const device = await adapter.requestDevice()
  const context = canvas.getContext('webgpu')
  const canvasFormat = navigator.gpu.getPreferredCanvasFormat()

  context.configure({ device, format: canvasFormat, alphaMode: 'opaque' })

  // ---- 采样器: 单级线性过滤，优先降低首次加载的 GPU 工作量 ----
  const quadSampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear'
  })

  // ---- 渲染管线 ----
  const frameGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} }
    ]
  })
  const textureGroupLayout = device.createBindGroupLayout({
    entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} }]
  })
  const quadModule = device.createShaderModule({ code: QUAD_SHADER })
  const quadPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [frameGroupLayout, textureGroupLayout]
    }),
    vertex: { module: quadModule, entryPoint: 'vertexMain' },
    fragment: {
      module: quadModule,
      entryPoint: 'fragmentMain',
      targets: [
        {
          format: canvasFormat,
          blend: {
            color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }
          }
        }
      ]
    },
    primitive: { topology: 'triangle-list' }
  })

  // ---- 帧级资源 ----
  const viewBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  })
  let instanceBuffer = null
  let frameBindGroup = null
  let vramBytes = 0

  const ensureInstanceBuffer = (byteLength) => {
    if (instanceBuffer && instanceBuffer.size >= byteLength) return

    instanceBuffer?.destroy()
    instanceBuffer = device.createBuffer({
      size: Math.max(byteLength, 256),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })
    frameBindGroup = device.createBindGroup({
      layout: frameGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: viewBuffer } },
        { binding: 1, resource: { buffer: instanceBuffer } },
        { binding: 2, resource: quadSampler }
      ]
    })
  }

  return {
    device,

    createImageTexture(source, width, height) {
      const texture = device.createTexture({
        size: [width, height],
        format: TEXTURE_FORMAT,
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          // Chromium uses a render pass internally for copyExternalImageToTexture.
          // This is a single-level texture; no mipmap render passes are created.
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT
      })

      device.queue.copyExternalImageToTexture({ source }, { texture, premultipliedAlpha: true }, [
        width,
        height
      ])
      vramBytes += width * height * 4

      return {
        width,
        height,
        bindGroup: device.createBindGroup({
          layout: textureGroupLayout,
          entries: [{ binding: 0, resource: texture.createView() }]
        }),
        destroy() {
          vramBytes -= width * height * 4
          texture.destroy()
        }
      }
    },

    setInstances(instanceData) {
      ensureInstanceBuffer(instanceData.byteLength)
      device.queue.writeBuffer(instanceBuffer, 0, instanceData)
    },

    render(viewTransform, drawItems) {
      device.queue.writeBuffer(viewBuffer, 0, new Float32Array(viewTransform))

      const encoder = device.createCommandEncoder()
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: CLEAR_COLOR,
            loadOp: 'clear',
            storeOp: 'store'
          }
        ]
      })

      if (frameBindGroup && drawItems.length > 0) {
        pass.setPipeline(quadPipeline)
        pass.setBindGroup(0, frameBindGroup)
        for (let index = 0; index < drawItems.length; index += 1) {
          pass.setBindGroup(1, drawItems[index].bindGroup)
          pass.draw(6, 1, 0, index)
        }
      }

      pass.end()
      device.queue.submit([encoder.finish()])
    },

    getVramBytes: () => vramBytes,

    destroy() {
      instanceBuffer?.destroy()
      viewBuffer.destroy()
      device.destroy()
    }
  }
}
