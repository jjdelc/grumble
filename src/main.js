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
    const req = new Request(mpEndpoint + '?' + params.toString(), {
        method: 'GET',
        mode: 'cors',
        headers: {
            'Authorization': `Bearer ${token}`,
        }
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


function publishContent(endpoint, token, content) {
    const data = new FormData();
    data.append('name', content.title);
    data.append('content', content.body);
    data.append('h', content.type);
    if (!!content.image) {
        data.append('photo', content.image);
    }
    return fetch(endpoint, {
        method: 'POST',
        body: data,
        mode: 'cors',
        headers: {
            'Authorization': `Bearer ${token}`,
        }
    }).then(r => r.headers.get('Location'));
}


function getMediaList(mediaUrl, token) {
    return fetch(mediaUrl, {
        headers: {
            'Authorization': `Bearer ${token}`,
        }
    }).then(r => r.json())
}


function uploadMedia(mediaUrl, token, mediaFiles) {
    const fd = new FormData();
    mediaFiles.forEach(f => fd.append('file', f));
    return fetch(mediaUrl, {
        method: 'POST',
        body: fd,
        mode: 'cors',
        headers: {
            'Authorization': `Bearer ${token}`,
        }
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
                token => this.$emit('authobtained', {
                    token,
                    siteUrl: this.siteUrl
                })
            ).catch(() => {
                discoverLink(siteUrl, "authorization_endpoint").then(
                    authEndpoint => this.authTarget = authEndpoint
                ).then(() => evt.target.submit());
            });
        }
    }
};


const editorComponent = {
    template: '#postEditor',
    props: ['micropuburl', 'token'],
    data() {
        return {
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
                this.postImage = files[0];
            } else {
                this.postImage = null;
            }
        },
        submitPost() {
            publishContent(this.micropuburl, this.token, {
                title: this.postTitle,
                body: this.postBody,
                type: this.postType,
                image: this.postImage
            }).then(postURL => {
                this.clearFields();
                this.postURL = postURL;
            });
        },
        clearFields(){
            this.postBody = "";
            this.postTitle = "";
            this.postURL = "";
            this.postImage = null;
            this.$refs.fileField.value = '';
        }
    }
};


const mediaComponent = {
    template: '#mediaManager',
    props: ['token', 'mediaurl'],
    data() {
        return {
            fileList: [],
            mediaFiles: []
        }
    },
    methods: {
        discover(){
            getMediaList(this.mediaurl, this.token).then(fileList => {
                this.fileList = fileList
            });
        },
        loadFiles(files) {
            [...files].forEach(f => this.mediaFiles.push(f));
        },
        uploadFiles(){
            uploadMedia(this.mediaurl, this.token, this.mediaFiles).then(() => {
                this.discover();
                this.$refs.fileField.value = '';
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
        micropuburl: null,
        mediaExpanded: false,
    },
    computed: {
        mediaChevron(){
            return {
                'fa fa-chevron-right': !this.mediaExpanded,
                'fa fa-chevron-down': this.mediaExpanded
            }
        }
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
            }).then(() => this.$refs.media.discover());
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
        signOut(){
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


function init(){
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    if (!!code) {
        mainApp.negotiateCode(params.get('me'), code);
    } else {
        const siteUrl = CurrentBlog.get();
        if (!!siteUrl) {
            TokenManager.get(siteUrl).then(token => mainApp.showEditor({
                siteUrl,
                token
            }))
        }
    }
}

init();