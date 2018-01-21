function getUrlParams(search) {
  let hashes = search.slice(search.indexOf('?') + 1).split('&')
  return hashes.reduce((params, hash) => {
      let [key, val] = hash.split('=')
      return Object.assign(params, {[key]: decodeURIComponent(val)})
  }, {})
}

function discoverLink(url, linkName) {
    const rels = ['token_endpoint', 'authorization_endpoint', 'micropub'];
    const key = "urlDiscoveredLinks";
    const readLinks = localStorage.getItem(key);
    if (!!readLinks) {
        return new Promise((resolve, reject) => resolve(JSON.parse(readLinks)[linkName]));
    } else {
        const siteReq = new Request(url, {
            method: 'GET',
            mode: 'cors'
        });
        return fetch(siteReq).then(response => response.text()).then(bodyHTML => {
            const rBody = document.createElement('html');
            rBody.innerHTML = bodyHTML;
            const matches = [...rBody.getElementsByTagName('link')].filter(lnk => rels.indexOf(lnk.rel) >= 0);
            let readLinks = {};
            matches.forEach(lnk => {
                readLinks[lnk.rel] = lnk.href
            });
            localStorage.setItem(key, JSON.stringify(readLinks));
            return readLinks[linkName];
        });
    }
}

function micropubConfig(mpEndpoint, token) {
    const req = new Request(mpEndpoint + '?q=config&access_token=' + token, {
        method: 'GET',
        mode: 'cors',
    });
    return fetch(req).then(response => response.json());
}

(function(w){
  const params = getUrlParams(w.location.search);

  if (!!params.code) {
    w.authScreen.style.display = 'none';
    w.postScreen.style.display = 'block';
    const data = new FormData();
    data.append('code', params.code);
    data.append('client_id', "http://localhost:4321");
    data.append('redirect_uri', "http://localhost:4321");
    data.append('grant_type',"authorization_code");

    discoverLink(params.me, "token_endpoint").then(tokenEndpoint => {
        const req = new Request(tokenEndpoint, {
          method: 'POST',
          body: data,
          mode: 'cors'
        });
        fetch(req).then(response => response.json()).then(r => {
            w.tokenField.value = r.access_token;
            discoverLink(r.me, "micropub").then(mpUrl => {
                w.micropubForm.action = mpUrl;
                micropubConfig(mpUrl, r.access_token).then(config => {
                    const mediaEndpoint = config['media-endpoint'];
                    if (!!mediaEndpoint) {
                        console.log("Media endpoint supported");
                        w.mediaForm.style.display = 'block';
                        w.mediaForm.action = mediaEndpoint;
                        w.mediaForm.onsubmit = function(evt){
                            evt.preventDefault();
                            return false;
                        }
                    } else {
                        console.log("No media endpoint, resort to inline upload");
                        w.micropubForm.enctype = "multipart/form-data";
                        w.inlineMediaField.style.display = 'inline-block';
                    }
                })
            });
        }, error => {
            alert(error);
            w.postScreen.style.display = 'none';
        });
    });
  } else {
      w.authForm.onsubmit = function(evt){
        evt.preventDefault();
        discoverLink(w.indie_auth_url.value, "authorization_endpoint").then(authEndpoint => {
              w.authForm.action = authEndpoint;
              w.authForm.submit();
        });
        return false;
      }
  }
})(window);
