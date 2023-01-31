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

  const url = alarm.name ? (new URL(alarm.name).origin) : 'something...'
  chrome.action.setBadgeText({ text: '' });
   chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/48.png'),
    title: `You're getting fucked`,
    message: `Protect your mind from ${url}`,
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

const updateVisit = async (sender, request) => {
  return chrome.storage.sync.get(["tabs"]).then(result => {
    const tabs = result.tabs ? JSON.parse(result.tabs) : {}
    let entry = tabs[sender.url]

    const command = request.command

    let visit;
    if (command === 'tab-opened') {
      if (!entry) entry = tabs[sender.url] = {url: sender.url, visits: {}, title: sender.tab.title}
      visit = entry.visits[sender.tab.id] = {url: sender.url, title: sender.tab.title, opened: Date.now(), closed: null, events: {}, referrer: request.payload}
      chrome.storage.sync.set({ tabs: JSON.stringify(tabs) })
    } else {
      if (!entry) console.error('No entry for tab', sender.url, tabs)
      else {
        visit = entry.visits[sender.tab.id]
        if (!visit) console.error('No visit for tab', sender.tab.id)
        else if (command === 'tab-closed') {
          console.log('Closing visit', visit)
          visit.closed = Date.now()
        }
        else if (command === 'event') {
          const ev = JSON.parse(request.payload)
          let evType = visit.events[ev.type]
          if (!evType) evType = visit.events[ev.type] = []
          evType.push(ev)
        }
        else console.error('Unknown command', command)
      }
    }

    return {
      visit,
      tabs
    }
  })
}

const saveTabs = (tabs) => chrome.storage.sync.set({ tabs: JSON.stringify(tabs) })

// ----------------- Message Direct to the Background -----------------
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {

  const id = request.id

  const message = {}

  const send = () => sendResponse({ ...message, id, source }) // Ensure same ID is returned

  // Handle different commands
  switch (request.command) {
    case 'get-tab-history':
      chrome.storage.sync.get(["tabs"]).then(res => {
        message.payload = res.tabs ? JSON.parse(res.tabs) : {}
        send()
      })
      return true // Ensure the response is sent asynchronously

    case 'tab-opened':
      updateVisit(sender, request).then(({ tabs }) => saveTabs(tabs))
      break;

    case 'tab-closed':
      updateVisit(sender, request).then(({ tabs }) => saveTabs(tabs))
      break;

    case 'event':
      updateVisit(sender, request).then(({ tabs }) => saveTabs(tabs))
      break;


    case 'create-alarm': 
      chrome.storage.sync.get(["tabs"]).then(res => {
        const tabs = res.tabs ? JSON.parse(res.tabs) : {}
        let max = 0
        let selected;
        Object.values(tabs).forEach(o => {
          const visits = o.visits.length
          if (visits > max) {
            max = visits
            selected = o
          }
        })

        if (selected) {
          chrome.action.setBadgeText({text: 'ON'});
          chrome.alarms.create(selected.url, {delayInMinutes: 0});
        } else console.error('No page visits yet...')
      })
      break;

    case 'clear-alarms': 
      chrome.action.setBadgeText({text: ''});
      chrome.alarms.clearAll();
      break;

    default:
      console.error('Uncaught message in background', request)
      break;
  }

})