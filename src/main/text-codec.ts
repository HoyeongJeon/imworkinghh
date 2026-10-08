import type { SourceEncoding } from '../shared/types'

export type DecodedText = { text: string; encoding: SourceEncoding }

const UTF8_BOM = [0xef, 0xbb, 0xbf]
const UTF16LE_BOM = [0xff, 0xfe]
const UTF16BE_BOM = [0xfe, 0xff]

export function decodeText(bytes: Uint8Array): DecodedText {
  if (startsWithBytes(bytes, UTF8_BOM)) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'utf-8-bom' }
  }
  if (startsWithBytes(bytes, UTF16LE_BOM)) {
    return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'utf-16le' }
  }
  if (startsWithBytes(bytes, UTF16BE_BOM)) {
    const littleEndian = swapByteOrder(bytes.subarray(2))
    return { text: new TextDecoder('utf-16le').decode(littleEndian), encoding: 'utf-16be' }
  }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' }
  } catch {
    // 올바른 UTF-8이 아니면 한국어 Windows 메모장의 기본값이던 CP949로 본다.
    return { text: new TextDecoder('euc-kr').decode(bytes), encoding: 'cp949' }
  }
}

export function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

function startsWithBytes(bytes: Uint8Array, prefix: number[]): boolean {
  return prefix.every((byte, index) => bytes[index] === byte)
}

function swapByteOrder(bytes: Uint8Array): Uint8Array {
  const swapped = new Uint8Array(bytes.length - (bytes.length % 2))
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    swapped[i] = bytes[i + 1]
    swapped[i + 1] = bytes[i]
  }
  return swapped
}
