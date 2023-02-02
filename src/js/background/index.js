import { createAlarmCommand, eventEvent, getAllVisitsCommand } from "../commands.js";
import { listenToActiveTab } from "./active.js";
import "./install.js";
import "./notifications.js";
import { updateVisit, getAllVisits } from "./visits.js";

const source = 'mindfuck-background'

listenToActiveTab(updateVisit) // Listen to tab switches with update visit

const validCommands = [
  getAllVisitsCommand,
  createAlarmCommand,
  eventEvent,
  // pageOpenedEvent,
  // 'page-closed',
  // 'tab-switched'
]

// ----------------- Message Direct to the Background -----------------
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {

  const id = request.id

  const message = {}

  const send = () => sendResponse({ ...message, id, source }) // Ensure same ID is returned

  // Handle different commands
  if (request.command === getAllVisitsCommand) {
    getAllVisits().then(entries => {
      message.payload = entries
      send()
    })
    return true // Ensure async response
  } 
  
  else if (request.command === createAlarmCommand) {
    getAllVisits().then(entries => {
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
  
  else if (validCommands.includes(request.command)) updateVisit(sender.tab.id, request.command, request.payload)

})