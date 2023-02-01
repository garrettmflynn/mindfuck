const originVisitsList = document.querySelector('#originVisits');

const send = async (o) => {
    const id = Math.random().toString(36).substring(7)
    const res = await chrome.runtime.sendMessage({ ...o, id, source: 'mindfuck-newtab-module' })
    return (res && typeof res === 'object') ? res.payload : res
}

// --------------- Show latest tab history ---------------
const res = await send({ command: 'get-all-visits' });
console.log('Visit History', res)

let allVisitElements = {}
const visitMap = {}

console.log('All Visits', visitMap)

const onVisit = (o) => {

    visitMap[o.id] = o
    
    let visitElements = allVisitElements[o.hostname];
    if (!visitElements){
        allVisitElements[o.hostname] = visitElements = {}
        const item = visitElements.item = document.createElement('li');
        const list = visitElements.list = document.createElement('ol');
        item.innerHTML = `<a href="${o.hostname}"><h2>${o.hostname}</h2></a>`
        item.insertAdjacentElement('beforeend', list)
        originVisitsList.appendChild(item);
    }

    // Object.values(o.visits).forEach(v => {
        const li = document.createElement('li');
        const isEnded = !!o.ended
        const duration = (isEnded) ? ((o.ended - o.started) / 1000 / 60).toFixed(2) : 'Active'
        li.innerHTML = `${o.title} (${isEnded ? `${duration}m` : duration})`
        const evList = document.createElement('ul');
        li.insertAdjacentElement('beforeend', evList)
        Object.entries(o.events).forEach(([evType, events]) => {
            const ev = document.createElement('li');
            ev.innerHTML = `<b>${evType}:</b> ${events.length}`
            evList.insertAdjacentElement('beforeend', ev)
        })
        visitElements.list.insertAdjacentElement('beforeend', li)
    // })
    
}

if (res) Object.values(res).sort((a,b) => Object.values(b.visits).length - Object.values(a.visits).length).forEach(o => {
    Object.values(o.visits).forEach(v => onVisit(v))
})

window.addEventListener('message', (event) => {
    const message = event.data
    if (!message) return
    else if (message.source === 'mindfuck-background') {
        console.warn('GOT MESSAGE IN NEW TAB', message)
        if (message.command === 'visit-started') onVisit(message.payload)
    }
})


// --------------- Create alarms ---------------
function setAlarm() {
    chrome.action.setBadgeText({text: 'ON'});
    chrome.alarms.create();
    window.close();
  }
  
//   function clearAlarm() {
//     chrome.action.setBadgeText({text: ''});
//     chrome.alarms.clearAll();
//     window.close();
//   }
  
  document.getElementById('triggerAlarm').addEventListener('click', () => send({command: 'create-alarm'}))
//   document.getElementById('clearAlarms').addEventListener('click', () => send({command: 'clear-alarms'}))