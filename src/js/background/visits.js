import { appendCSV } from "./storage/BFS_CSV.js";
import { listFiles, readCSVChunkFromDB } from "./storage/BFSUtils.js";
import { allVisits, getId } from "./globals.js";
import { eventEvent, pageClosedEvent, tabRefreshedEvent, tabSwitchedEvent, tabUpdateEvent } from "../commands.js";
import { injectScript } from "./inject.js";

let fromDatabase


export const activeVisits = {}

// -------------- Update visits --------------

export const createVisit = async (tab, previousVisit = {}) => {

  const id = getId(tab.id)

  let visit = allVisits[id]
  if (!visit) {

    let url = tab.url;
    if (!url) {
      console.warn('Ignored pending url', tab.pendingUrl)
      return
    }

    const isChrome = url.includes('chrome://') || url.includes('chrome-extension://')

    let createdBy = null
    if (!isChrome) {

        // Inject script to get events
        await injectScript(tab.id, 'js/page/events.js')

        // Inject script to get referrer
        createdBy = await new Promise((resolve) => chrome.scripting.executeScript(
        {
            target: { tabId: tab.id },
            func: () => document.referrer,
        },
        (resultArr) => resolve(resultArr ? resultArr[0].result : null)
        ));
    }
    
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
      tab: tab.id,
      title: tab.title,
      timestamp: previousVisit.ended || Date.now(),
      createdBy, // document.referrer OR null when an origin point

      // During Visit
      events: {}, // e.g. mousemove, scroll, keypress
      actions: {}, // e.g. 

      // At End
      ended: null,


      // Track Path
      previous: previousVisit.id,
      next: null,
      to: previousVisit.from,
      from: null,
    }

    allVisits[id] = activeVisits[id] = visit
  }

  return visit
}


let tabHistory = {}
export const getTab = async (id) => {
    const tab = await chrome.tabs.get(id).catch(() => null)
    if (tab) {
        tabHistory[id] = tab
        return tab
    }
    else {
        const tab = tabHistory[id]
        if (tab) return tab
    }
}

const getVisit = async (tabId, previousVisit) => {

    const id = getId(tabId)

    let visit = activeVisits[id] 
    if (!visit) {
        const tab = await getTab(tabId)
        if (tab) visit = await createVisit(tab, previousVisit)
        else return
    }

    return visit
}

let latestVisit;

export const updateVisit = async ( 
  tabId, 
  command, 
  payload, 
) => {

    const visit = await getVisit(tabId, latestVisit)

    if (visit) {

        const onVisitEnd = async (info, updatedTab) => {
            visit.previous = info.previousVisit.id
            visit.timestamp = info.timestamp 
            visit.ended = info.ended 

            // Check if tab was closed

            let event;
            if (updatedTab) event = (visit.url === updatedTab.url) ? tabRefreshedEvent : tabUpdateEvent
            else {
                const exists = await chrome.tabs.get(visit.tab).catch(() => null) 
                event= (!exists) ? pageClosedEvent : tabSwitchedEvent
            }

            visit.next = info.nextVisit.id
            visit.from = event

            saveVisit(visit)
        }

        if (command === tabSwitchedEvent) {

            const info = payload.info
            // Close out the previous visit
            await onVisitEnd(info, payload.update)

            // Register the new visit
            latestVisit = await getVisit(info.nextVisit.tab, visit)
            // console.warn('Send latest visit to the dashboard', newVisit)
        }

        else if (command === eventEvent) {
          let from = payload.from || 'window'
          const ev = JSON.parse(payload.from ? payload.event : payload)
          const type = payload.from ? `${from}-${ev.type}` : ev.type
          let evType = visit.events[type]
          if (!evType) evType = visit.events[type] = []
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

export const saveVisit = async (info) => {
  const hostname = info.hostname
  const base = `${__dirname}/${hostname}`
  const filename = `${base}_info`
  const copy = {...info}
  const events = info.events
  delete copy.events
  if (loadingDirectory) await ready // Wait until ready
  else loadingDirectory = true

  for (let key in copy) {
    if (typeof copy[key] === 'string') {
        const og = copy[key]
        copy[key] = og.replaceAll(delimiter, '') // Remove commas...
    }
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



export const getAllVisits = async () => {

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
            const previous = allVisits[id]
            const newId = getId(previous.tab)
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
  