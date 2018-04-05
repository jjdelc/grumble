# Grumble Micropub client

A client side only [Micropub](https://www.w3.org/TR/micropub/) client.
Installation only requires to deploy the files in a static web server.

Current working client at https://grumble.isgeek.net/

## Features

 * Indieauth login
 * Offline posting support
 * Installable as a phone app
 * Syndication
 * Media endpoint support
 * Like/Bookmark/Reply support

 ## Caveats

Since this is a full client side client, it requires a few resources to support
CORS:
   * Micropub endpoint
   * You Indieauth page (where to discover the `authorization_url`)
   * Media endpoint

Offline support only available for Chrome, Firefox has an
[IndexDB bug](https://bugzilla.mozilla.org/show_bug.cgi?id=1383029))


## Tools used

* VueJS
* [Jake Archivald's IDB](https://github.com/jakearchibald/idb)
* UpUp

## Screenshots


Main composer

![Main composer](res/composer-main.png)

Reply screen

![Reply interface](res/composer-reply.png)

Quick notes - Tweet like

![Quick notes](res/composer-quick.png)

Options menu

![Options menu](res/composer-menu.png)