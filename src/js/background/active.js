import { tabSwitchedEvent } from "../commands.js";
import { getId } from "./globals.js";

let isActive;

export const listenToActiveTab = (onSwitch) => {
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
        const id = activeInfo.tabId
        const info = isActive ? {...isActive} : {}
        info.nextVisit = {tab: id, id: getId(id)}
        const previousId = getId(isActive?.id)
        const started = info.ended = Date.now()

        if (isActive) onSwitch(isActive?.id, tabSwitchedEvent, info)
        
        isActive = {
            id,
            started,
            previousVisit: previousId
        }
    })
}