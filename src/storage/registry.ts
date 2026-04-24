import fs from 'fs-extra';
import path from 'path';

export interface DatabaseEntry {
    path: string;
    schema: any;
    encrypted: boolean;
    createdAt: number;
}

export interface TemplateEntry {
    path: string;
    createdAt: number;
}

export interface FullRegistryData {
    databases: { [name: string]: DatabaseEntry };
    templates: { [name: string]: TemplateEntry };
}

export interface RegistryData {
    [name: string]: DatabaseEntry;
}

export class Registry {
    private registryPath: string;

    constructor(registryPath: string = path.join(process.cwd(), 'data', 'registry.json')) {
        this.registryPath = registryPath;
        this.init();
    }

    private init() {
        if (!fs.existsSync(this.registryPath)) {
            fs.ensureDirSync(path.dirname(this.registryPath));
            fs.writeJsonSync(this.registryPath, { databases: {}, templates: {} }, { spaces: 2 });
        } else {
            let data;
            try {
                data = fs.readJsonSync(this.registryPath);
            } catch (e) {
                data = {};
            }
            let needsMigration = false;
            if (data && typeof data === 'object' && !data.databases && !data.templates) {
                // older format
                const oldData = { ...data };
                data = { databases: oldData, templates: {} };
                needsMigration = true;
            } else {
                if (!data.databases) { data.databases = {}; needsMigration = true; }
                if (!data.templates) { data.templates = {}; needsMigration = true; }
            }
            if (needsMigration) {
                fs.writeJsonSync(this.registryPath, data, { spaces: 2 });
            }
        }
    }

    public getFullRegistry(): FullRegistryData {
        try {
            return fs.readJsonSync(this.registryPath);
        } catch (error) {
            return { databases: {}, templates: {} };
        }
    }

    public getRegistry(): RegistryData {
        return this.getFullRegistry().databases;
    }

    public add(name: string, entry: DatabaseEntry): boolean {
        const fullData = this.getFullRegistry();
        if (fullData.databases[name]) {
            return false;
        }
        fullData.databases[name] = entry;
        fs.writeJsonSync(this.registryPath, fullData, { spaces: 2 });
        return true;
    }

    public remove(name: string): boolean {
        const fullData = this.getFullRegistry();
        if (!fullData.databases[name]) {
            return false;
        }
        delete fullData.databases[name];
        fs.writeJsonSync(this.registryPath, fullData, { spaces: 2 });
        return true;
    }

    public list(): string[] {
        return Object.keys(this.getRegistry());
    }

    public get(name: string): DatabaseEntry | undefined {
        return this.getRegistry()[name];
    }

    public getTemplates(): { [name: string]: TemplateEntry } {
        return this.getFullRegistry().templates;
    }

    public addTemplate(name: string, entry: TemplateEntry): boolean {
        const fullData = this.getFullRegistry();
        if (fullData.templates[name]) {
            return false;
        }
        fullData.templates[name] = entry;
        fs.writeJsonSync(this.registryPath, fullData, { spaces: 2 });
        return true;
    }

    public getTemplate(name: string): TemplateEntry | undefined {
        return this.getFullRegistry().templates[name];
    }
}
