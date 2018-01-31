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

const CurrentBlog = {
    key: 'currentBlog',
    clear(){
        localStorage.removeItem(CurrentBlog.key);
    },
    set(siteUrl){
        localStorage.setItem(CurrentBlog.key, siteUrl)
    },
    get(){
        return localStorage.getItem(CurrentBlog.key)
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


const authComponent = {
    template: '#authComponent',
    data() {
        return {
            siteUrl: "",
            authTarget: "",
        }
    },
    methods: {
        authSite(evt){
            const siteUrl = this.siteUrl;
            return TokenManager.get(siteUrl).then(
                token => {
                    this.$emit('authobtained', {
                        token,
                        siteUrl: this.siteUrl
                    });
                }
            ).catch(() => {
                discoverLink(siteUrl, "authorization_endpoint").then(
                    authEndpoint => this.authTarget = authEndpoint
                ).then(
                    () => evt.target.submit()
                )
            });
        }
    }
};


const editorComponent = {
    template: '#postEditor',
    props: ['micropuburl', 'token'],
    data() {
        return {
            //micropuburl: this.micropuburl,
            //token: this.token,
            postImage: null,
            postBody: "",
            postTitle: "",
            postType: "entry",
            postURL: "",
        }
    },
    methods: {
        loadFile(files) {
            if (files.length > 0) {
                this.postImage = files[0]
            } else {
                this.postImage = null;
            }
        },
        submitPost() {
            console.log(this);
            console.log(this.postTitle);
            console.log(this.micropuburl);
            console.log(this.token);
            const data = new FormData();
            data.append('name', this.postTitle);
            data.append('content', this.postBody);
            data.append('access_token', this.token);
            data.append('h', this.postType);
            if (!!this.postImage) {
                data.append('photo', this.postImage);
            }
            const request = new Request(this.micropuburl, {
                method: 'POST',
                body: data,
                mode: 'cors'
            });
            fetch(request).then(r => this.postURL = r.headers['Location']);
        }
    }
};


const mediaComponent = {
    template: '#mediaManager',
    props: ['token', 'mediaurl'],
    data() {
        return {
            token: this.token,
            mediaurl: this.mediaurl,
            fileList: [],
            mediaFiles: []
        }
    },
    methods: {
        discover(mediaUrl, token){
            console.log(this);
            const params = new URLSearchParams();
            params.append('access_token', token);
            fetch(mediaUrl + '?' + params.toString()).then(
                r => r.json()
            ).then(fileList => {
                this.fileList = fileList
            });
        },
        loadFiles(files) {
            [...files].forEach(f => this.mediaFiles.push(f));
        },
        uploadFiles(){
            const fd = new FormData();
            fd.append('access_token', this.token);
            this.mediaFiles.forEach(f => fd.append('file', f));
            const req = new Request(this.mediaurl, {
                method: 'POST',
                body: fd,
                mode: 'cors'
            });
            fetch(req).then(() => {
                this.discover(this.mediaurl, this.token);
            });
        }
    }
};

const mainApp = new Vue({
    el: '#mainApp',
    data: {
        currentScreen: 'authSection',
        token: null,
        mediaurl: null,
        siteUrl: null,
        micropuburl: null
    },
    methods: {
        resetApp(){
            localStorage.clear();
            console.log('localStorage cleared');
        },
        reset(){
            this.token = null;
            this.siteUrl = null;
            this.mediaurl = null;
            this.micropuburl = null;
        },
        requestAuth(){
            this.currentScreen = 'authSection';
            this.reset()
        },
        showEditor(auth){
            this.token = auth.token;
            this.currentScreen = 'editorSection';
            this.siteUrl = auth.siteUrl;
            discoverLink(auth.siteUrl, "micropub").then(mpUrl => {
                this.micropuburl = mpUrl;
                return micropubConfig(mpUrl, auth.token);
            }).then(config => {
                this.mediaurl = config['media-endpoint'];
                this.$refs.media.discover(this.mediaurl, this.token);
            });
            CurrentBlog.set(auth.siteUrl);
        },
        negotiateCode(siteUrl, code) {
            discoverLink(siteUrl, "token_endpoint").then(
                tokenEndpoint => obtainToken(code, tokenEndpoint)
            ).then(token => {
                TokenManager.store(siteUrl, token);
                this.showEditor({
                    siteUrl,
                    token
                });
            });
        },
        goHome(){
            CurrentBlog.clear();
            this.requestAuth();
        }
    },
    components: {
        'post-editor': editorComponent,
        'auth-form': authComponent,
        'media-manager': mediaComponent
    }
});


const params = new URLSearchParams(location.search);
const code = params.get('code');
if (!!code) {
    mainApp.negotiateCode(params.get('me'), code);
} else {
    const siteUrl = CurrentBlog.get();
    if (!!siteUrl) {
        TokenManager.get(siteUrl).then(token => mainApp.showEditor({
            siteUrl: siteUrl,
            token
        }))
    }
}