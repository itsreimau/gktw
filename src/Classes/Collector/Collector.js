const EventEmitter = require("node:events");

class Collector extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.isRun = false;
        this.filter = opts.filter ?? (() => true);
        this.time = opts.time ?? 0;
        this.max = opts.max ?? 0;
        this.maxProcessed = opts.maxProcessed ?? 0;
        this.collector = new Map();
        this.received = 0;

        if (typeof this.filter !== "function") throw new Error("Filter options in collector must be function.");

        this.collect = this.collect.bind(this);
        this.stop = this.stop.bind(this);

        if (this.time && this.time > 0) this.isRun = setTimeout(() => this.stop("timeout"), this.time);
    }

    async collect(m) {
        if (!this.isRun) return;

        const args = await this._collect(m);
        if (!args) return;

        const filtered = await this.filter(args, this.collector);
        if (!filtered) return;

        this.received++;

        if (this.maxProcessed && this.received >= this.maxProcessed) return this.stop("processedLimit");
        if (this.max && this.collector.size >= this.max) return this.stop("limit");

        this.collector.set(args.id, args);
        this.emit("collect", args);
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