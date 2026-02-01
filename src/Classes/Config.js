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

    _resolveTemplate(str, root) {
        let result = str;
        let changed;

        do {
            changed = false;
            result = result.replace(/%([^%]+)%/g, (match, templateKey) => {
                const value = this._getNestedValue(root, templateKey);
                if (value !== undefined) {
                    changed = true;
                    return String(value);
                }
                return match;
            });
        } while (changed);

        return result;
    }

    _getNestedValue(obj, keyPath) {
        const keys = keyPath.split("_");
        let current = obj;

        for (const key of keys) {
            if (current && typeof current === "object" && key in current) {
                current = current[key];
            } else {
                return undefined;
            }
        }
        return current;
    }

    get core() {
        return this.db;
    }
}

module.exports = Config;