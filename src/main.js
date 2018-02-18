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

function readConfig(mpEndpoint, token, key) {
    const params = new URLSearchParams();
    params.append('q', 'config');
    const req = new Request(mpEndpoint + '?' + params.toString(), {
        method: 'GET',
        mode: 'cors',
        headers: {
            'Authorization': `Bearer ${token}`,
        }
    });
    return fetch(req).then(response => response.json()).then(_config => {
        localStorage.setItem(key, JSON.stringify(_config));
        return _config
    });
}


function micropubConfig(mpEndpoint, token) {
    const key = "mpConfig:" + mpEndpoint;
    const config = localStorage.getItem(key);
    const parsedConfig = !!config?JSON.parse(config):{};

    if (navigator.onLine) {
        return readConfig(mpEndpoint, token, key).catch(() => parsedConfig);
    }
    if (!!config) {
        return new Promise(resolve => resolve(parsedConfig));
    } else {
        return readConfig(mpEndpoint, token, key).catch(() => parsedConfig);
    }
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

const LastScreen = {
    key: 'lastScreen',
    set(screenName){
        localStorage.setItem(LastScreen.key, screenName)
    },
    get(){
        return localStorage.getItem(LastScreen.key) || 'newPostSection';
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


async function addToQueue(message) {
    let registry = undefined;
    try {
        registry = await navigator.serviceWorker.ready;
    } catch(err) {
        // Service worker not ready :( - Firefox
    }
    try {
        const outbox = await store.outbox('readwrite');
        await outbox.put(message);
    } catch(err) {
        // Something happened, this most likelyt is Firefox's error:
        // https://github.com/jakearchibald/idb/issues/42
        // https://bugzilla.mozilla.org/show_bug.cgi?id=1383029
        // We either drop all the idb niceness and rewrite indexedBD usage
        // or plain don't support offline msg queuing on Firefox.
        let req = message.request;
        req.body = message.formData?prepareFormData(message.body):req.body;
        return fetch(message.endpoint, message.request).then(
            resp => resp.headers.get('Location')
        );
    }
    if (navigator.onLine) {  // Online, prune immediately
        const newPostUrls = await pruneQueue();
        return newPostUrls[0];
    } else {  // Offline, we sync it if we can. Still message has been queued
        if (!!registry && 'sync' in registry) {
            registry.sync.register('outbox'); // Triggers pruneQueue
        }
        return 'Entry queued';
    }
}


function publishContent(endpoint, token, content) {
    const msg = {
        endpoint,
        formData: true,
        body: content,
        request: {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Authorization': `Bearer ${token}`,
            }
        }
    };
    return addToQueue(msg);
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
    }).then(
        r => r.json()
    ).catch(err => {
        console.log("Could not retrieve media list", err.message);
        return [];
    });
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


const baseEditor = {
    props: ['micropuburl', 'token', 'config'],
    data() {
        return {
            postImages: [],
            postBody: "",
            postTitle: "",
            postType: "entry",
            postURL: "",
            showOverlay: false,
            syndicateTo: [],
            previewImg: null
        }
    },
    mounted() {
        autosize(this.$refs.postBody);
    },
    computed: {
        syndication() {
            const config = this.config || {};
            const syndicationTargets = config['syndicate-to'] || [];
            return {
                syndicationTargets: syndicationTargets,
                hasSyndicationTargets: syndicationTargets.length > 0,
            }
        }
    },
    methods: {
        loadFile(files) {
            if (files.length > 0) {
                this.postImages = [...files];
            } else {
                this.postImages = [];
            }
        },
        asDataUrl(imgFile) {
            return URL.createObjectURL(imgFile);
        },
        buildData(){
            return {
                title: this.postTitle,
                body: this.postBody,
                type: this.postType,
                images: this.postImages,
                syndicateTo: this.syndicateTo,
                published: new Date().toISOString()
            };
        },
        isEmpty(){
            return (!this.postTitle && !this.postBody && this.postImages.length === 0)
        },
        submitPost() {
            if (this.isEmpty()) return;
            this.showOverlay = true;
            const data = this.buildData();
            Vue.nextTick().then(
                () => publishContent(this.micropuburl, this.token, data)
            ).then(postURL => {
                this.clearFields();
                this.postURL = postURL;
                this.$refs.postBody.style.height = 0; // Resets textarea height
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
            this.postImages = [];
            if (!!this.$refs.fileField)
                this.$refs.fileField.value = '';
        }
    }
};


let newPostComponent = Object.create(baseEditor);
newPostComponent.template = '#newPostEditor';
let quickNoteComponent = Object.create(baseEditor);
quickNoteComponent.template = '#quickNoteEditor';

let replyToComponent = Object.create(baseEditor);
replyToComponent.template = '#replyEditor';
replyToComponent.methods = Object.assign({}, baseEditor.methods);
replyToComponent.methods.buildData = function() {
    return {
        replyTo: this.postTitle,
        body: this.postBody,
        type: this.postType,
        syndicateTo: this.syndicateTo,
        published: new Date().toISOString()
    };
};
let shareLinkComponent = Object.create(baseEditor);
shareLinkComponent.template = '#shareLinkEditor';
shareLinkComponent.methods = Object.assign({}, baseEditor.methods);
shareLinkComponent.methods.buildData = function() {
    return {
        bookmark: this.postTitle,
        body: this.postBody,
        type: this.postType,
        syndicateTo: this.syndicateTo,
        published: new Date().toISOString()
    };
};

let likeComponent = Object.create(baseEditor);
likeComponent.template = '#likeEditor';
likeComponent.methods = Object.assign({}, baseEditor.methods);
likeComponent.methods.buildData = function() {
    return {
        like: this.postTitle,
        body: this.postBody,
        type: this.postType,
        syndicateTo: this.syndicateTo,
        published: new Date().toISOString()
    };
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
            if (this.postEditUrl === '') return;
            this.showOverlay = true;
            sourcePostProperties(this.micropuburl, this.token, this.postEditUrl).then(postAttrs => {
                this.postBody = postAttrs.content;
                this.postTitle = postAttrs.title
            }).then(() => {
                this.showOverlay = false;
                this.editing = true;
                this.editSuccess = false;
            }).catch(() => {
                this.showOverlay = false;
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
    props: ['token', 'mediaurl', 'expanded'],
    data() {
        return {
            fileList: [],
            mediaFiles: []
        }
    },
    methods: {
        discover(){
            if (!!this.mediaurl) {
                getMediaList(this.mediaurl, this.token).then(fileList => {
                    this.fileList = fileList
                });
            }
        },
        loadFiles(files) {
            [...files].forEach(f => this.mediaFiles.push(f));
        },
        uploadFiles(){
            uploadMedia(this.mediaurl, this.token, this.mediaFiles).then(() => {
                this.discover();
                this.$refs.fileField.value = '';
            }).catch(
                () => alert("Could not upload file. Server probably unavailable")
            );
        },
        copyContent(el) {
            el.select();
            document.execCommand('copy');
        },
        toggleItem(el) {
            el = el.nodeName === 'IMG'?el.parentElement:el;
            if (el.nodeName !== 'LI') return;
            [...document.querySelectorAll('li.extended')].filter(
                _el => !_el.isEqualNode(el)
            ).forEach(
                _el => _el.classList.remove('extended'));
            el.classList.toggle('extended');
        }
    }
};

const pendingQueueComponent = {
    template: '#postsQueue',
    data() {
        return {
            msgQueue: []
        }
    },
    methods: {
        refresh() {
            store.outbox('readonly').then(outbox => {
                outbox.getAll().then(messages => messages.map(msg => {
                    return {
                        title: msg.body.title,
                        preview: msg.body.body.substring(0, 75),
                        published: msg.body.published,
                        id: msg.id,
                        totalImages: msg.body.images.length
                    }
                })).then(msgs => {
                    this.msgQueue = msgs
                });
            });
        },
        async deleteMsg(msgId) {
            if (confirm("Delete this message?")) {
                const outbox = await store.outbox('readwrite');
                await outbox.delete(msgId);
                this.refresh();
            }
        },
        sendAll() {
            pruneQueue().then(() => this.refresh());
        }
    },
    mounted(){
        this.refresh();
    }
};

const mainApp = new Vue({
    el: '#mainApp',
    data: {
        config: null,
        currentScreen: '',
        token: null,
        mediaurl: null,
        siteUrl: null,
        micropuburl: null,
        mediaExpanded: false,
        showSidebar: false
    },
    computed: {
        mediaChevron(){
            return {
                'fa fa-chevron-right': !this.mediaExpanded,
                'fa fa-chevron-down': this.mediaExpanded
            }
        },
        isEditorScreen() {
            const editorScreens = [
                'newPostSection', 'editPostSection', 'quickNoteSection',
                'replySection', 'shareLinkSection', 'likeSection'
            ];
            return editorScreens.includes(this.currentScreen);
        },
        online() {
            return navigator.onLine;
        },
        displayChrome(){
            return this.currentScreen !== 'authSection'
        }
    },
    methods: {
        resetApp(){
            if (confirm("Clear local storage?")) {
                localStorage.clear();
                console.log('localStorage cleared');
                this.requestAuth();
            }
        },
        reload(){
            window.location.reload();
        },
        resetFields(){
            this.token = null;
            this.siteUrl = null;
            this.mediaurl = null;
            this.micropuburl = null;
        },
        requestAuth(){
            this.currentScreen = 'authSection';
            this.resetFields()
        },
        setupMp(auth) {
            if (!!this.token) return;
            this.token = auth.token;
            this.siteUrl = auth.siteUrl;
            return discoverLink(auth.siteUrl, "micropub").then(mpUrl => {
                this.micropuburl = mpUrl;
                return micropubConfig(mpUrl, auth.token);
            }).then(config => {
                this.config = config;
                this.mediaurl = config['media-endpoint'];
            }).then(() => this.$refs.media.discover());
        },
        negotiateCode(siteUrl, code) {
            return discoverLink(siteUrl, "token_endpoint").then(
                tokenEndpoint => obtainToken(code, tokenEndpoint)
            ).then(token => {
                TokenManager.store(siteUrl, token);
                this.initEditor({
                    siteUrl,
                    token
                });
            });
        },
        initEditor(auth){
            this.currentScreen = LastScreen.get();
            return this.setupMp(auth)
        },
        showAuth() {
            this.currentScreen = 'authSection';
        },
        signOut(){
            CurrentBlog.clear();
            this.requestAuth();
        },
        toggleOptions(){
            this.showSidebar = !this.showSidebar;
        },
        triggerMenu(screen) {
            this.currentScreen = screen;
            this.showSidebar = false;
            const savedScreens = ['newPostSection', 'quickNoteSection'];
            if (savedScreens.includes(screen)) {
                LastScreen.set(screen)
            }
            if (screen === 'msgQueueSection') {
                this.$refs.queue.refresh();
            }
        }}

    ,
    components: {
        'new-post': newPostComponent,
        'edit-post': editPostComponent,
        'auth-form': authComponent,
        'media-manager': mediaComponent,
        'quick-note': quickNoteComponent,
        'reply-to': replyToComponent,
        'share-link': shareLinkComponent,
        'like-page': likeComponent,
        'msg-queue': pendingQueueComponent
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
            TokenManager.get(siteUrl).then(token => mainApp.initEditor({
                siteUrl,
                token
            })).then(() => CurrentBlog.set(siteUrl));
        } else {
            mainApp.showAuth();
        }
    }
}

init();