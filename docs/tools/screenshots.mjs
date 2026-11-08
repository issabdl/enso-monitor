// Captures d'écran de l'application (navigateur headless, aucune fenêtre ouverte).
// Prérequis : pile Docker démarrée (http://localhost:8080).
// Usage : node screenshots.mjs [url]
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const url = process.argv[2] ?? 'http://localhost:8080'
const out = fileURLToPath(new URL('../assets/screenshots/', import.meta.url))
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ headless: true })
const errors = []

async function shoot(name, viewport, action) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2, locale: 'fr-FR' })
  page.on('console', (msg) => msg.type() === 'error' && errors.push(`${name}: ${msg.text()}`))
  page.on('pageerror', (err) => errors.push(`${name}: ${err.message}`))
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.getByTestId('stat-count').waitFor()
  if (action) await action(page)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${out}${name}.png`, fullPage: true })
  await page.close()
}

await shoot('desktop-full', { width: 1280, height: 900 })
await shoot('desktop-1997', { width: 1280, height: 900 }, async (page) => {
  await page.getByRole('button', { name: '1997-1998' }).click()
  await page.waitForLoadState('networkidle')
})
await shoot('mobile', { width: 390, height: 844 })
await shoot('error-state', { width: 1280, height: 600 }, async (page) => {
  await page.route('**/api/v1/indices/ONI/observations**', (route) => route.fulfill({ status: 500, body: '{"detail":"Erreur interne simulée"}' }))
  await page.getByRole('button', { name: 'Depuis 2000' }).click()
  await page.getByRole('alert').waitFor()
})

await browser.close()
console.log(errors.length ? `Erreurs console :\n${errors.join('\n')}` : 'Aucune erreur console')
