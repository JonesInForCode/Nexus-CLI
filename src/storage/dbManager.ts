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
            // Initial empty array for records/documents
            fs.writeJsonSync(tmpPath, [], { spaces: 2 });
            fs.renameSync(tmpPath, dbPath);
            return true;
        } catch (error) {
            if (fs.existsSync(tmpPath)) {
                fs.unlinkSync(tmpPath); // Cleanup on fail
            }
            throw error;
        }
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
