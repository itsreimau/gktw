const fs = require("node:fs");

class Config {
    constructor(configPath) {
        this.configPath = configPath;
        this._loadConfig();
    }

    _loadConfig() {
        if (!fs.existsSync(this.configPath)) return;

        const configContent = fs.readFileSync(this.configPath, "utf8");
        const loadedConfig = JSON.parse(configContent);
        this._replaceTemplateString(loadedConfig, loadedConfig);
        Object.assign(this, loadedConfig);
    }

    _replaceTemplateString(obj, rootObj) {
        for (const key in obj) {
            if (typeof obj[key] === "string") {
                let value = obj[key];
                let previousValue;

                do {
                    previousValue = value;
                    value = value.replace(/%([^%]+)%/g, (match, templateKey) => {
                        const keys = templateKey.split("_");
                        let templateValue = rootObj;

                        for (const k of keys) {
                            if (templateValue && typeof templateValue === "object" && k in templateValue) {
                                templateValue = templateValue[k];
                            } else {
                                return match;
                            }
                        }

                        return templateValue !== null && templateValue !== undefined ? String(templateValue) : match;
                    });
                } while (value !== previousValue);

                obj[key] = value;
            } else if (typeof obj[key] === "object" && obj[key] !== null) {
                this._replaceTemplateString(obj[key], rootObj);
            }
        }
    }

    save() {
        try {
            const configToSave = {};
            for (const [key, value] of Object.entries(this)) {
                if (!["configPath", "_loadConfig", "save", "_replaceTemplateString"].includes(key)) configToSave[key] = value;
            }

            const content = JSON.stringify(configToSave, null, 2);
            fs.writeFileSync(this.configPath, content, "utf8");
            return true;
        } catch {
            return false;
        }
    }
}

module.exports = Config;