
if (globalThis.mindfuckEventScript) return //console.error('mindfuckEventScript already exists')

else {
    (async () => {
        const onElementUtils = await import(chrome.runtime.getURL('./js/page/onElement.js'));
        const properties = await import(chrome.runtime.getURL('./js/page/properties.js'));

        globalThis.mindfuckEventScript = true

        const source = 'mindfuck-event-script'

        const sendToBackground = (o) => {
            const msg = { ...o, source }
            const msgId = Math.random().toString(36).substring(7)
            if (!msg.id) msg.id = msgId
            return chrome.runtime.sendMessage({ ...o, source })
        }


        const getAllEvents = (target, options={}) => {
            let events = [];
            const allProperties = properties.getAllPropertyNames(target)
            allProperties.forEach(key => {
                if (/^on/.test(key)) {
                    const event = key.slice(2)
                    if (options.callback) target.addEventListener(event, options.callback);
                    if (!options.ignore || !options.ignore.includes(event)) events.push(event);
                }
            });
            return events
        }

        function stringifyEvent(e) {

            try {
                const obj = {};
                for (let k in e) {
                    obj[k] = e[k];
                }
                return JSON.stringify(obj, (k, v) => {
                    if (v instanceof Node) return 'Node';
                    if (v instanceof Window) return 'Window';
                    return v;
                }, ' ');
            } catch (err) {
                console.warn('Failed to pass event type', e.type, err)
                return
            }
        }

        const allEvents = {
            window: getAllEvents(window, {
                ignore: ['message', 'unload']
            })
        }

        // Monitor window events
        allEvents.window.forEach(evName => {
            window.addEventListener(evName, (ev) => {
                const payload = stringifyEvent(ev)
                if (payload) sendToBackground({ command: 'mindfuck-event', payload })
            })
        })


        const elementStore = {
            observer: undefined,
            count: 0,
            elements: {},

            register: function (el) {
                const tagName = el.tagName.toLowerCase()
                let elementEvents = allEvents[tagName]

                if (!elementEvents) allEvents[tagName] = elementEvents = getAllEvents(el)

                elementEvents.forEach(evName => {
                    el.addEventListener(evName, (ev) => {
                        const event = stringifyEvent(ev)
                        if (event) sendToBackground({ command: 'mindfuck-event', payload: {from: tagName, event} })
                    })
                })
            }
        }


        // Monitor element events
        onElementUtils.start.call(elementStore, {
            callback: elementStore.register,
            type: [
                // 'BUTTON', 
                // 'INPUT', 
                // 'SELECT', 
                // 'TEXTAREA', 
                // 'FORM', 
                // 'A',
                'VIDEO',
                // "AUDIO",
            ]
        })

        console.log('Finished injecting the mindfuck event script')
    })();
}