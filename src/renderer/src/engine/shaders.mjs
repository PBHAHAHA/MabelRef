/**
 * [INPUT]: 无运行时依赖，纯 WGSL 字符串常量
 * [OUTPUT]: 对外提供 QUAD_SHADER（实例化四边形渲染）与 MIP_SHADER（mip 链逐级降采样 blit）
 * [POS]: engine 的着色器源码库，被 webgpuRenderer 编译为渲染管线
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

// ============================================================
// 实例化四边形着色器
// 每实例 3 个 vec4: [a,b,c,d] 变换 | [tx,ty,opacity,gray] | [u0,v0,u1,v1]
// world = [a c; b d] * local(0..1) + [tx ty]，视口矩阵烘焙进 view.transform
// ============================================================
export const QUAD_SHADER = /* wgsl */ `
struct ViewUniform {
  transform: vec4f, // xy = world→clip 缩放(y 已翻转), zw = 平移
}

struct Instance {
  abcd: vec4f,
  txog: vec4f,
  uv: vec4f,
}

@group(0) @binding(0) var<uniform> view: ViewUniform;
@group(0) @binding(1) var<storage, read> instances: array<Instance>;
@group(0) @binding(2) var quadSampler: sampler;
@group(1) @binding(0) var quadTexture: texture_2d<f32>;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) opacityGray: vec2f,
}

@vertex
fn vertexMain(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VertexOut {
  var corners = array<vec2f, 6>(
    vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
    vec2f(1.0, 0.0), vec2f(1.0, 1.0), vec2f(0.0, 1.0)
  );
  let inst = instances[ii];
  let local = corners[vi];
  let world = vec2f(
    inst.abcd.x * local.x + inst.abcd.z * local.y + inst.txog.x,
    inst.abcd.y * local.x + inst.abcd.w * local.y + inst.txog.y
  );

  var out: VertexOut;
  out.position = vec4f(world * view.transform.xy + view.transform.zw, 0.0, 1.0);
  out.uv = mix(inst.uv.xy, inst.uv.zw, local);
  out.opacityGray = inst.txog.zw;
  return out;
}

@fragment
fn fragmentMain(in: VertexOut) -> @location(0) vec4f {
  var color = textureSample(quadTexture, quadSampler, in.uv);
  let luma = dot(color.rgb, vec3f(0.2126, 0.7152, 0.0722));
  color = vec4f(mix(color.rgb, vec3f(luma), in.opacityGray.y), color.a);
  return color * in.opacityGray.x;
}
`

// ============================================================
// mip 链生成着色器: 全屏三角形，用线性采样把上一级 mip 缩小一半
// ============================================================
export const MIP_SHADER = /* wgsl */ `
@group(0) @binding(0) var srcTexture: texture_2d<f32>;
@group(0) @binding(1) var srcSampler: sampler;

struct MipOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vertexMain(@builtin(vertex_index) vi: u32) -> MipOut {
  let uv = vec2f(f32((vi << 1u) & 2u), f32(vi & 2u));

  var out: MipOut;
  out.position = vec4f(uv * 2.0 - 1.0, 0.0, 1.0);
  out.uv = vec2f(uv.x, 1.0 - uv.y);
  return out;
}

@fragment
fn fragmentMain(in: MipOut) -> @location(0) vec4f {
  return textureSample(srcTexture, srcSampler, in.uv);
}
`
