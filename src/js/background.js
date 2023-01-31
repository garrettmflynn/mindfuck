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
// Get the correct ID to account for refreshes
const getId = (id, entry) => {
  let i = 0
  let returned = id

  // Only return a visit that doesn't exist or remains open
  while (entry?.visits?.[returned]?.closed == null) {
    returned = `${id}_${i}` // Iterate ID
    if (!entry?.visits[returned]) break; // If there is no visit with this id, return it
    i++
  }

  return returned
}

const updateVisit = async (hostname, sender, request) => {
  return chrome.storage.sync.get(null).then(hosts => {
    let entry = hosts[hostname]
    const command = request.command
    const id = getId(sender.tab.id, entry)

    let visit;
    if (command === 'tab-opened') {
      if (!entry) entry = hosts[hostname] = {hostname, visits: {}}
      visit = entry.visits[id] = {url: sender.url, title: sender.tab.title, opened: Date.now(), closed: null, events: {}, referrer: request.payload}

      // const filename = `mindfuck/${hostname}`
      // console.log('Writing to csv', filename, visit)
      // appendCSV(visit, filename).then(res => console.warn('Was written!', res))

    } else {

        visit = entry.visits[id]
        if (command === 'tab-closed') visit.closed = Date.now()

        // Avoid quickly filling the storage limit
        else if (command === 'event') {
          // const ev = JSON.parse(request.payload)
          // let evType = visit.events[ev.type]
          // if (!evType) evType = visit.events[ev.type] = []
          // evType.push(ev)
        }
        else console.error('Unknown command', command)
    }

    return {
      entry,
      visit,
      hosts
    }
  })
}

const saveTabs = (hostname, entry) => chrome.storage.sync.set({ [hostname]: entry })

// ----------------- Message Direct to the Background -----------------
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {

  const id = request.id
  const hostname = new URL(sender.origin).hostname

  const message = {}

  const send = () => sendResponse({ ...message, id, source }) // Ensure same ID is returned

  // Handle different commands
  switch (request.command) {
    case 'get-tab-history':
      chrome.storage.sync.get(null).then(hosts => {
        console.log('SENDING HOSTS', hosts)
        message.payload = hosts
        send()
      })
      return true // Ensure the response is sent asynchronously

    case 'tab-opened':
      updateVisit(hostname, sender, request).then(({ entry }) => saveTabs(hostname, entry))
      break;

    case 'tab-closed':
      updateVisit(hostname, sender, request).then(({ entry }) => saveTabs(hostname, entry))
      break;

    case 'event':
      updateVisit(hostname, sender, request).then(({ entry }) => saveTabs(hostname, entry))
      break;


    case 'create-alarm': 
      chrome.storage.sync.get(null).then(hosts => {
        console.log('Got hosts', hosts)
        let max = 0
        let selected;
        Object.values(hosts).forEach(o => {
          const visits = o.visits.length
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