/* One-time, idempotent AST migration. Leaves calculations and legacy sx intact.
 * --write applies the reviewed style hooks; default prints a dry-run inventory.
 */
const ts = require('typescript')
const fs = require('node:fs')
const path = require('node:path')
const write = process.argv.includes('--write')
const root = path.resolve(__dirname, '../src')
const changed = []
const explicitLinear = {
  'app/(dashboard)/infrastructure/inventory/tabs/NodeTabs.tsx': [
    "pct >= 90 ? 'error.main' : pct >= 70 ? 'warning.main' : 'success.main'",
    "'var(--nebula-brand-violet)'", "'var(--nebula-brand-violet)'",
  ],
  'app/(dashboard)/infrastructure/inventory/tabs/ClusterTabs.tsx': [
    "label === 'CPU' ? 'var(--nebula-brand-blue)' : 'var(--nebula-brand-cyan)'",
  ],
  'app/(dashboard)/infrastructure/inventory/InventoryTree.tsx': [
    "label === 'CPU' ? 'var(--nebula-brand-blue)' : 'var(--nebula-brand-cyan)'",
  ],
}
function prop(obj, name) {
  return obj && ts.isObjectLiteralExpression(obj)
    ? obj.properties.find(p => (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && p.name.getText().replace(/^['"]|['"]$/g, '') === name)
    : undefined
}
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? files(path.join(dir, e.name))
      : /\.(tsx|jsx)$/.test(e.name) && !/\.(test|spec)\./.test(e.name) ? [path.join(dir, e.name)] : [])
}
for (const file of files(root)) {
  const rel = path.relative(root, file).replaceAll('\\', '/')
  if (rel.includes('/illustrations/')) continue
  const source = fs.readFileSync(file, 'utf8')
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const edits = []
  let imports = false, linearIndex = 0
  const add = (pos, text) => edits.push({ pos, end: pos, text })
  const attr = (n, key) => n.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.text === key)
  const expr = a => a?.initializer && ts.isJsxExpression(a.initializer) ? a.initializer.expression : undefined
  const raw = a => expr(a)?.getText(ast) || a?.initializer?.getText(ast)
  const hook = (n, name) => {
    if (!edits.some(e => e.pos === n.tagName.end && e.text.includes('className='))) add(n.tagName.end, ` className="${name}"`)
  }
  function visit(n) {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const tag = n.tagName.getText(ast)
      const ix = tag === 'LinearProgress' ? linearIndex++ : -1
      const sx = expr(attr(n, 'sx'))
      const hasClass = Boolean(attr(n, 'className'))
      if (tag === 'LinearProgress' && !hasClass && sx && ts.isObjectLiteralExpression(sx)) {
        const bar = prop(sx, '& .MuiLinearProgress-bar')?.initializer
        let color = prop(bar, 'bgcolor')?.initializer?.getText(ast)
          || prop(bar, 'backgroundColor')?.initializer?.getText(ast)
        color = explicitLinear[rel]?.[ix] || color
        const value = raw(attr(n, 'value')) || ''
        // Resource-series identities from data fields, not translated labels.
        const metric = !rel.includes('OverprovisioningCard') && (
          /cpu/i.test(value) ? 'cpu' : /mem|ram/i.test(value) ? 'memory' : undefined)
        if (metric && color) color = `nebulaMetricColor(${color}, '${metric}')`
        else if (color) color = `nebulaMetricColor(${color})`
        if (color) {
          hook(n, 'nebula-linear-progress')
          add(sx.getStart(ast) + 1, ` '--nebula-progress-color': ${color},`)
          imports = true
        }
      }
      if (tag === 'CircularProgress' && !hasClass && raw(attr(n, 'variant')) === '"determinate"') {
        if (raw(attr(n, 'value')) === '100') hook(n, 'nebula-quota-track')
        else if (sx && ts.isObjectLiteralExpression(sx)) {
          const colorProp = prop(sx, 'color')
          if (colorProp) {
            hook(n, 'nebula-auto-ring')
            const value = raw(attr(n, 'value')) || ''
            const metric = rel.includes('OverprovisioningCard') ? undefined
              : /cpuPercent/.test(value) ? 'cpu' : /memPercent/.test(value) ? 'memory'
                : /storagePercent|clusterCephData/.test(value) ? 'storage' : undefined
            add(sx.getStart(ast) + 1, ` '--nebula-gauge-color': nebulaMetricColor(${colorProp.initializer?.getText(ast) || colorProp.name.getText(ast)}${metric ? `, '${metric}'` : ''}),`)
            imports = true
          }
        }
      }
      if (tag === 'Box' && !hasClass && sx && ts.isObjectLiteralExpression(sx)) {
        const width = prop(sx, 'width')?.initializer?.getText(ast) || ''
        const height = prop(sx, 'height')?.initializer?.getText(ast)
        const bg = prop(sx, 'bgcolor')?.initializer?.getText(ast) || prop(sx, 'background')?.initializer?.getText(ast)
        if (width.startsWith('`') && width.includes('%') && height && bg) {
          const metric = /cpu/i.test(width) ? 'cpu' : /mem|ram/i.test(width) ? 'memory'
            : /InventoryTree|CloneVmDialog|MigrateVmDialog/.test(rel) ? 'storage' : undefined
          // A gradient expression is not itself a CSS color.
          const color = bg.includes('gradient') ? "'primary.main'" : bg
          hook(n, 'nebula-usage-fill')
          add(sx.getStart(ast) + 1, ` '--nebula-progress-color': nebulaMetricColor(${color}${metric ? `, '${metric}'` : ''}),`)
          imports = true
          const parent = n.parent
          if (ts.isJsxElement(parent) && parent.openingElement.tagName.getText(ast) === 'Box'
              && !attr(parent.openingElement, 'className')) {
            hook(parent.openingElement, 'nebula-usage-track')
          }
        }
      }
      if (tag === 'circle' && !hasClass && attr(n, 'strokeDasharray') && !rel.endsWith('/CircularGauge.jsx')) {
        const stroke = raw(attr(n, 'stroke'))
        const style = expr(attr(n, 'style'))
        if (stroke && (!style || ts.isObjectLiteralExpression(style))) {
          hook(n, 'nebula-auto-arc')
          if (style) add(style.getStart(ast) + 1, ` color: nebulaMetricColor(${stroke}),`)
          else add(n.tagName.end, ` style={{ color: nebulaMetricColor(${stroke}) }}`)
          imports = true
        }
      }
      if (tag === 'Cell' && !hasClass && !attr(n, 'style')) {
        let parent = n.parent, pie = false
        while (parent) {
          if (ts.isJsxElement(parent) && parent.openingElement.tagName.getText(ast) === 'Pie') { pie = true; break }
          parent = parent.parent
        }
        const fill = raw(attr(n, 'fill'))
        if (pie && fill && !fill.includes('--nebula-bg-hover')) {
          hook(n, 'nebula-auto-donut')
          add(n.tagName.end, ` style={{ color: nebulaMetricColor(${fill}) }}`)
          imports = true
        }
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(ast)
  if (!edits.length) continue
  if (imports && !source.includes("from '@/lib/theme/nebulaMetricColor'")) {
    const firstImport = ast.statements.find(ts.isImportDeclaration)
    add(firstImport.getStart(ast), "import { nebulaMetricColor } from '@/lib/theme/nebulaMetricColor'\n")
  }
  let result = source
  for (const e of edits.sort((a, b) => b.pos - a.pos)) result = result.slice(0, e.pos) + e.text + result.slice(e.end)
  if (write) fs.writeFileSync(file, result)
  changed.push({ file: rel, hooks: edits.length - (imports ? 1 : 0) })
}
console.log(JSON.stringify({ write, files: changed.length, changed }, null, 2))
