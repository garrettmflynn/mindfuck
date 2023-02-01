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

const active = {}

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
      if (!entry) entry = active[hostname] = {hostname, visits: {}}
      entry.visits[id] = {url: sender.url, id, title: sender.tab.title, opened: Date.now(), closed: null, events: {}, referrer: request.payload}
    } else {
        const visit = entry.visits[id]
        if (command === 'tab-closed') {
          visit.closed = Date.now()
          delete entry.visits[id] // Stop tracking the visit
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
  const filename = `${__dirname}/${hostname}`
  appendCSV(info, filename, undefined, {json: true}) // Save in IndexedDB
  // chrome.storage.sync.set({ [info.hostname]: info.entry }) // Save in Chrome Storage
}


const getAllEntries = async () => {

  // Using IndexedDB
  const files = await listFiles(__dirname)
  let result = {}

  await Promise.all(files.map(async hostname => {

    const visitsArray = await readCSVChunkFromDB(`${__dirname}/${hostname}`, undefined, undefined, {
      transpose: true,
      json: true
    })

    const visits = {}
    visitsArray.forEach(visit => visits[visit.id] = visit)
    result[hostname] = { hostname, visits }
  }))

  Object.entries(active).forEach(([hostname, entry]) => {
    const info = result[hostname] = result[hostname] ?? { hostname }
    const visits = info?.visits
    const activeVisits = entry.visits
    info.visits = visits ? {...visits, ...activeVisits} : activeVisits // Include active visits
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