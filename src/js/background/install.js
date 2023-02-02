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