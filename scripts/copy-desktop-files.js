#!/usr/bin/env node

// Copy necessary files to the Tauri release directory
// This script runs after `npm run tauri build`
//
// Robustness rules learned the hard way:
//  - copies are VERIFIED (size match) and retried; failures abort the build
//    (an interrupted/locked copy once shipped a 0-byte express and blanked
//    the whole app)
//  - node_modules is wiped first so stale partial packages can't shadow
//    working ones from up the tree
//  - the full transitive closure of runtime deps is copied so the release
//    folder runs standalone (no repo node_modules needed)

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const releaseDir = join(rootDir, 'src-tauri', 'target', 'release')
const nodeModulesSrc = join(rootDir, 'node_modules')
const nodeModulesDst = join(releaseDir, 'node_modules')

console.log('Copying desktop files to release directory...')

function copyFileVerified(src, dst, attempts = 3) {
  const size = statSync(src).size
  for (let i = 1; i <= attempts; i++) {
    try {
      copyFileSync(src, dst)
      if (statSync(dst).size === size) return
      throw new Error(`size mismatch (${statSync(dst).size} != ${size})`)
    } catch (err) {
      if (i === attempts) throw new Error(`failed to copy ${src} -> ${dst}: ${err.message}`)
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250)
    }
  }
}

function copyDir(src, dst) {
  if (!existsSync(dst)) mkdirSync(dst, { recursive: true })
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name)
    const dstPath = join(dst, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath)
    } else {
      copyFileVerified(srcPath, dstPath)
    }
  }
}

// Copy server.mjs
copyFileVerified(join(rootDir, 'server.mjs'), join(releaseDir, 'server.mjs'))
console.log('  ✓ server.mjs')

// Copy lib/ (AI transforms used by server.mjs)
copyDir(join(rootDir, 'lib'), join(releaseDir, 'lib'))
console.log('  ✓ lib/')

// Copy dist folder
if (existsSync(join(rootDir, 'dist'))) {
  copyDir(join(rootDir, 'dist'), join(releaseDir, 'dist'))
  console.log('  ✓ dist/')
} else {
  throw new Error('dist/ missing — run `npm run build` first')
}

// Copy node_modules: the full transitive closure of runtime deps.
const ROOT_PACKAGES = ['express', 'cors', 'helmet', 'compression', 'morgan', 'express-rate-limit']

function collectDeps(pkgName, seen = new Set()) {
  if (seen.has(pkgName)) return seen
  const pkgJsonPath = join(nodeModulesSrc, pkgName, 'package.json')
  if (!existsSync(pkgJsonPath)) return seen
  seen.add(pkgName)
  let pkg = {}
  try { pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8')) } catch {}
  for (const dep of Object.keys(pkg.dependencies || {})) collectDeps(dep, seen)
  return seen
}

const packages = new Set()
for (const name of ROOT_PACKAGES) collectDeps(name, packages)

if (existsSync(nodeModulesDst)) rmSync(nodeModulesDst, { recursive: true, force: true })
mkdirSync(nodeModulesDst, { recursive: true })
let copied = 0
for (const pkg of packages) {
  const src = join(nodeModulesSrc, pkg)
  if (!existsSync(src)) continue
  copyDir(src, join(nodeModulesDst, pkg))
  copied++
}
console.log(`  ✓ node_modules (${copied} packages)`)

// Generate the launcher batch file. It must only kill ITS OWN server process —
// never `taskkill /IM node.exe`, which would take down every node app.
const batPath = join(releaseDir, 'start-moodbored.bat')
const bat = `@echo off
setlocal
cd /d "%~dp0"
echo Starting MoodBored...

for /f %%P in ('powershell -NoProfile -Command "(Start-Process node -ArgumentList 'server.mjs' -PassThru).Id"') do set SRVPID=%%P

echo Waiting for server to start (pid %SRVPID%)...
timeout /t 3 /nobreak >nul

curl -s http://localhost:3000/api/board/health >nul 2>&1
if %errorlevel% equ 0 (
    echo Server is running!
    echo Opening MoodBored... (if the browser does not open: http://localhost:3000)
    start http://localhost:3000
) else (
    echo Server failed to start. Make sure Node.js is installed and port 3000 is free.
)

echo.
echo Press any key to stop the server...
pause >nul

taskkill /F /PID %SRVPID% >nul 2>&1
endlocal
`
writeFileSync(batPath, bat)
console.log('  ✓ start-moodbored.bat')

console.log('Done! Desktop files copied to:', releaseDir)
console.log('')
console.log('To run the desktop app:')
console.log(`  ${join(releaseDir, 'moodbored.exe')}`)
