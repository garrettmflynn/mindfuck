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

const timeActive = {}
let isActive;

// Only track time on the active tab
chrome.tabs.onActivated.addListener(async (activeInfo) => {

  const id = activeInfo.tabId
  const previousId = isActive?.id

  // Register previous tab activity
  if (previousId) updateVisit(id, 'tab-switched', isActive)

  // Start tracking the new active tab
  timeActive[id] = isActive = {
    id,
    started: Date.now(),
    previousVisit: previousId
  }

})


// -------------- Update visits --------------
const allVisits = {}
const activeVisits = {}
let fromDatabase

// Get the correct ID to account for refreshes
const getId = (id,) => {
  let i = 0
  let returned = id

  // Only return a visit that doesn't exist or is not closed
  while (allVisits[returned] && allVisits[returned]?.ended != null) {
    i++
    returned = `${id}_${i}` // Iterate ID
  }

  return returned

}

const createVisit = async (tab) => {

  const id = getId(tab.id)

  let visit = allVisits[id]
  if (!visit) {

    let url = tab.url;
    if (!url) {
      console.warn('Ignored pending url', tab.pendingUrl)
      return
    }

    const isChrome = url.includes('chrome://') || url.includes('chrome-extension://')

    const createdBy = (isChrome) ? null : await new Promise((resolve) => chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        func: () => document.referrer,
      },
      (resultArr) => resolve(resultArr ? resultArr[0].result : null)
    ));
    
    let hostname = null

    try { hostname = new URL(url).hostname } // Standard URLs
    catch {
      const split = url.split('/') 
      hostname = split[2] // Other special protocols (like chrome://newtab)
    }

    visit = {

      // On visit creation
      hostname,
      url,
      id,
      title: tab.title,
      started: Date.now(),
      createdBy, // document.referrer OR null when an origin point

      // During Visit
      events: {},

      // At End
      stateChange: '', 
      ended: null,
      previousState: null
    }

    allVisits[id] = activeVisits[id] = visit
  }

  return visit
}

const updateVisit = async ( 
  tabId, 
  command, 
  payload, 
) => {
    const id = getId(tabId)

    let visit = activeVisits[id] 
      if (!visit) {
        const tab = await chrome.tabs.get(tabId).catch(console.error)
        if (tab) visit = await createVisit(tab)
        else {
          console.error('Tab does not yet exist...', tabId)
          chrome.tabs.query({}, function(tabs) { console.error('All tabs', tabs) } )
          return
        }
      }

    if ( command !== 'page-opened' && visit) {

        const onVisitEnd = (stateChange) => {
            visit.stateChange = stateChange
            visit.previousVisit = timeActive[tabId]?.previousVisit
            const started = timeActive[tabId]?.started
            if (started) visit.started = timeActive[tabId]?.started 
            else console.error('No start update...', timeActive, tabId)
            visit.ended = Date.now()
            saveVisit(visit)
        }

        if (command === 'page-closed') onVisitEnd(command)
        else if (command === 'tab-switched') onVisitEnd(command)

        else if (command === 'event') {
          const ev = JSON.parse(payload)
          let evType = visit.events[ev.type]
          if (!evType) evType = visit.events[ev.type] = []
          evType.push(ev)
        }
    }

}

// ensure database is ready
let readyResolve;
let loadingDirectory = false
let isReady = false
let ready = new Promise(resolve => readyResolve = () => {
  isReady = true
  resolve()
})

const __dirname = 'mindfuck'
const delimiter = ','

const saveVisit = async (info) => {
  const hostname = info.hostname
  const base = `${__dirname}/${hostname}`
  const filename = `${base}_info`
  const copy = {...info}
  const events = info.events
  delete copy.events
  if (loadingDirectory) await ready // Wait until ready
  else loadingDirectory = true

  for (let key in copy) {
    if (typeof copy[key] === 'string') copy[key] = copy[key].replace(delimiter, '') // Remove commas...
  }

  appendCSV(copy, filename).then(res => {
    if (!isReady) readyResolve()
  }) // Save in IndexedDB

  // for (let eventType in info.events) {
  Object.entries(events).forEach(async ([eventType, evArray]) => {
    const filename = `${base}_events_${info.id}_${eventType}`
    for (let ev of evArray) await appendCSV(ev, filename) // Sequential write to the same file
  })
  // }

  // chrome.storage.sync.set({ [info.hostname]: info.entry }) // Save in Chrome Storage
}


const getAllEntries = async () => {

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

    console.warn(`Loading ${files.length} entries from IndexedDB...`)
    if (files.length < 20) console.warn(files)

    const start = performance.now()

    fromDatabase = {} // initialize database snapshot
    
    await Promise.all(Object.keys(fileInfo).map(async hostname => {

      const info = fileInfo[hostname] 
      const filename = `${__dirname}/${hostname}_info`
      const visitsArray = await readCSVChunkFromDB(filename, undefined, undefined, { transpose: true, json: true })

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

    console.warn(`Loaded ${files.length} entries from IndexedDB in ${((performance.now() - start)/1000).toFixed(3)} seconds`)


    // Put results in all visits
    for (let hostname in fromDatabase) {
      const storedVisits = fromDatabase[hostname]?.visits
      for (let id in storedVisits) {

        // Prioritize stored visits
        if ((id in allVisits)) {
          const newId = getId(id.split('_')[0])
          const previous = allVisits[id]
          previous.id = newId
          allVisits[newId] = previous
        }
        
        if (!('hostname' in storedVisits[id])) storedVisits[id].hostname = hostname // Add hostname if not present

        allVisits[id] = storedVisits[id]
      }
    }
  }


  // Transform all visits
  let result = {};
  Object.entries(allVisits).forEach(([id, visit]) => {
    const hostname = visit.hostname
    const info = result[hostname] = result[hostname] ?? { hostname }
    if (!info.visits) info.visits = {}
    info.visits[id] = visit
  })

  // const hosts = await chrome.storage.sync.get(null) // Using Chrome Storage

 return result
}

// ----------------- Message Direct to the Background -----------------
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {

  const id = request.id

  const message = {}

  const send = () => sendResponse({ ...message, id, source }) // Ensure same ID is returned

  // Handle different commands
  if (request.command === 'get-all-visits') {
    getAllEntries().then(entries => {
      message.payload = entries
      send()
    })
    return true // Ensure async response
  } 
  
  else if (request.command === 'create-alarm') {
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
  }
  
  else {
    console.warn('Other requests', request.command, request)
    updateVisit(sender.tab.id, request.command, request.payload)
  }

})