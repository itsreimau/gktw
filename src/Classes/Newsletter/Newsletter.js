"use strict";

class Newsletter {
    constructor(ctx) {
        this.ctx = ctx;
    }

    async create(subject) {
        return await this.ctx._client.newsletterCreate(subject);
    }
}

module.exports = Newsletter;