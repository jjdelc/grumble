const store = {
  db: null,
  init() {
    if (store.db) {
        return Promise.resolve(store.db);
    }
    return idb.open('messages', 1, upgradeDb =>
        upgradeDb.createObjectStore('outbox', {
            autoIncrement : true,
            keyPath: 'id'
        })
    ).then(
        db => store.db = db
    );
  },
  outbox(mode) {
    return store.init().then(
        db => db.transaction('outbox', mode).objectStore('outbox')
    )
  }
};


function prepareFormData(content) {
    const data = new FormData();
    if (!!content.replyTo) {
        data.append('in-reply-to', content.replyTo);
    }
    if (!!content.title) {
        data.append('name', content.title);
    }
    if (!!content.bookmark) {
        data.append('bookmark-of', content.bookmark);
    }
    if (!!content.like) {
        data.append('like-of', content.like);
    }
    if (!!content.rsvp) {
        data.append('rsvp-of', content.rsvp);
    }
    data.append('content', content.body);
    data.append('h', content.type);
    data.append('published', content.published || (new Date()).toISOString());
    (content.images || []).forEach(img => data.append('photo', img));
    (content.videos || []).forEach(vid => data.append('video', vid));
    content.syndicateTo.forEach(
        targetUid => data.append('mp-syndicate-to', targetUid)
    );
    return data;
}


async function pruneQueue() {
    const outbox = await store.outbox('readonly');
    const messages = await outbox.getAll();
    const urlPromises = messages.map(msg => {
        let req = msg.request;
        // Some messages need to get the FormData body
        req.body = msg.formData?prepareFormData(msg.body):req.body;
        return fetch(msg.endpoint, msg.request).then(async resp => {
            // On successful submit delete the message
            await store.outbox('readwrite').then(ob => ob.delete(msg.id));
            return resp.headers.get('Location');
        }).catch(err => {
            // There was n error with this post, server didn't like it.
            // then keep it, "handle" the error and carry on with the next msg.
            console.log(err);
        });
    });
    return Promise.all(urlPromises);
}