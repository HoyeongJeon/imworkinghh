import { describe, expect, it } from 'vitest'
import { describeFsError, errorCode } from '../../src/main/fs-errors'

const fsError = (code: string) => Object.assign(new Error(code), { code })

describe('파일 오류 안내', () => {
  it('권한 오류는 권한이 없다고 알려 준다', () => {
    expect(describeFsError(fsError('EACCES'))).toContain('권한이 없어')
    expect(describeFsError(fsError('EPERM'))).toContain('권한이 없어')
  })

  it('디스크가 꽉 차면 공간이 부족하다고 알려 준다', () => {
    expect(describeFsError(fsError('ENOSPC'))).toContain('디스크 공간이 부족')
  })

  it('모르는 오류는 오류 코드를 함께 보여 준다', () => {
    expect(describeFsError(fsError('EWEIRD'))).toContain('EWEIRD')
  })

  it('코드가 없는 오류는 메시지를 함께 보여 준다', () => {
    expect(describeFsError(new Error('boom'))).toContain('boom')
  })

  it('오류 코드가 있으면 꺼내고 없으면 없다고 한다', () => {
    expect(errorCode(fsError('ENOENT'))).toBe('ENOENT')
    expect(errorCode(new Error('x'))).toBeNull()
    expect(errorCode('text')).toBeNull()
  })
})
