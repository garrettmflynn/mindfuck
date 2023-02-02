
if (globalThis.mindfuckEventScript) console.error('mindfuckEventScript already exists')

else {

    globalThis.mindfuckEventScript = true
    const id = 'mindfuck-event-script'

    console.warn('Injecting mindfuckEventScript')
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
        window.addEventListener(evName, (ev) => sendToBackground({ command: 'mindfuck-event', id, payload: stringifyEvent(ev) }))
    })
}