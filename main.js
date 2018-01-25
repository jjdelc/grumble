function discoverLink(url, linkName) {
    const key = "urlDiscoveredLinks:" + url;
    const readLinks = localStorage.getItem(key);
    if (!!readLinks) {
        return new Promise(resolve => resolve(JSON.parse(readLinks)[linkName]));
    } else {
        const siteReq = new Request(url, {
            method: 'GET',
            mode: 'cors'
        });
        return fetch(siteReq).then(response => response.text()).then(bodyHTML => {
            const rBody = document.createElement('html');
            rBody.innerHTML = bodyHTML;
            let readLinks = {};
            [...rBody.getElementsByTagName('link')].forEach(lnk => {
                readLinks[lnk.rel] = lnk.href
            });
            localStorage.setItem(key, JSON.stringify(readLinks));
            return readLinks[linkName];
        });
    }
}

function micropubConfig(mpEndpoint, token) {
    const params = new URLSearchParams();
    params.append('q', 'config');
    params.append('access_token', token);
    const req = new Request(mpEndpoint + '?' + params.toString(), {
        method: 'GET',
        mode: 'cors',
    });
    return fetch(req).then(response => response.json());
}

function getAccessToken(url) {
    const key = "accessToken:" + url;
    const accessToken = localStorage.getItem(key);
    return new Promise((resolve, reject) => {
        if (!!accessToken) {
            resolve(accessToken);
        } else {
            reject();
        }
    });
}

function startEditor(siteUrl, token, w) {
    w.authScreen.style.display = 'none';
    w.postScreen.style.display = 'block';
    discoverLink(siteUrl, "micropub").then(mpUrl => {
        w.tokenField.value = token;
        w.micropubForm.action = mpUrl;
        micropubConfig(mpUrl, token).then(config => {
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
}

function startAuthDance(siteUrl, w) {
    discoverLink(siteUrl, "authorization_endpoint").then(authEndpoint => {
        w.authForm.action = authEndpoint;
        w.authForm.submit();
    })
}

(function(w){
  const params = new URLSearchParams(w.location.search);
  const code = params.get('code');
  if (!!code) {
    const data = new FormData();
    data.append('code', code);
    data.append('client_id', "http://localhost:4321");
    data.append('redirect_uri', "http://localhost:4321");
    data.append('grant_type',"authorization_code");

    discoverLink(params.get('me'), "token_endpoint").then(tokenEndpoint => {
        const req = new Request(tokenEndpoint, {
          method: 'POST',
          body: data,
          mode: 'cors'
        });
        fetch(req).then(response => response.json()).then(r => {
            const key = "accessToken:" + r.me;
            localStorage.setItem(key, r.access_token);
            startEditor(r.me, r.access_token, w);
        }, error => {
            alert(error);
            w.postScreen.style.display = 'none';
        });
    });
  } else {
      w.authForm.onsubmit = function(evt){
        evt.preventDefault();
        const siteUrl = w.indie_auth_url.value;
        getAccessToken(siteUrl).then(
            token => startEditor(siteUrl, token, w)
        ).catch(function(err) {
            startAuthDance(siteUrl, w);
        });
        return false;
      }
  }

  w.reset.click = () => localStorage.clear();
})(window);
