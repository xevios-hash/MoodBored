// Minimal CDP console grabber: node scripts/cdp-console.mjs <ws-url>
const ws = new WebSocket(process.argv[2])
let id = 0
const send = (method, params = {}) => ws.send(JSON.stringify({ id: ++id, method, params }))

ws.onopen = () => {
  send('Runtime.enable')
  send('Log.enable')
  send('Page.enable')
  send('Runtime.evaluate', { expression: 'JSON.stringify({firstLoad: true, rootLen: (document.getElementById("root")||{}).innerHTML?.length ?? -1, bodyCls: document.body.className, sw: !!navigator.serviceWorker?.controller, ready: document.readyState})', returnByValue: true })
  if (!process.env.NO_RELOAD) setTimeout(() => send('Page.reload', { ignoreCache: true }), 500)
  setTimeout(() => {
    send('Runtime.evaluate', { expression: 'JSON.stringify({rootLen: (document.getElementById("root")||{}).innerHTML?.length ?? -1, bodyCls: document.body.className, sw: !!navigator.serviceWorker?.controller, ready: document.readyState})', returnByValue: true })
  }, 6000)
  setTimeout(() => { ws.close(); process.exit(0) }, 9000)
}

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails
    console.log('EXCEPTION:', d.text, d.exception?.description?.slice(0, 600) || d.exception?.value || '')
  } else if (msg.method === 'Runtime.consoleAPICalled') {
    const args = (msg.params.args || []).map(a => a.value ?? a.description ?? a.type).join(' ')
    console.log(`CONSOLE[${msg.params.type}]:`, String(args).slice(0, 600))
  } else if (msg.method === 'Log.entryAdded') {
    const e = msg.params.entry
    console.log(`LOG[${e.level}]:`, (e.text || '').slice(0, 600), e.source, e.url || '')
  } else if (msg.id && msg.result?.result?.value) {
    console.log('EVAL:', msg.result.result.value)
  }
}
ws.onerror = (e) => console.log('WS error', e.message || e)
