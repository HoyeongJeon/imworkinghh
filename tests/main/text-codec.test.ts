import { describe, expect, it } from 'vitest'
import { decodeText, encodeUtf8 } from '../../src/main/text-codec'

describe('파일 인코딩 감지', () => {
  it('일반 UTF-8 파일을 그대로 읽는다', () => {
    const bytes = new TextEncoder().encode('# 회의록')
    expect(decodeText(bytes)).toEqual({ text: '# 회의록', encoding: 'utf-8' })
  })

  it('BOM이 붙은 UTF-8 파일은 BOM을 빼고 읽는다', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('메모')])
    expect(decodeText(bytes)).toEqual({ text: '메모', encoding: 'utf-8-bom' })
  })

  it('UTF-16 LE 파일을 읽는다', () => {
    const bytes = new Uint8Array(Buffer.from('﻿가나', 'utf16le'))
    expect(decodeText(bytes)).toEqual({ text: '가나', encoding: 'utf-16le' })
  })

  it('UTF-16 BE 파일을 읽는다', () => {
    const bytes = new Uint8Array(Buffer.from('﻿가나', 'utf16le').swap16())
    expect(decodeText(bytes)).toEqual({ text: '가나', encoding: 'utf-16be' })
  })

  it('옛날 메모장의 CP949 한글 파일도 깨지지 않고 읽는다', () => {
    const bytes = new Uint8Array([0xc7, 0xd1, 0xb1, 0xdb])
    expect(decodeText(bytes)).toEqual({ text: '한글', encoding: 'cp949' })
  })

  it('빈 파일은 빈 UTF-8 문서로 읽는다', () => {
    expect(decodeText(new Uint8Array())).toEqual({ text: '', encoding: 'utf-8' })
  })
})

describe('UTF-8 저장 변환', () => {
  it('저장할 글은 BOM 없는 UTF-8 바이트로 바꾼다', () => {
    expect(Array.from(encodeUtf8('한'))).toEqual([0xed, 0x95, 0x9c])
  })
})
