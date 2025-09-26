"use strict";

const vCard = require("vcard-parser");

class VCardBuilder {
    constructor(opts) {
        this.fullName = opts?.fullName || null;
        this.org = opts?.org || null;
        this.number = opts?.number || null;
    }

    setFullName(fullName) {
        if (!fullName) throw new Error("Need full name.");
        this.fullName = fullName;
        return this;
    }

    setOrg(org) {
        if (!org) throw new Error("Need organization name.");
        this.org = org;
        return this;
    }

    setNumber(number) {
        if (!number) throw new Error("Need number.");
        this.number = number;
        return this;
    }

    build() {
        const cleanNumber = this.number.replace(/\s/g, "");
        const card = {
            version: [{
                value: "3.0"
            }],
            fn: [{
                value: this.fullName
            }],
            org: [{
                value: [this.org]
            }],
            tel: [{
                value: `+${cleanNumber}`,
                meta: {
                    type: ["CELL", "VOICE"],
                    waid: [cleanNumber]
                }
            }]
        };
        return vCard.generate(card);
    }
}

module.exports = VCardBuilder;