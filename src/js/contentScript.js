
// Use content scripts to inject scripts into the page
const injectedScripts = ['js/injected.js']

const el = document.head||document.documentElement

const inject = (uri) => {
  var script = document.createElement('script'); 
  script.src = chrome.runtime.getURL(uri);
  script.type = "module";
  el.appendChild(script);
}

injectedScripts.forEach(inject)