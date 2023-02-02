

if (!globalThis.mindfuckEventScript) {
    (async () => {

        // const keysExcluded = new Set()
        // const keysExcludedByEventType = {}

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

        // Get query selector input
        function convertAttributesToQuerySelector(element){

            if (!element.tagName) console.error('No tag name', element)
            var tagName = element.tagName.toLowerCase();
            var result = tagName;   
          
            Array.prototype.slice.call(element.attributes).forEach( function(item) {
            if(element.outerHTML.includes(item.name))
              result += '[' + item.name +'="' + item.value + '"]';
          
          });
          
            return result;
            //["a[id="y"]", "a[class="vote-up-off"]", "a[title="This answer is useful"]"]
          
          }
          
          function getMyPath(element){
            const parentEl = element.parentElement;
            if(!parentEl || parentEl.tagName == 'HTML') return 'html';
            return getMyPath(parentEl) + '>' + parentEl.tagName.toLowerCase() ;
            //"html>body>div>div>div>div>div>div>table>tbody>tr>td>div"
          
          }
          
          function myUniqueQuerySelector(element){
          
            var elementPath = getMyPath(element);
            var simpleSelector =   convertAttributesToQuerySelector(element);
          
            return elementPath + '>' + simpleSelector;
          
          }


          const toTransfer = [
            'clientX',
            'clientY',
            'deltaX',
            'deltaY',
            'deltaZ',
            'deltaMode',
            'animationName',
            'propertyName',
            'pseudoElement',
            'elapsedTime',

            // Pointer Events
            'pressure',
            'tangentialPressure',
            'tiltX',
            'tiltY',
            'twist',
            'pointerType',
            'azimuthAngle',
            'altitudeAngle',


            // Device Orientation
            'alpha',
            'beta',
            'gamma',
            'absolute',

            // Keys
            'key',
            // 'code',
            'location',
            'repeat',
            'isComposing',
            'ctrlKey',
            'shiftKey',
            'altKey',
            'metaKey',
        ]

        function stringifyEventForBackground(e) {

            try {

                const obj = {};
                obj.timestamp = e.timeStamp
                obj.target = e.target
                obj.type = e.type

                toTransfer.forEach(key => {
                    if (key in e) obj[key] = e[key]
                })

                // for (let k in e) {
                //     if (!(k in obj)) {
                //         if (!keysExcludedByEventType[k]) keysExcludedByEventType[k] = new Set()
                //         keysExcluded.add(k)
                //         keysExcludedByEventType[k].add(e.type)
                //     }
                // }

                return JSON.stringify(obj, (k, v) => {
                    if (v instanceof Element) return myUniqueQuerySelector(v);
                    if (v instanceof Node) return v.nodeName;
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
                const payload = stringifyEventForBackground(ev)
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
                        const event = stringifyEventForBackground(ev)
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