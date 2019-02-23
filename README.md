# Grumble Micropub client

A client side only [Micropub](https://www.w3.org/TR/micropub/) client.
Installation only requires to deploy the files in a static web server.

Current working client at https://grumble.isgeek.net/

## Features

 * Indieauth login
 * Offline post support (with queue for sending later)
 * Installable as a phone app
 * Syndication
 * Media endpoint support
 * Like/Bookmark/Reply support
 * Posts videos/photos
 * Form-encoded syntax

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


# Installation

## Serve the files statically

Just host the files anywhere that they can be served statically. This is
an example Nginx configuration.

```

server {
    listen 443 ssl http2;
    listen [::]:443  ssl http2;
    server_name grumble.isgeek.net;

    location ~ ^/favicon\.(\w+)$ {
        alias /path/grumble/src/favicon.png;
    }
    location / {
        root /path/grumble/src/;
    }
}
```

## Add `client.js`

It is necessary to teach Grumble where it is being served from. You need to
create a `client.js` file that gets served from the document root declaring
two constants `CLIENT_ID` and `REDIRECT_URI`. 

```
const CLIENT_ID = "https://grumble.isgeek.net";
const REDIRECT_URI = "https://grumble.isgeek.net";
```

It's also perfectly fine to host on S3.


## Blog setup

Remember that you need to enable CORS on your identification URL. This is 
how I do it on Nginx.

```
    location / {
        add_header 'Access-Control-Allow-Origin' '*';
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
    }
```
