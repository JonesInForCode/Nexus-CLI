import fs from 'fs-extra';
import path from 'path';
import { validateRecord } from '../validation/validator.js';
import { encryptData, decryptData } from '../security/cryptoUtils.js';
import { Registry } from './registry.js';

export class ValidationError extends Error {
    public errors: string[];
    constructor(messages: string[]) {
        super('Validation failed');
        this.name = 'ValidationError';
        this.errors = messages;
    }
}

export class DBManager {
    private baseDir: string;
    private registry: Registry;
    public getSessionKey: () => Buffer | null = () => null;

    constructor(baseDir: string = path.join(process.cwd(), 'data', 'databases')) {
        this.baseDir = baseDir;
        fs.ensureDirSync(this.baseDir);
        this.registry = new Registry();
    }

    public getDbPath(name: string): string {
        return path.join(this.baseDir, `${name}.json`);
    }

    private loadDatabase(name: string): any {
        const dbPath = this.getDbPath(name);
        if (!fs.existsSync(dbPath)) {
            throw new Error(`Database '${name}' does not exist.`);
        }

        const rawData = fs.readJsonSync(dbPath);
        const dbEntry = this.registry.get(name);

        if (dbEntry && dbEntry.encrypted) {
            const key = this.getSessionKey();
            if (!key) {
                throw new Error('AuthError: Vault is locked');
            }

            if (!rawData.iv || !rawData.authTag || !rawData.encryptedData) {
                if (Object.keys(rawData).length === 0) {
                     return rawData;
                }
                throw new Error('Database is flagged as encrypted but missing crypto fields.');
            }

            const decryptedString = decryptData(rawData.encryptedData, key, rawData.iv, rawData.authTag);
            return JSON.parse(decryptedString);
        }

        return rawData;
    }

    private saveDatabase(name: string, data: any): void {
        const dbPath = this.getDbPath(name);
        const tmpPath = `${dbPath}.tmp`;
        const dbEntry = this.registry.get(name);

        let contentToWrite: any = data;

        if (dbEntry && dbEntry.encrypted) {
            const key = this.getSessionKey();
            if (!key) {
                throw new Error('AuthError: Vault is locked');
            }
            const jsonString = JSON.stringify(data);
            contentToWrite = encryptData(jsonString, key);
        }

        try {
            fs.writeJsonSync(tmpPath, contentToWrite, { spaces: 2 });
            fs.renameSync(tmpPath, dbPath);
        } catch (error) {
            if (fs.existsSync(tmpPath)) {
                fs.unlinkSync(tmpPath);
            }
            throw error;
        }
    }

    public createDatabase(name: string): boolean {
        const dbPath = this.getDbPath(name);
        if (fs.existsSync(dbPath)) {
            return false; // Already exists physically
        }

        this.saveDatabase(name, {});
        return true;
    }


    public currentDbName: string | null = null;
    public currentData: Record<string, any> = {};

    public useDatabase(name: string): void {
        const data = this.loadDatabase(name);
        if (Array.isArray(data)) {
            this.currentData = {};
        } else {
            this.currentData = data;
        }
        this.currentDbName = name;
    }

    public set(anchor: string, key: string, value: any): void {
        if (!this.currentDbName) {
            throw new Error('No database selected.');
        }

        const backup = JSON.parse(JSON.stringify(this.currentData));

        if (!this.currentData[anchor]) {
            this.currentData[anchor] = {};
        }
        this.currentData[anchor][key] = value;

        for (const record of Object.values(this.currentData)) {
            const validation = validateRecord(this.currentDbName, record, true);
            if (!validation.success && validation.errors) {
                this.currentData = backup;
                throw new ValidationError(validation.errors);
            }
        }

        this.saveDatabase(this.currentDbName, this.currentData);
    }

    public setRecord(anchor: string, record: Record<string, any>): void {
        if (!this.currentDbName) {
            throw new Error('No database selected.');
        }

        const backup = JSON.parse(JSON.stringify(this.currentData));

        this.currentData[anchor] = record;

        for (const rec of Object.values(this.currentData)) {
            const validation = validateRecord(this.currentDbName, rec, false);
            if (!validation.success && validation.errors) {
                this.currentData = backup;
                throw new ValidationError(validation.errors);
            }
        }

        this.saveDatabase(this.currentDbName, this.currentData);
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
