import fs from 'fs-extra';
import path from 'path';

export interface DatabaseEntry {
    path: string;
    schema: any;
    encrypted: boolean;
    createdAt: number;
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
            fs.writeJsonSync(this.registryPath, {}, { spaces: 2 });
        }
    }

    public getRegistry(): RegistryData {
        try {
            return fs.readJsonSync(this.registryPath);
        } catch (error) {
            return {};
        }
    }

    public add(name: string, entry: DatabaseEntry): boolean {
        const data = this.getRegistry();
        if (data[name]) {
            return false;
        }
        data[name] = entry;
        fs.writeJsonSync(this.registryPath, data, { spaces: 2 });
        return true;
    }

    public remove(name: string): boolean {
        const data = this.getRegistry();
        if (!data[name]) {
            return false;
        }
        delete data[name];
        fs.writeJsonSync(this.registryPath, data, { spaces: 2 });
        return true;
    }

    public list(): string[] {
        return Object.keys(this.getRegistry());
    }

    public get(name: string): DatabaseEntry | undefined {
        return this.getRegistry()[name];
    }
}
