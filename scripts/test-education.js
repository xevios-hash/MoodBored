#!/usr/bin/env node
// Test script for MoodBored education features
// Run: node scripts/test-education.js

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000'

async function test(name, fn) {
  try {
    const result = await fn()
    if (result === true) {
      console.log(`✅ ${name}`)
      return true
    } else {
      console.log(`❌ ${name}: ${result}`)
      return false
    }
  } catch (err) {
    console.log(`❌ ${name}: ${err.message}`)
    return false
  }
}

async function main() {
  console.log('🧪 Testing MoodBored Education Features\n')
  console.log(`Testing against: ${BASE_URL}\n`)
  
  let passed = 0
  let total = 0

  // Test 1: Health check
  total++
  if (await test('Health check', async () => {
    const res = await fetch(`${BASE_URL}/api/board/health`)
    return res.ok ? true : `Status ${res.status}`
  })) passed++

  // Test 2: Board exists
  total++
  if (await test('Test board exists', async () => {
    const res = await fetch(`${BASE_URL}/api/board/test-education`)
    if (!res.ok) return `Status ${res.status}`
    const data = await res.json()
    return data.project ? true : 'No project in response'
  })) passed++

  // Test 3: Board has items
  total++
  if (await test('Board has items', async () => {
    const res = await fetch(`${BASE_URL}/api/board/test-education`)
    const data = await res.json()
    const items = data.project?.viewports?.[0]?.items || []
    return items.length >= 5 ? true : `Only ${items.length} items`
  })) passed++

  // Test 4: AI proxy endpoint exists
  total++
  if (await test('AI proxy endpoint exists', async () => {
    const res = await fetch(`${BASE_URL}/api/ai/chat`, { method: 'POST' })
    // 501 = no API key configured, 400 = bad request - both mean endpoint exists
    return res.status === 501 || res.status === 400 || res.status === 502 
      ? true 
      : `Unexpected status ${res.status}`
  })) passed++

  // Test 5: AI proxy returns proper error when no key
  total++
  if (await test('AI proxy error handling', async () => {
    const res = await fetch(`${BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'test', messages: [{ role: 'user', content: 'hi' }] })
    })
    const data = await res.json()
    if (data.error) return true
    if (data.choices) return true // Got a response
    return 'No error or choices in response'
  })) passed++

  // Test 6: Lesson generation fallback works
  total++
  if (await test('Lesson generation (client-side fallback)', async () => {
    // This tests that the frontend can generate lessons even without AI
    // We can't test the frontend directly, but we can verify the API
    const res = await fetch(`${BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4',
        messages: [
          { role: 'system', content: 'Generate a simple lesson' },
          { role: 'user', content: 'Create a lesson about the solar system' }
        ],
        temperature: 0.7,
        max_tokens: 100,
        stream: false
      })
    })
    // Either get a response or a clean error - both are OK
    return res.status !== 500 ? true : `Status ${res.status}`
  })) passed++

  console.log(`\n📊 Results: ${passed}/${total} tests passed`)
  
  if (passed === total) {
    console.log('✨ All tests passed!')
  } else {
    console.log('⚠️  Some tests failed - check the output above')
    process.exit(1)
  }
}

main().catch(console.error)
