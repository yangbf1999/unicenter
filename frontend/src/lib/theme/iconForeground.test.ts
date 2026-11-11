import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

it('does not use primary button fill directly as a Remix icon foreground', () => {
  const violations: string[] = []
  const scan = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name)

      if (entry.isDirectory()) scan(path)
      else if (/\.(tsx|jsx)$/.test(entry.name) && !entry.name.includes('.test.')) {
        const source = readFileSync(path, 'utf8')

        if (/<i\b[^>\r\n]*?\bcolor:\s*theme\.palette\.primary\.main/.test(source)) {
          violations.push(path)
        }
      }
    }
  }

  scan(resolve(process.cwd(), 'src'))
  expect(violations).toEqual([])
})
