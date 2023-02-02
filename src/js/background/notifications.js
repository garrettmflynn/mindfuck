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
  