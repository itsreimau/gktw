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

            Object.assign(this, loadedConfig);
        }
    }

    save() {
        try {
            const configToSave = {};
            for (const [key, value] of Object.entries(this)) {
                if (!["configPath", "_loadConfig", "save"].includes(key)) configToSave[key] = value;
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