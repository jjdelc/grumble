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
    data.append('client_id', CLIENT_ID);
    data.append('redirect_uri', REDIRECT_URI);
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

function sourcePostProperties(endpoint, token, postUrl) {
    const qs = new URLSearchParams();
    qs.append('q', 'source');
    qs.append('url', postUrl);

    return fetch(`${endpoint}?` + qs.toString(), {
        mode: 'cors',
        headers: {
            'Authorization': `Bearer ${token}`,
        }
    }).then(r => r.json()).then(attrs => {
        return {
            content: attrs.properties.content[0],
            title: attrs.properties.name[0]
        }
    })
}

function updatePost(endpoint, token, data) {
    const payload = {
        action: 'update',
        url: data.url,
        replace: {
            content: [data.content],
            name: [data.title]
        }
    };
    return fetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
        mode: 'cors',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
}


function getMediaList(mediaUrl, token) {
    return fetch(mediaUrl, {
        headers: {
            'Authorization': `Bearer ${token}`,
        }
    }).then(r => r.json());
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
            clientID: CLIENT_ID,
            redirectURI: REDIRECT_URI
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
            }).then(() => CurrentBlog.set(siteUrl));
        }
    }
};


const newPostComponent = {
    template: '#newPostEditor',
    props: ['micropuburl', 'token'],
    data() {
        return {
            postImage: null,
            postBody: "",
            postTitle: "",
            postType: "entry",
            postURL: "",
            showOverlay: false
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
            this.showOverlay = true;
            Vue.nextTick().then(() => publishContent(this.micropuburl, this.token, {
                title: this.postTitle,
                body: this.postBody,
                type: this.postType,
                image: this.postImage
            })).then(postURL => {
                this.clearFields();
                this.postURL = postURL;
            }).then(() => this.showOverlay = false).catch((err) => {
                this.showOverlay = false;
                return Vue.nextTick().then(() => {
                    console.log(err);
                });
            })
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

const editPostComponent = {
    template: '#editPostEditor',
    props: ['micropuburl', 'token'],
    data() {
        return {
            postEditUrl: "",
            postBody: "",
            postTitle: "",
            postType: "entry",
            showOverlay: false,
            editing: false,
            editSuccess: false
        };
    },
    methods: {
        sourcePost(){
            this.showOverlay = true;
            sourcePostProperties(this.micropuburl, this.token, this.postEditUrl).then(postAttrs => {
                this.postBody = postAttrs.content;
                this.postTitle = postAttrs.title
            }).then(() => {
                this.showOverlay = false;
                this.editing = true;
                this.editSuccess = false;
            });
        },
        editPost(){
            this.showOverlay = true;
            updatePost(this.micropuburl, this.token, {
                title: this.postTitle,
                content: this.postBody,
                url: this.postEditUrl
            }).then(() => {
                this.showOverlay = false;
                this.editSuccess = true
            }).catch(err => {
                this.showOverlay = false;
            })
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
        newPostComposer(auth){
            this.currentScreen = 'newPostSection';
            return this.setupMp(auth);
        },
        editPostComposer(auth){
            this.currentScreen = 'editPostSection';
            return this.setupMp(auth);
        },
        setupMp(auth) {
            if (!!this.token) return;
            this.token = auth.token;
            this.siteUrl = auth.siteUrl;
            return discoverLink(auth.siteUrl, "micropub").then(mpUrl => {
                this.micropuburl = mpUrl;
                return micropubConfig(mpUrl, auth.token);
            }).then(config => {
                this.mediaurl = config['media-endpoint'];
            }).then(() => this.$refs.media.discover());
        },
        negotiateCode(siteUrl, code) {
            return discoverLink(siteUrl, "token_endpoint").then(
                tokenEndpoint => obtainToken(code, tokenEndpoint)
            ).then(token => {
                TokenManager.store(siteUrl, token);
                this.newPostComposer({
                    siteUrl,
                    token
                });
            });
        },
        switchScreen(){
            if (this.currentScreen === 'newPostSection') {
                this.currentScreen = 'editPostSection';
            } else {
                this.currentScreen = 'newPostSection';
            }
        },
        signOut(){
            CurrentBlog.clear();
            this.requestAuth();
        }
    },
    components: {
        'new-post': newPostComponent,
        'edit-post': editPostComponent,
        'auth-form': authComponent,
        'media-manager': mediaComponent
    }
});


function init(){
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    if (!!code) {
        mainApp.negotiateCode(params.get('me'), code).then(
            () => CurrentBlog.set(params.get('me'))
        );
    } else {
        const siteUrl = CurrentBlog.get();
        if (!!siteUrl) {
            TokenManager.get(siteUrl).then(token => mainApp.newPostComposer({
                siteUrl,
                token
            })).then(() => CurrentBlog.set(siteUrl));
        }
    }
}

init();