const fs = require("node:fs");

class Config {
    constructor(configPath) {
        this.configPath = configPath;

        this._loadConfig();
    }

    _loadConfig() {
        if (fs.existsSync(this.configPath)) {
            const configContent = fs.readFileSync(this.configPath, "utf8");
            const loadedConfig = JSON.parse(configContent);

            this._replaceTemplateString(loadedConfig);
            Object.assign(this, loadedConfig);
        }
    }

    _replaceTemplateString(obj) {
        for (const key in obj) {
            if (typeof obj[key] === 'string') {
                obj[key] = obj[key].replace(/%([^%]+)%/g, (match, k) => {
                    const keys = k.split("_");
                    let value = obj;
                    for (const key of keys) {
                        if (value && typeof value === "object" && key in value) {
                            value = value[key];
                        } else {
                            return match;
                        }
                    }
                    return value;
                });
            } else if (typeof obj[key] === "object") {
                this._replaceTemplateString(obj[key]);
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
        } catch (error) {
            return false;
        }
    }
}

module.exports = Config;