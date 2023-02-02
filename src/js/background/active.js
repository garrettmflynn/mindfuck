import { tabSwitchedEvent } from "../commands.js";
import { getId } from "./globals.js";

let isActive;

export const listenToActiveTab = (onSwitch) => {

    const hasSwitched = (id) => {
        const previousTabInfo = isActive ? {...isActive} : {}
        previousTabInfo.nextVisit = {tab: id, id: getId(id)}
        const previousId = getId(isActive?.id)
        const started = previousTabInfo.ended = Date.now()

        if (isActive) onSwitch(isActive?.id, tabSwitchedEvent, previousTabInfo)

        isActive = {
            id,
            started,
            previousVisit: previousId
        }
    }
    chrome.tabs.onActivated.addListener((activeInfo) => hasSwitched(activeInfo.tabId))


    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
        if (changeInfo.status === "complete") hasSwitched(tabId)
    })
}


