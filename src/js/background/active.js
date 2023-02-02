import { tabSwitchedEvent } from "../commands.js";
import { getId } from "./globals.js";

let isActive;

export const listenToActiveTab = (onSwitch) => {

    const hasSwitched = (id, updatedTab) => {
        const previousTabInfo = isActive ? {...isActive} : {}
        previousTabInfo.nextVisit = {tab: id, id: getId(id, updatedTab ? 1 : undefined)}
        const previousId = getId(isActive?.id)
        const timestamp = previousTabInfo.ended = Date.now()

        if (isActive) onSwitch(isActive?.id, tabSwitchedEvent, {info: previousTabInfo, update: updatedTab})

        const previousVisit = {
            id: previousId,
            tab: previousTabInfo.tab,
        }

        isActive = {
            id,
            timestamp,
            previousVisit
        }
    }
    chrome.tabs.onActivated.addListener((activeInfo) => hasSwitched(activeInfo.tabId))


    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === "complete" && isActive && isActive.id === tabId) hasSwitched(tabId, tab) // Completed an update (refresh / redirect) and the same tab is open
    })
}


