export const injectScript = (id, file) => {
    return new Promise((resolve) => chrome.scripting.executeScript({
        target : {tabId : id},
        files : [ file ],
        })
        .then(resolve)
    )
}