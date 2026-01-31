const fs = require("node:fs");
const SimplDB = require("simpl.db");

class Config {
    constructor(configPath) {
        this.configPath = configPath;
        this.db = new SimplDB({
            dataFile: this.configPath
        });
        this._loadConfig();
    }

    _loadConfig() {
        if (!fs.existsSync(this.configPath)) return;

        const loadedConfig = this.db.toJSON();
        this._replaceTemplateString(loadedConfig, loadedConfig);
        Object.assign(this, loadedConfig);
    }

    _replaceTemplateString(object, rootObject) {
        for (const objectKey in object) {
            if (typeof object[objectKey] === "string") {
                let value = object[objectKey];
                let previousValue;

                do {
                    previousValue = value;
                    value = value.replace(/%([^%]+)%/g, (match, templateKey) => {
                        const keys = templateKey.split("_");
                        let templateValue = rootObject;

                        for (const key of keys) {
                            if (templateValue && typeof templateValue === "object" && key in templateValue) {
                                templateValue = templateValue[key];
                            } else {
                                return match;
                            }
                        }

                        return templateValue !== null && templateValue !== undefined ? String(templateValue) : match;
                    });
                } while (value !== previousValue);

                object[objectKey] = value;
            } else if (typeof object[objectKey] === "object" && object[objectKey] !== null) {
                this._replaceTemplateString(object[objectKey], rootObject);
            }
        }
    }

    get core() {
        return this.db;
    }
}

module.exports = Config;