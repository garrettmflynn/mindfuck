const source = 'mindfuck-injection-demo'

let toResolve = {}

// Pass messages between the injected script and the background script
window.addEventListener('message', (event) => {
    const message = event.data
    if (!message) return
    else if (message.source === 'mindfuck-background') {
        toResolve[message.id](message.payload)
        delete toResolve[message.id]
    }
})

// Send messages to the background
const sendtoBackground = (o) => {
    const id = Math.random().toString(36).substring(7)
    window.postMessage({ ...o, source, id });
    return new Promise((resolve) => toResolve[id] = resolve)
}

// ---------------Test sending a message ---------------
const res = await sendtoBackground({ command: 'get-tab-history', payload: source });
console.log('Previous Tabs', res)