
const id = 'mindfuck-content-script'

const sendToBackground = (o) => {
  const msg = { ...o, source: id }
  const msgId = Math.random().toString(36).substring(7)
  if (!msg.id) msg.id = msgId
  return chrome.runtime.sendMessage({ ...o, source: id })
}

window.addEventListener('message', async (event) => {

  const message = event.data
  if (!message) return
  else if (message.source === 'mindfuck-background') return
  else {
    const res = await chrome.runtime.sendMessage(event.data)
    window.postMessage(res)
  }
});


const injectedScripts = ['js/injected.js']

const el = document.head||document.documentElement

const inject = (uri) => {
  var script = document.createElement('script'); 
  script.src = chrome.runtime.getURL(uri);
  script.type = "module";
  el.appendChild(script);
}

injectedScripts.forEach(inject)

const events = [
  'mousedown',
  'mouseup',
  'mousemove',
  'click',
  'dblclick',
  'contextmenu',
  'wheel',
  'keydown',
  'keyup',
  'keypress',
  'touchstart',
  'touchend',
  'touchmove',
  'touchcancel',
  'keydown',
  'keyup',  
]

function stringifyEvent(e) {
  const obj = {};
  for (let k in e) {
    obj[k] = e[k];
  }
  return JSON.stringify(obj, (k, v) => {
    if (v instanceof Node) return 'Node';
    if (v instanceof Window) return 'Window';
    return v;
  }, ' ');
}

// Monitor window events
events.forEach(evName => {
  window.addEventListener(evName, (ev) => sendToBackground({ command: 'event', id, payload: stringifyEvent(ev) }, '*'))
})

// Monitor new tabs
sendToBackground({ command: 'tab-opened', payload: document.referrer });

window.addEventListener('beforeunload', (ev) => {
  sendToBackground({ command: 'tab-closed', payload: stringifyEvent(ev) });
})


