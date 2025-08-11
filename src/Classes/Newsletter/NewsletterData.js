"use strict";

class NewsletterData {
    constructor(ctx, jid) {
        this.ctx = ctx;
        this.jid = jid;
    }

    async updateDescription(description) {
        return await this.ctx._client.newsletterUpdateDescription(this.jid, description);
    }

    async react(description, key, emoji) {
        return await this.ctx._client.newsletterReactMessage(this.jid, key, emoji);
    }
}

module.exports = NewsletterData;