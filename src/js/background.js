import { listFiles, readCSVChunkFromDB } from "./storage/BFSUtils.js";
import { appendCSV } from "./storage/BFS_CSV.js";

const source = 'mindfuck-background'

// --------------- Allow for running after update (broken...) ---------------
chrome.runtime.onInstalled.addListener(async (details) => {

  // Open Onboarding Page
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({
      url: 'onboarding.html' // Show the onboarding page
    });
  }

  // for (const cs of chrome.runtime.getManifest().content_scripts) {
  //   for (const tab of await chrome.tabs.query({url: cs.matches})) {
  //     chrome.scripting.executeScript({
  //       target: {tabId: tab.id},
  //       files: cs.js,
  //     });
  //   }
  // }
});

// // -------------- Listen to changes in the storage --------------
// chrome.storage.onChanged.addListener((changes, namespace) => {
//   for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
//     console.log(
//       `Storage key "${key}" in namespace "${namespace}" changed.`,
//       `Old value was "${oldValue}", new value is "${newValue}".`
//     );
//   }
// });

// -------------- Allow Alarms to be created from content scripts --------------
chrome.alarms.onAlarm.addListener((alarm) => {

  const hostname = alarm.name ? alarm.name : 'something...'
  chrome.action.setBadgeText({ text: '' });
   chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/48.png'),
    title: `You're getting fucked`,
    message: `Protect your mind from ${hostname}`,
    buttons: [
      { title: 'Ask them to stop' }
    ],
    priority: 0
  });
});

chrome.notifications.onButtonClicked.addListener(async () => {
  console.error(`Corporations won't just stop fucking you if you ask nicely...`)
});



// -------------- Update visits --------------

const store = {}
const active = {}
let fromDatabase

// Get the correct ID to account for refreshes
const getId = (id, entry = {}) => {
  let i = 0
  let returned = id

  // Only return a visit that doesn't exist or is not closed
  while (entry.visits?.[returned] && entry.visits?.[returned]?.closed != null) {
    i++
    returned = `${id}_${i}` // Iterate ID
  }

  return returned

}

const updateVisit = async (hostname, sender, request) => {
  // return chrome.storage.sync.get(null).then(hosts => {
    let entry = active[hostname]
    const command = request.command
    const id = getId(sender.tab.id, entry)

    if (command === 'tab-opened') {
      
      if (!entry) {
        entry = active[hostname] = {hostname, visits: {}}
        store[hostname] = {hostname, visits: {}} // separate the references
      }

      store[hostname].visits[id] = entry.visits[id] = {url: sender.url, id, title: sender.tab.title, opened: Date.now(), closed: null, events: {}, referrer: request.payload}
    } else {
        const visit = entry.visits[id]
        if (command === 'tab-closed') {
          visit.closed = Date.now()
          delete entry.visits[id] // Disable future tracking of the visit
          saveVisit(hostname, visit)
        }

        // Avoid quickly filling the storage limit
        else if (command === 'event') {
          const ev = JSON.parse(request.payload)
          let evType = visit.events[ev.type]
          if (!evType) evType = visit.events[ev.type] = []
          evType.push(ev)
        }

        else console.error('Unknown command', command)
    }


  // })
}

const __dirname = 'mindfuck'
const saveVisit = (hostname, info) => {
  const base = `${__dirname}/${hostname}`
  const filename = `${base}_info`
  const copy = {...info}
  const events = info.events
  delete copy.events
  console.warn(`Saving visit (${info.id}) to IndexedDB`, filename)
  appendCSV(copy, filename) // Save in IndexedDB

  // for (let eventType in info.events) {
  Object.entries(events).forEach(async ([eventType, evArray]) => {
    const filename = `${base}_events_${info.id}_${eventType}`
    for (let ev of evArray) await appendCSV(ev, filename) // Sequential write to the same file
  })
  // }

  // chrome.storage.sync.set({ [info.hostname]: info.entry }) // Save in Chrome Storage
}


const getAllEntries = async () => {

  // Using IndexedDB
  let result = {};
  

  // Fill from Database

  if (!fromDatabase) {
    const files = await listFiles(__dirname)

    const fileInfo = {}
    files.forEach(str => {
      const split = str.split('_')
      const hostname = split[0]
      const type = split[1]
      const id = parseInt(split[2])
      if (!fileInfo[hostname]) fileInfo[hostname] = {}
      if (!fileInfo[hostname][type]) fileInfo[hostname][type] = []
      fileInfo[hostname][type].push({name: str, id})
    })

    console.warn('Getting entries from IndexedDB', fromDatabase, files)

    fromDatabase = {} // initialize database snapshot

    await Promise.all(Object.keys(fileInfo).map(async hostname => {

      const info = fileInfo[hostname] 
      const visitsArray = await readCSVChunkFromDB(`${__dirname}/${hostname}_info`, undefined, undefined, { transpose: true, json: true })

      const visits = {}
      await Promise.all(visitsArray.map(async visit => {
        visits[visit.id] = visit

        const eventArray = info.events ? info.events.filter(ev => ev.id === visit.id) : []

        // Reconstruct Events from IndexedDB
        let events = {}
        await Promise.all(eventArray.map(async (o) => {
          const eventType = o.name.split('_')[3]
          const path = `${__dirname}/${o.name}`
          const eventsArray = await readCSVChunkFromDB(path, undefined, undefined, { transpose: true, json: true })
          events[eventType] = eventsArray
        }))

        visit.events = events // Set events in visit
      }))

      fromDatabase[hostname] = { hostname, visits }
    }))
  }

  for (let hostname in fromDatabase) result[hostname] = {...fromDatabase[hostname]} // Ensure visits is not updated on database snapshot

  Object.entries(store).forEach(([hostname, entry]) => {
    const info = result[hostname] = result[hostname] ?? { hostname }
    const visits = info?.visits
    const storedVisits = entry.visits
    info.visits = visits ? {...visits, ...storedVisits} : storedVisits // Include stored visits
  })

  // const hosts = await chrome.storage.sync.get(null) // Using Chrome Storage

 return result
}

// ----------------- Message Direct to the Background -----------------
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {

  const id = request.id
  const hostname = new URL(sender.origin).hostname

  const message = {}

  const send = () => sendResponse({ ...message, id, source }) // Ensure same ID is returned

  // Handle different commands
  switch (request.command) {
    case 'get-tab-history':
      getAllEntries().then(entries => {
        message.payload = entries
        send()
      })
      return true // Ensure the response is sent asynchronously

    case 'tab-opened':
      updateVisit(hostname, sender, request)
      break;

    case 'tab-closed':
      updateVisit(hostname, sender, request)
      break;

    case 'event':
      updateVisit(hostname, sender, request)
      break;


    case 'create-alarm': 
      getAllEntries().then(entries => {
        let max = 0
        let selected;
        Object.values(entries).forEach(o => {
          const visits = Object.keys(o.visits).length
          if (visits > max) {
            max = visits
            selected = o
          }
        })

        if (selected) {
          chrome.action.setBadgeText({text: 'ON'});
          chrome.alarms.create(selected.hostname, {delayInMinutes: 0});
        } else console.error('No page visits yet...')
      })
      break;

    case 'clear-alarms': 
      chrome.action.setBadgeText({text: ''});
      chrome.alarms.clearAll();
      break;

    // default:
    //   console.error('Uncaught message in background', request)
    //   break;
  }

})