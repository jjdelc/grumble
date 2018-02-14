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
    data.append('content', content.body);
    data.append('h', content.type);
    data.append('published', content.published || (new Date()).toISOString());
    (content.images || []).forEach(img => data.append('photo', img));
    content.syndicateTo.forEach(
        targetUid => data.append('mp-syndicate-to', targetUid)
    );
    return data;
}

function pruneQueue() {
    return store.outbox('readonly').then(
        outbox => outbox.getAll()
    ).then(
        messages => Promise.all(messages.map(
            msg => {
                let req = msg.request;
                // Some messages need to get the FormData body
                req.body = msg.formData?prepareFormData(msg.body):req.body;
                // On successful submit delete the message
                return fetch(msg.endpoint, msg.request).then(
                    () => store.outbox('readwrite')
                ).then(
                    outbox => outbox.delete(msg.id)
                );
            }
        ))
    ).catch(
        err => console.error(err)
    )
}