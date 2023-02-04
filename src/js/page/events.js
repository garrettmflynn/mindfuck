

if (!globalThis.mindfuckEventScript) {
    (async () => {

        const es = await import(chrome.runtime.getURL('./js/page/webtrack/index.esm.js'));


        globalThis.mindfuckEventScript = true

        const source = 'mindfuck-event-script'

        const sendToBackground = (o) => {
            const msg = { ...o, source }
            const msgId = Math.random().toString(36).substring(7)
            if (!msg.id) msg.id = msgId
            return chrome.runtime.sendMessage({ ...o, source })
        }

        const watcher = new es.Watcher()
        watcher.watch((ev) => {
            const event = watcher.stringify(ev)
            if (event) sendToBackground({ command: 'mindfuck-event', payload: event })
        })


        console.log('Finished injecting the mindfuck event script')
    })();
}