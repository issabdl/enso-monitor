// Génère les PDF de docs/src/*.html avec Chromium headless (aucune fenêtre ouverte).
// Le sommaire est numéroté en deux passes : rendu, repérage des titres dans le PDF
// (pdftotext), injection des numéros de page, puis rendu final.
// Usage : node build-pdf.mjs [dossier|soutenance ...]
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const DOCS = fileURLToPath(new URL('../', import.meta.url))
const DOCUMENTS = {
  dossier: { out: 'Dossier_de_conception_ENSO_Monitor.pdf', footer: 'ENSO Monitor · Dossier de conception', maxPages: 15 },
  soutenance: { out: 'Guide_de_soutenance_ENSO_Monitor.pdf', footer: 'ENSO Monitor · Guide de soutenance' },
}

const footerTemplate = (label) => `
  <div style="width:100%; font-size:7.5pt; color:#6b7280; padding:0 16mm; display:flex; justify-content:space-between; font-family:Segoe UI, sans-serif;">
    <span>${label}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>`

const pdfOptions = (label) => ({
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: footerTemplate(label),
  margin: { top: '14mm', bottom: '16mm', left: '16mm', right: '16mm' },
})

function pageTexts(pdfPath) {
  const text = execFileSync('pdftotext', ['-enc', 'UTF-8', '-layout', pdfPath, '-'], { encoding: 'utf8' })
  return text.split('\f')
}

function countPages(pdfPath) {
  return (readFileSync(pdfPath, 'latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(DOCUMENTS)
const browser = await chromium.launch({ headless: true })

for (const name of names) {
  const doc = DOCUMENTS[name]
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(pathToFileURL(`${DOCS}src/${name}.html`).href, { waitUntil: 'load' })
  await page.waitForFunction(() => window.__diagramsReady || window.__diagramsError, null, { timeout: 30000 })
  const diagramError = await page.evaluate(() => window.__diagramsError)
  if (diagramError) throw new Error(`${name} : erreur Mermaid : ${diagramError}`)

  const out = `${DOCS}${doc.out}`
  const options = pdfOptions(doc.footer)
  writeFileSync(out, await page.pdf(options))

  // Passe 2 : numéros de page du sommaire.
  const entries = await page.$$eval('[data-toc]', (els) => els.map((el) => el.dataset.toc))
  if (entries.length) {
    const texts = pageTexts(out)
    const numbers = {}
    for (const title of entries) {
      // On ignore la page du sommaire elle-même (le titre y figure aussi).
      const index = texts.findIndex((t, i) => i > 1 && t.split('\n').some((line) => line.trim().startsWith(title)))
      numbers[title] = index >= 0 ? String(index + 1) : '?'
    }
    await page.$$eval('[data-toc]', (els, nums) => els.forEach((el) => (el.textContent = nums[el.dataset.toc])), numbers)
    writeFileSync(out, await page.pdf(options))
    console.log(`${name} : sommaire`, numbers)
  }

  const pages = countPages(out)
  const limit = doc.maxPages ? ` (limite ${doc.maxPages})` : ''
  console.log(`${name} : ${pages} pages${limit} -> ${doc.out}${errors.length ? `\n  erreurs : ${errors.join(' | ')}` : ''}`)
  if (doc.maxPages && pages > doc.maxPages) process.exitCode = 1
  await page.close()
}

await browser.close()
