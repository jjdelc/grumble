# Grumble Micropub client

A client side only [Micropub](https://www.w3.org/TR/micropub/) client.
Installation only requires to deploy the files in a static web server.

## Features

 * Indieauth login
 * Offline posting support
 * Installable as a phone app
 * Syndication
 * Media endpoint support
 * Like/Bookmark/Reply support

 ## Caveats

 * Offline support only available for Chrome (Firefox has an [IndexDB bug](https://bugzilla.mozilla.org/show_bug.cgi?id=1383029))
 * Micropub endpoint needs to support CORS


## Tools used

* VueJS
* [Jake Archivald's IDB](https://github.com/jakearchibald/idb)
* UpUp