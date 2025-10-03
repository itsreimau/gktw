"use strict";

const EventEmitter = require("node:events");
const { Collection } = require("@discordjs/collection");

class Collector extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.filter = opts.filter ?? (() => true);
        this.time = opts.time;
        this.max = opts.max;
        this.maxProcessed = opts.maxProcessed;
        this.hears = opts.hears || [];
        this.collector = new Collection();
        this.received = 0;

        if (this.time) this.isRun = setTimeout(() => this.stop(), this.time);
    }

    async collect(m) {
        const args = await this._collect(m);
        if (!args) return;

        const filtered = await this.filter(args, this.collector);
        if (!filtered) return;

        this.received++;
        if (this.maxProcessed && this.received === this.maxProcessed) return this.stop("processedLimit");
        this.collector.set(args.jid, args);
        this.emit("collect", args);
        if (this.max && this.collector.size >= this.max) this.stop("limit");
    }

    stop(reason = "timeout") {
        if (this.isRun) {
            clearTimeout(this.isRun);
            this.isRun = null;
            this.emit("end", this.collector, reason);
        }
    }
}

module.exports = Collector;