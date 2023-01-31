const list = document.querySelector('ul');

const send = async (o) => {
    const id = Math.random().toString(36).substring(7)
    const res = await chrome.runtime.sendMessage({ ...o, id, source: 'mindfuck-newtab-module' })
    return (res && typeof res === 'object') ? res.payload : res
}

// --------------- Show latest tab history ---------------
const res = await send({ command: 'get-tab-history' });
console.log('GOT TAB HISTORY', res)

if (res) Object.values(res).sort((a,b) => Object.values(b.visits).length - Object.values(a.visits).length).forEach(o => {

    const visits = Object.values(o.visits).length
    const item = document.createElement('li');
    item.innerHTML = `<b>${visits}:</b> <a href="${o.hostname}">${o.hostname}</a>`
    list.appendChild(item);
})



// --------------- Create an alarm ---------------
function setAlarm() {
    chrome.action.setBadgeText({text: 'ON'});
    chrome.alarms.create();
    window.close();
  }
  
  function clearAlarm() {
    chrome.action.setBadgeText({text: ''});
    chrome.alarms.clearAll();
    window.close();
  }
  
  //An Alarm delay of less than the minimum 1 minute will fire
  // in approximately 1 minute increments if released
  document.getElementById('triggerAlarm').addEventListener('click', () => send({command: 'create-alarm'}))
  document.getElementById('clearAlarms').addEventListener('click', () => send({command: 'clear-alarms'}))