import fs from 'fs-extra';
import path from 'path';

export class DBManager {
    private baseDir: string;

    constructor(baseDir: string = path.join(process.cwd(), 'data', 'databases')) {
        this.baseDir = baseDir;
        fs.ensureDirSync(this.baseDir);
    }

    public getDbPath(name: string): string {
        return path.join(this.baseDir, `${name}.json`);
    }

    public createDatabase(name: string): boolean {
        const dbPath = this.getDbPath(name);
        if (fs.existsSync(dbPath)) {
            return false; // Already exists physically
        }

        const tmpPath = `${dbPath}.tmp`;
        try {
            // Initial empty object for records/documents
            fs.writeJsonSync(tmpPath, {}, { spaces: 2 });
            fs.renameSync(tmpPath, dbPath);
            return true;
        } catch (error) {
            if (fs.existsSync(tmpPath)) {
                fs.unlinkSync(tmpPath); // Cleanup on fail
            }
            throw error;
        }
    }


    public currentDbName: string | null = null;
    public currentData: Record<string, any> = {};

    public useDatabase(name: string): void {
        const dbPath = this.getDbPath(name);
        if (!fs.existsSync(dbPath)) {
            throw new Error(`Database '${name}' does not exist.`);
        }
        const data = fs.readJsonSync(dbPath);
        if (Array.isArray(data)) {
            this.currentData = {};
        } else {
            this.currentData = data;
        }
        this.currentDbName = name;
    }

    public set(anchor: string, key: string, value: string): void {
        if (!this.currentDbName) {
            throw new Error('No database selected.');
        }
        if (!this.currentData[anchor]) {
            this.currentData[anchor] = {};
        }
        this.currentData[anchor][key] = value;

        const dbPath = this.getDbPath(this.currentDbName);
        const tmpPath = `${dbPath}.tmp`;
        try {
            fs.writeJsonSync(tmpPath, this.currentData, { spaces: 2 });
            fs.renameSync(tmpPath, dbPath);
        } catch (error) {
            if (fs.existsSync(tmpPath)) {
                fs.unlinkSync(tmpPath);
            }
            throw error;
        }
    }

    public get(anchor: string): any {
        if (!this.currentDbName) {
            throw new Error('No database selected.');
        }
        return this.currentData[anchor];
    }

    public deleteDatabase(name: string): boolean {
        const dbPath = this.getDbPath(name);
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
            return true;
        }
        return false;
    }
}
