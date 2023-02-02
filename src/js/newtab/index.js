const originVisitsList = document.querySelector('#originVisits');

const send = async (o) => {
    const id = Math.random().toString(36).substring(7)
    const res = await chrome.runtime.sendMessage({ ...o, id, source: 'mindfuck-newtab-module' })
    return (res && typeof res === 'object') ? res.payload : res
}

// --------------- Show latest tab history ---------------
const res = await send({ command: 'get-all-visits' });

let allVisitElements = {}
const visitMap = {}

function millisToMinutesAndSeconds(millis) {
    var minutes = Math.floor(millis / 60000);
    var seconds = ((millis % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }

  const registerVisit = (o) => {
    visitMap[o.id] = o
    return o
  }

  const visualizeVisit = (o) => {

    // // By Origin
    // let visitElements = allVisitElements[o.hostname];
    // if (!visitElements){
    //     allVisitElements[o.hostname] = visitElements = {}
    //     const item = visitElements.item = document.createElement('li');
    //     const list = visitElements.list = document.createElement('ol');
    //     item.innerHTML = `<a href="${o.hostname}"><h2>${o.hostname}</h2></a>`
    //     item.insertAdjacentElement('beforeend', list)
    //     originVisitsList.appendChild(item);
    // }

    // // Object.values(o.visits).forEach(v => {
    //     const li = document.createElement('li');
    //     li.innerHTML = `${o.title} (${!!o.ended ? `${millisToMinutesAndSeconds(o.ended - o.started)}` : `Active`})`
    //     const evList = document.createElement('ul');
    //     li.insertAdjacentElement('beforeend', evList)
    //     Object.entries(o.events).forEach(([evType, events]) => {
    //         const ev = document.createElement('li');
    //         ev.innerHTML = `<b>${evType}:</b> ${events.length}`
    //         evList.insertAdjacentElement('beforeend', ev)
    //     })
    //     visitElements.list.insertAdjacentElement('beforeend', li)
    // // })

    const li = document.createElement('li');
    const system = !o.hostname.includes('.')
    li.innerHTML = `
    <small class="timestamp">${new Date(o.started).toLocaleString()}</small> 
    <h4>${o.title}</h4>
    <small><b>Time Active:</b> ${!!o.ended ? `${millisToMinutesAndSeconds(o.ended - o.started)}` : `Active`}</small>
    <br>
    <small><b>Path:</b> ${o.previousVisit} —> ${o.id}</small>`
    if (system) li.classList.add('system')

    // Show events
    const events = Object.entries(o.events)
    if (events.length) {
        const evList = document.createElement('ul');
        evList.innerHTML = `<h5>Events</h5>`
        li.insertAdjacentElement('beforeend', evList)
        events.forEach(([evType, events]) => {
            const ev = document.createElement('li');
            ev.innerHTML = `<small><b>${evType}:</b> ${events.length}</small><br>`
            evList.insertAdjacentElement('beforeend', ev)
        })
    }

    originVisitsList.insertAdjacentElement('beforeend', li)
    
  }

    const onVisit = (o) => {
        registerVisit(o)
        visualizeVisit(o)
    }

    // Register all visits
    Object.values(res).forEach(o => Object.values(o.visits).forEach(v => registerVisit(v)))

    // Visualize each visit in reverse chronological order
    const allVisits = Object.values(visitMap)
    allVisits.sort((a, b) => a.started - b.started).reverse().forEach(visualizeVisit)

    console.log("Visit Chronology", allVisits.length, allVisits)

window.addEventListener('message', (event) => {
    const message = event.data
    if (!message) return
    else if (message.source === 'mindfuck-background') {
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