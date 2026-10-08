#!/usr/bin/env node

// Copy necessary files to the Tauri release directory
// This script runs after `npm run tauri build`

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const releaseDir = join(rootDir, 'src-tauri', 'target', 'release')

console.log('Copying desktop files to release directory...')

// Copy server.mjs
const serverSrc = join(rootDir, 'server.mjs')
const serverDst = join(releaseDir, 'server.mjs')
if (existsSync(serverSrc)) {
  copyFileSync(serverSrc, serverDst)
  console.log('  ✓ server.mjs')
}

// Copy dist folder
function copyDir(src, dst) {
  if (!existsSync(dst)) mkdirSync(dst, { recursive: true })
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name)
    const dstPath = join(dst, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath)
    } else {
      copyFileSync(srcPath, dstPath)
    }
  }
}

const distSrc = join(rootDir, 'dist')
const distDst = join(releaseDir, 'dist')
if (existsSync(distSrc)) {
  copyDir(distSrc, distDst)
  console.log('  ✓ dist/')
}

// Copy node_modules (only necessary packages)
const nodeModulesSrc = join(rootDir, 'node_modules')
const nodeModulesDst = join(releaseDir, 'node_modules')
const requiredPackages = ['express', 'cors', 'helmet', 'compression', 'morgan', 'express-rate-limit']

if (existsSync(nodeModulesSrc)) {
  if (!existsSync(nodeModulesDst)) mkdirSync(nodeModulesDst, { recursive: true })
  for (const pkg of requiredPackages) {
    const src = join(nodeModulesSrc, pkg)
    const dst = join(nodeModulesDst, pkg)
    if (existsSync(src)) {
      copyDir(src, dst)
      console.log(`  ✓ node_modules/${pkg}`)
    }
  }
}

console.log('Done! Desktop files copied to:', releaseDir)
console.log('')
console.log('To run the desktop app:')
console.log(`  ${join(releaseDir, 'moodbored.exe')}`)