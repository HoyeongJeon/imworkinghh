import { extname } from 'node:path'

export function filePathFromArgs(argv: string[]): string | null {
  const fileArgs = argv.slice(1).filter((arg) => !arg.startsWith('-') && extname(arg) !== '')
  return fileArgs.at(-1) ?? null
}
