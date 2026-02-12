const fs = require("node:fs");
const SimplDB = require("simpl.db");

class Config {
    constructor(configPath) {
        this.configPath = configPath;
        this.db = new SimplDB({
            dataFile: this.configPath,
            tabSize: 2
        });
        this._loadConfig();
    }

    _loadConfig() {
        if (!fs.existsSync(this.configPath)) return;

        const config = this.db.toJSON();
        this._replaceTemplateString(config);
        Object.assign(this, config);
    }

    _replaceTemplateString(object) {
        const root = object;

        const replaceInObject = currentObj => {
            for (const key in currentObj) {
                const value = currentObj[key];

                if (typeof value === "string") {
                    currentObj[key] = this._resolveTemplate(value, root);
                } else if (typeof value === "object" && value !== null) {
                    replaceInObject(value);
                }
            }
        };

        replaceInObject(object);
    }

    _resolveTemplate(string, root) {
        let result = string;
        let changed;

        do {
            changed = false;
            result = result.replace(/%([^%]+)%/g, (match, templateKey) => {
                const value = this._getNestedValue(root, templateKey);
                if (value !== null) {
                    changed = true;
                    return String(value);
                }
                return match;
            });
        } while (changed);

        return result;
    }

    _getNestedValue(object, keyPath) {
        const keys = keyPath.split("_");
        let current = object;

        for (const key of keys) {
            if (current && typeof current === "object" && key in current) {
                current = current[key];
            } else {
                return null;
            }
        }
        return current;
    }

    get core() {
        return this.db;
    }
}

module.exports = Config;