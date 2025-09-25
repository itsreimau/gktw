"use strict";

const EventEmitter = require("node:events");
const { Collection } = require("@discordjs/collection");

class Collector extends EventEmitter {
    constructor(options = {
        filter: () => {
            throw new Error("Function not implemented.");
        },
        time: 0,
        max: 0,
        maxProcessed: 0,
        hears: []
    }) {
        super();
        this.isRun = false;
        this.filter = options.filter ?? (() => true);
        this.time = options.time;
        this.max = options.max;
        this.maxProcessed = options.maxProcessed;
        this.hears = options.hears || [];
        this.collector = new Collection();
        this.collect = this.collect.bind(this);

        if (this.isRun) throw new Error("Some collector already run in another instance.");
        if (typeof this.filter !== "function") throw new Error("Filter options in collector must be function.");
        if (options.time) this.isRun = setTimeout(() => this.stop(), this.time);
    }

    async collect(m) {
        const args = await this._collect(m);
        if (!args) return;

        const filtered = await this.filter(args, this.collector);
        if (!filtered) return;

        if (this.maxProcessed && this.maxProcessed === this.received) return this.stop("processedLimit");
        if (this.max && this.max <= this.collector.size) return this.stop("limit");

        if (this.isRun) {
            this.collector.set(args.jid, args);
            this.emit("collect", args);
        }
    }

    stop(reason = "timeout") {
        if (this.isRun) {
            clearTimeout(this.isRun);
            this.isRun = undefined;
            this.emit("end", this.collector, reason);
        }
    }
}

module.exports = Collector;