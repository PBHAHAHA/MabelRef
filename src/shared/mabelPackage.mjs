/**
 * [INPUT]: 依赖 Node Buffer 与 .mabel 项目快照对象
 * [OUTPUT]: 对外提供 .mabel zip 包编码、解码和格式识别能力，图片资源以 assets/ 二进制 entry 存储
 * [POS]: shared 的 .mabel 包格式模块，被 main 进程和测试消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { Buffer } from 'node:buffer'
import { open, rename, rm, stat } from 'node:fs/promises'
import { validateMabelProject } from './mabelProject.mjs'

const ZIP_LOCAL_FILE_HEADER = 0x04034b50
const ZIP_CENTRAL_DIRECTORY = 0x02014b50
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50
const MANIFEST_PATH = 'manifest.json'

const crcTable = new Uint32Array(256)

for (let index = 0; index < crcTable.length; index += 1) {
  let value = index

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }

  crcTable[index] = value >>> 0
}

const crc32 = (bytes) => {
  let crc = 0xffffffff

  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }

  return (crc ^ 0xffffffff) >>> 0
}

const toBuffer = (value) => {
  if (!value) return Buffer.alloc(0)
  if (Buffer.isBuffer(value)) return value
  if (value instanceof Uint8Array) return Buffer.from(value)
  if (Array.isArray(value)) return Buffer.from(value)
  if (value.type === 'Buffer' && Array.isArray(value.data)) return Buffer.from(value.data)

  throw new Error('Unsupported asset bytes')
}

const getAssetBytes = (asset) => {
  if (asset.bytes) return toBuffer(asset.bytes)
  if (asset.data) return Buffer.from(asset.data, 'base64')

  return Buffer.alloc(0)
}

const sanitizeAssetName = (name) => String(name || 'asset.bin').replace(/[\\/:"*?<>|]+/g, '_')

const getAssetPath = (asset) => `assets/${asset.id}-${sanitizeAssetName(asset.name)}`

const getPackageEntries = (project) => {
  validateMabelProject(project)

  const assetEntries = project.assets.map((asset) => ({
    asset,
    path: getAssetPath(asset),
    bytes: getAssetBytes(asset)
  }))
  const manifest = {
    ...project,
    assets: assetEntries.map(({ asset, path }) => ({
      id: asset.id,
      name: asset.name,
      mime: asset.mime,
      originalPath: asset.originalPath || '',
      assetPath: path
    }))
  }

  return [
    {
      name: MANIFEST_PATH,
      data: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8')
    },
    ...assetEntries.map(({ path, bytes }) => ({ name: path, data: bytes }))
  ]
}

const createZipEntry = (name, data, offset) => {
  const nameBuffer = Buffer.from(name)
  const body = toBuffer(data)
  const checksum = crc32(body)
  const localHeader = Buffer.alloc(30)

  localHeader.writeUInt32LE(ZIP_LOCAL_FILE_HEADER, 0)
  localHeader.writeUInt16LE(20, 4)
  localHeader.writeUInt16LE(0, 6)
  localHeader.writeUInt16LE(0, 8)
  localHeader.writeUInt16LE(0, 10)
  localHeader.writeUInt16LE(0, 12)
  localHeader.writeUInt32LE(checksum, 14)
  localHeader.writeUInt32LE(body.length, 18)
  localHeader.writeUInt32LE(body.length, 22)
  localHeader.writeUInt16LE(nameBuffer.length, 26)
  localHeader.writeUInt16LE(0, 28)

  const centralHeader = Buffer.alloc(46)
  centralHeader.writeUInt32LE(ZIP_CENTRAL_DIRECTORY, 0)
  centralHeader.writeUInt16LE(20, 4)
  centralHeader.writeUInt16LE(20, 6)
  centralHeader.writeUInt16LE(0, 8)
  centralHeader.writeUInt16LE(0, 10)
  centralHeader.writeUInt16LE(0, 12)
  centralHeader.writeUInt16LE(0, 14)
  centralHeader.writeUInt32LE(checksum, 16)
  centralHeader.writeUInt32LE(body.length, 20)
  centralHeader.writeUInt32LE(body.length, 24)
  centralHeader.writeUInt16LE(nameBuffer.length, 28)
  centralHeader.writeUInt16LE(0, 30)
  centralHeader.writeUInt16LE(0, 32)
  centralHeader.writeUInt16LE(0, 34)
  centralHeader.writeUInt16LE(0, 36)
  centralHeader.writeUInt32LE(0, 38)
  centralHeader.writeUInt32LE(offset, 42)

  const local = Buffer.concat([localHeader, nameBuffer, body])
  const central = Buffer.concat([centralHeader, nameBuffer])

  return { central, local, size: local.length }
}

const findEndOfCentralDirectory = (zip) => {
  const minOffset = Math.max(0, zip.length - 65557)

  for (let offset = zip.length - 22; offset >= minOffset; offset -= 1) {
    if (zip.readUInt32LE(offset) === ZIP_END_OF_CENTRAL_DIRECTORY) return offset
  }

  throw new Error('Invalid .mabel package')
}

export function isMabelPackage(content) {
  const bytes = toBuffer(content)

  if (!hasMabelPackageHeader(bytes)) return false

  try {
    const endOffset = findEndOfCentralDirectory(bytes)
    const entryCount = bytes.readUInt16LE(endOffset + 10)
    let directoryOffset = bytes.readUInt32LE(endOffset + 16)

    for (let index = 0; index < entryCount; index += 1) {
      if (bytes.readUInt32LE(directoryOffset) !== ZIP_CENTRAL_DIRECTORY) return false

      const nameLength = bytes.readUInt16LE(directoryOffset + 28)
      const extraLength = bytes.readUInt16LE(directoryOffset + 30)
      const commentLength = bytes.readUInt16LE(directoryOffset + 32)
      const name = bytes.toString('utf8', directoryOffset + 46, directoryOffset + 46 + nameLength)

      if (name === MANIFEST_PATH) return true
      directoryOffset += 46 + nameLength + extraLength + commentLength
    }

    return false
  } catch {
    return false
  }
}

export function hasMabelPackageHeader(content) {
  const bytes = toBuffer(content)

  return bytes.length >= 4 && bytes.readUInt32LE(0) === ZIP_LOCAL_FILE_HEADER
}

const readPackageFiles = (content) => {
  const zip = toBuffer(content)
  const entries = readPackageDirectoryFromBuffer(zip)
  const files = new Map()

  for (const [name, entry] of entries) {
    const dataOffset = getEntryDataOffset(zip, entry)

    files.set(name, zip.subarray(dataOffset, dataOffset + entry.compressedSize))
  }

  return files
}

const parsePackageManifest = (files) => {
  const manifestBytes = files.get(MANIFEST_PATH)
  if (!manifestBytes) throw new Error('Missing .mabel manifest')

  return JSON.parse(manifestBytes.toString('utf8'))
}

const getEntryDataOffset = (zip, entry) => {
  const localNameLength = zip.readUInt16LE(entry.localOffset + 26)
  const localExtraLength = zip.readUInt16LE(entry.localOffset + 28)

  return entry.localOffset + 30 + localNameLength + localExtraLength
}

const readPackageDirectoryFromBuffer = (zip) => {
  const endOffset = findEndOfCentralDirectory(zip)
  const entryCount = zip.readUInt16LE(endOffset + 10)
  let directoryOffset = zip.readUInt32LE(endOffset + 16)
  const entries = new Map()

  for (let index = 0; index < entryCount; index += 1) {
    if (zip.readUInt32LE(directoryOffset) !== ZIP_CENTRAL_DIRECTORY) {
      throw new Error('Invalid .mabel package directory')
    }

    const compressedSize = zip.readUInt32LE(directoryOffset + 20)
    const nameLength = zip.readUInt16LE(directoryOffset + 28)
    const extraLength = zip.readUInt16LE(directoryOffset + 30)
    const commentLength = zip.readUInt16LE(directoryOffset + 32)
    const localOffset = zip.readUInt32LE(directoryOffset + 42)
    const name = zip.toString('utf8', directoryOffset + 46, directoryOffset + 46 + nameLength)

    entries.set(name, { compressedSize, localOffset, name })
    directoryOffset += 46 + nameLength + extraLength + commentLength
  }

  return entries
}

async function readPackageDirectoryFromFile(filePath) {
  const fileSize = (await stat(filePath)).size
  const tailLength = Math.min(fileSize, 65557)
  const handle = await open(filePath, 'r')

  try {
    const tail = Buffer.alloc(tailLength)
    await handle.read(tail, 0, tailLength, fileSize - tailLength)

    let endOffsetInTail = -1
    for (let offset = tail.length - 22; offset >= 0; offset -= 1) {
      if (tail.readUInt32LE(offset) === ZIP_END_OF_CENTRAL_DIRECTORY) {
        endOffsetInTail = offset
        break
      }
    }
    if (endOffsetInTail < 0) throw new Error('Invalid .mabel package')

    const entryCount = tail.readUInt16LE(endOffsetInTail + 10)
    const directorySize = tail.readUInt32LE(endOffsetInTail + 12)
    const directoryOffset = tail.readUInt32LE(endOffsetInTail + 16)
    const directory = Buffer.alloc(directorySize)
    await handle.read(directory, 0, directorySize, directoryOffset)

    let offset = 0
    const entries = new Map()
    for (let index = 0; index < entryCount; index += 1) {
      if (directory.readUInt32LE(offset) !== ZIP_CENTRAL_DIRECTORY) {
        throw new Error('Invalid .mabel package directory')
      }

      const compressedSize = directory.readUInt32LE(offset + 20)
      const nameLength = directory.readUInt16LE(offset + 28)
      const extraLength = directory.readUInt16LE(offset + 30)
      const commentLength = directory.readUInt16LE(offset + 32)
      const localOffset = directory.readUInt32LE(offset + 42)
      const name = directory.toString('utf8', offset + 46, offset + 46 + nameLength)

      entries.set(name, { compressedSize, localOffset, name })
      offset += 46 + nameLength + extraLength + commentLength
    }

    return entries
  } finally {
    await handle.close()
  }
}

async function readPackageEntryFromFile(filePath, entryName) {
  const entries = await readPackageDirectoryFromFile(filePath)
  const entry = entries.get(entryName)
  if (!entry) throw new Error(`Missing .mabel asset: ${entryName}`)

  const handle = await open(filePath, 'r')
  try {
    const localHeader = Buffer.alloc(30)
    await handle.read(localHeader, 0, localHeader.length, entry.localOffset)
    const localNameLength = localHeader.readUInt16LE(26)
    const localExtraLength = localHeader.readUInt16LE(28)
    const dataOffset = entry.localOffset + 30 + localNameLength + localExtraLength
    const bytes = Buffer.alloc(entry.compressedSize)

    await handle.read(bytes, 0, bytes.length, dataOffset)
    return bytes
  } finally {
    await handle.close()
  }
}

export function encodeMabelPackage(project) {
  let offset = 0
  const entries = getPackageEntries(project).map((entry) => {
    const zipEntry = createZipEntry(entry.name, entry.data, offset)
    offset += zipEntry.size
    return zipEntry
  })
  const localFiles = entries.map((entry) => entry.local)
  const centralDirectory = Buffer.concat(entries.map((entry) => entry.central))
  const end = Buffer.alloc(22)

  end.writeUInt32LE(ZIP_END_OF_CENTRAL_DIRECTORY, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralDirectory.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([...localFiles, centralDirectory, end])
}

export async function writeMabelPackage(filePath, project, onProgress = () => {}) {
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`
  let handle

  try {
    handle = await open(tempPath, 'w')
    let offset = 0
    const centralEntries = []
    const entries = getPackageEntries(project)
    const totalEntries = entries.length
    let writtenEntries = 0

    for (const entry of entries) {
      const zipEntry = createZipEntry(entry.name, entry.data, offset)
      offset += zipEntry.size
      centralEntries.push(zipEntry.central)
      await handle.write(zipEntry.local)
      writtenEntries += 1
      onProgress({
        phase: entry.name === MANIFEST_PATH ? 'manifest' : 'asset',
        entryName: entry.name,
        writtenEntries,
        totalEntries
      })
    }

    const centralDirectory = Buffer.concat(centralEntries)
    const end = Buffer.alloc(22)

    end.writeUInt32LE(ZIP_END_OF_CENTRAL_DIRECTORY, 0)
    end.writeUInt16LE(0, 4)
    end.writeUInt16LE(0, 6)
    end.writeUInt16LE(centralEntries.length, 8)
    end.writeUInt16LE(centralEntries.length, 10)
    end.writeUInt32LE(centralDirectory.length, 12)
    end.writeUInt32LE(offset, 16)
    end.writeUInt16LE(0, 20)

    onProgress({ phase: 'finalizing', writtenEntries, totalEntries })
    await handle.write(centralDirectory)
    await handle.write(end)
    await handle.close()
    handle = null
    await rename(tempPath, filePath)
    onProgress({ phase: 'done', writtenEntries, totalEntries })
  } catch (error) {
    if (handle) await handle.close()
    await rm(tempPath, { force: true })
    throw error
  }
}

export function decodeMabelPackage(content) {
  const files = readPackageFiles(content)
  const manifest = parsePackageManifest(files)
  const project = {
    ...manifest,
    assets: manifest.assets.map((asset) => {
      const bytes = files.get(asset.assetPath)
      if (!bytes) throw new Error(`Missing .mabel asset: ${asset.assetPath}`)

      return {
        id: asset.id,
        name: asset.name,
        mime: asset.mime,
        originalPath: asset.originalPath || '',
        bytes: Uint8Array.from(bytes)
      }
    })
  }

  return validateMabelProject(project)
}

export function decodeMabelPackageManifest(content) {
  const files = readPackageFiles(content)
  const manifest = parsePackageManifest(files)

  return {
    ...manifest,
    assets: manifest.assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      mime: asset.mime,
      originalPath: asset.originalPath || '',
      assetPath: asset.assetPath
    }))
  }
}

export function readMabelPackageAsset(content, assetPath) {
  const files = readPackageFiles(content)
  const bytes = files.get(assetPath)

  if (!bytes) throw new Error(`Missing .mabel asset: ${assetPath}`)
  return Uint8Array.from(bytes)
}

export async function decodeMabelPackageManifestFile(filePath) {
  const manifestBytes = await readPackageEntryFromFile(filePath, MANIFEST_PATH)
  const manifest = JSON.parse(manifestBytes.toString('utf8'))

  return {
    ...manifest,
    assets: manifest.assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      mime: asset.mime,
      originalPath: asset.originalPath || '',
      assetPath: asset.assetPath
    }))
  }
}

export async function readMabelPackageAssetFile(filePath, assetPath) {
  return Uint8Array.from(await readPackageEntryFromFile(filePath, assetPath))
}
