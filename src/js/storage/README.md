This was adapted from [graphscript] files for using BrowserFS to store CSV files.

To get this to work, we had to: 
1. Convert all `.ts` files to `.js` files
2. Ensure that all imports are appendd with `.js`
3. Package `browserfs` as an ES Module and change its import style from **namespace** to **default**