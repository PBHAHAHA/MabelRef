const IMAGE_URL_EXTENSION = /\.(avif|bmp|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i
const DATA_IMAGE_URL = /^data:image\/[^;,]+(?:;[^,]*)?,/i

const getTransferText = (dataTransfer, type) => {
  try {
    return dataTransfer?.getData?.(type) || ''
  } catch {
    return ''
  }
}

const isHttpUrl = (value) => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const isDataImageUrl = (value) => DATA_IMAGE_URL.test(String(value || '').trim())

export const isImageLikeUrl = (value) => {
  const text = String(value || '').trim()
  if (isDataImageUrl(text)) return true
  if (!isHttpUrl(text)) return false

  try {
    return IMAGE_URL_EXTENSION.test(new URL(text).pathname)
  } catch {
    return false
  }
}

const addUrl = (urls, value, options = {}) => {
  const text = String(value || '').trim()
  if (!text) return
  if (isDataImageUrl(text)) {
    urls.push(text)
    return
  }
  if (!isHttpUrl(text)) return
  if (options.allowAnyHttp || isImageLikeUrl(text)) urls.push(text)
}

const parseSrcset = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim().split(/\s+/)[0])
    .filter(Boolean)

const getHtmlImageUrls = (html) => {
  const urls = []
  const text = String(html || '')
  if (!text) return urls

  if (typeof DOMParser !== 'undefined') {
    const document = new DOMParser().parseFromString(text, 'text/html')
    document.querySelectorAll('img[src], source[src]').forEach((element) => {
      addUrl(urls, element.getAttribute('src'), { allowAnyHttp: true })
    })
    document.querySelectorAll('img[srcset], source[srcset]').forEach((element) => {
      parseSrcset(element.getAttribute('srcset')).forEach((url) =>
        addUrl(urls, url, { allowAnyHttp: true })
      )
    })
    return urls
  }

  for (const match of text.matchAll(/\s(?:src|href)=["']([^"']+)["']/gi)) {
    addUrl(urls, match[1], { allowAnyHttp: true })
  }
  for (const match of text.matchAll(/\ssrcset=["']([^"']+)["']/gi)) {
    parseSrcset(match[1]).forEach((url) => addUrl(urls, url, { allowAnyHttp: true }))
  }

  return urls
}

const getUriListUrls = (text) =>
  String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))

export const getDroppedImageUrls = (dataTransfer) => {
  const urls = []

  getHtmlImageUrls(getTransferText(dataTransfer, 'text/html')).forEach((url) =>
    addUrl(urls, url, { allowAnyHttp: true })
  )
  getUriListUrls(getTransferText(dataTransfer, 'text/uri-list')).forEach((url) =>
    addUrl(urls, url, { allowAnyHttp: true })
  )

  const mozUrl = getTransferText(dataTransfer, 'text/x-moz-url').split(/\r?\n/)[0]
  addUrl(urls, mozUrl, { allowAnyHttp: true })

  addUrl(urls, getTransferText(dataTransfer, 'text/plain'))

  return [...new Set(urls)]
}

export const dataUrlToFile = (dataUrl, name = 'dropped-image') => {
  const match = String(dataUrl || '').match(/^data:([^;,]+)(;base64)?,(.*)$/i)
  if (!match) return null

  const mime = match[1]
  const extension = mime.split('/')[1]?.replace('svg+xml', 'svg') || 'png'
  const body = match[3]
  const bytes = match[2]
    ? Uint8Array.from(atob(body), (char) => char.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(body))

  return new File([bytes], `${name}.${extension}`, { type: mime })
}
