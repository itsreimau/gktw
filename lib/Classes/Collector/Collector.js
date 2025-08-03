"use strict";

const EventEmitter = require("events");
const {
    Collection
} = require("@discordjs/collection");

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

        if (this.isRun) throw new Error("Some collector already run in another instance.");

        if (typeof this.filter !== "function") throw new Error("Filter options in collector must be function.");

        this.time = options.time;
        this.max = options.max;
        this.maxProcessed = options.maxProcessed;
        this.hears = options.hears || [];
        this.collector = new Collection();
        this.collect = this.collect.bind(this);

        if (options.time) this.isRun = setTimeout(() => this.stop(), this.time);
    }

    async collect(t) {
        const args = await this._collect(t);
        if (!args) return;

        if (this.maxProcessed && this.maxProcessed === this.received) {
            this.stop("processedLimit");
            return;
        }

        const filtered = await this.filter(args, this.collector);
        if (!filtered) return;

        if (this.max && this.max <= this.collector.size) {
            this.stop("limit");
            return;
        }

        if (this.isRun) {
            this.collector.set(args.jid, args);
            this.emit("collect", args);
        }
    }

    stop(r = "timeout") {
        if (this.isRun) {
            clearTimeout(this.isRun);
            this.isRun = undefined;
            this.emit("end", this.collector, r);
        }
    }
}

module.exports = Collector;