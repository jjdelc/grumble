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


const TokenManager = {
    key: "accessToken:",
    get: url => {
        const key = TokenManager.key + url;
        const accessToken = localStorage.getItem(key);
        return new Promise((resolve, reject) => {
            if (!!accessToken) {
                resolve(accessToken);
            } else {
                reject();
            }
        });
    },
    store: (url, accessToken) => {
        const key = TokenManager.key + url;
        localStorage.setItem(key, accessToken);
    }
};


function obtainToken(code, tokenEndpoint) {
    const data = new FormData();
    data.append('code', code);
    data.append('client_id', "http://localhost:4321");
    data.append('redirect_uri', "http://localhost:4321");
    data.append('grant_type',"authorization_code");
    const req = new Request(tokenEndpoint, {
        method: 'POST',
        body: data,
        mode: 'cors'
    });
    return fetch(req).then(response => response.json()).then(r => {
        return r.access_token
    });
}


function setUpMedia(mediaEndpoint, w) {
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
}

function startEditor(siteUrl, token, w) {
    w.authSection.style.display = 'none';
    w.postSection.style.display = 'block';
    w.tokenField.value = token;
    discoverLink(siteUrl, "micropub").then(mpUrl => {
        w.micropubForm.action = mpUrl;
        return mpUrl
    }).then(
        mpUrl => micropubConfig(mpUrl, token)
    ).then(config => {
        setUpMedia(config['media-endpoint'], w);
    })
}

function startAuthDance(siteUrl, w) {
    discoverLink(siteUrl, "authorization_endpoint").then(authEndpoint => {
        w.authForm.action = authEndpoint;
        w.authForm.submit();
    })
}

function editorScreen(me, code, w) {
    discoverLink(me, "token_endpoint").then(
        tokenEndpoint => obtainToken(code, tokenEndpoint)
    ).then(accessToken => {
        TokenManager.store(me, accessToken);
        startEditor(me, accessToken, w);
    }, error => {
        alert(error);
        w.postSection.style.display = 'none';
    });
}


function authScreen(w) {
    w.authForm.onsubmit = function(evt){
        evt.preventDefault();
        const siteUrl = w.indie_auth_url.value;
        TokenManager.get(siteUrl).then(
            token => startEditor(siteUrl, token, w)
        ).catch(
            () => startAuthDance(siteUrl, w)
        );
        return false;
    }
}


(function(w){
    const params = new URLSearchParams(w.location.search);
    const code = params.get('code');
    if (!!code) {
        w.authSection.style.display = 'none';
        editorScreen(params.get('me'), code, w);
    } else {
        authScreen(w);
    }

    w.resetApp.onclick = () => localStorage.clear()
})(window);
