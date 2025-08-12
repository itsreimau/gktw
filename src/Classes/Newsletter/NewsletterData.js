"use strict";

class NewsletterData {
    constructor(ctx, jid) {
        this.ctx = ctx;
        this.jid = jid;
    }

    async metadata() {
        return await this.ctx._client.newsletterMetadata("jid", this.jid);
    }

    async updateName(name) {
        return await this.ctx._client.newsletterUpdateName(this.jid, name);
    }

    async updateDescription(description) {
        return await this.ctx._client.newsletterUpdateDescription(this.jid, description);
    }

    async updatePicture(buffer) {
        return await this.ctx._client.newsletterUpdatePicture(this.jid, buffer);
    }

    async removePicture() {
        return await this.ctx._client.newsletterRemovePicture(this.jid);
    }

    async react(key, emoji) {
        return await this.ctx._client.newsletterReactMessage(this.jid, key, emoji);
    }
}

module.exports = NewsletterData;