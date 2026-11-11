import fs from 'node:fs'
import path from 'node:path'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name)

    return entry.isDirectory() ? sources(file)
      : /\.(tsx|jsx)$/.test(file) && !/\.(test|spec)\./.test(file) ? [file] : []
  })
}

describe('global metric style coverage', () => {
  it('does not leave legacy traffic-light ramps or custom determinate rings outside the shared styles', () => {
    const missing: string[] = []

    for (const file of sources(path.resolve('src'))) {
      const source = fs.readFileSync(file, 'utf8')
      const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
      const visit = (node: ts.Node) => {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
          const text = node.getText(ast)
          const tag = node.tagName.getText(ast)
          const oldRamp = /linear-gradient\(90deg, #22c55e 0%/.test(text)
          const customRing = tag === 'CircularProgress' && /variant=["']determinate/.test(text) && /sx=/.test(text)

          if ((oldRamp || customRing) && !text.includes('nebula-')) {
            missing.push(`${path.relative(process.cwd(), file)}:${ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1}`)
          }
        }
        ts.forEachChild(node, visit)
      }

      visit(ast)
    }
    expect(missing).toEqual([])
  }, 15000)
})
