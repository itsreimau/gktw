"use strict";

class Newsletter {
    constructor(ctx) {
        this.ctx = ctx;
    }

    async metadata(code) {
        return await this.ctx._client.newsletterMetadata("invite", code);
    }

    async mute(jid) {
        return await this.ctx._client.newsletterMute(jid);
    }

    async unmute(jid) {
        return await this.ctx._client.newsletterUnmute(jid);
    }

    async create(subject) {
        return await this.ctx._client.newsletterCreate(subject);
    }

    async delete(jid) {
        return await this.ctx._client.newsletterDelete(jid);
    }

    async follow(jid) {
        return await this.ctx._client.newsletterFollow(jid);
    }

    async unfollow(jid) {
        return await this.ctx._client.newsletterUnfollow(jid);
    }
}

module.exports = Newsletter;