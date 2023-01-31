# mindfuck
 A browser extension for monitoring impulsive behaviors

## Methodology
We will use [ecological momentary assessment](https://www.gov.uk/guidance/ecological-momentary-assessment#:~:text=Ecological%20momentary%20assessments%20(%20EMAs%20)%20study,they%20carry%20out%20that%20behaviour.) to understand an individual's internal sense of impulsivity while browsing.

## Notes
1. [background.js](src/js/background.js) runs on every page.
2. [popup.js](src/js/popup.js) runs on the popup page.
3. [contentScript.js](src/js/contentScript.js) relays messages to other pages.
