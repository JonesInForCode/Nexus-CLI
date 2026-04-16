import enquirer from 'enquirer';
import { Registry } from '../storage/registry.js';
import { DBManager } from '../storage/dbManager.js';
import { castValue, CastingError } from '../validation/typeCaster.js';
import { validateRecord } from '../validation/validator.js';

const { prompt } = enquirer;
const registry = new Registry();

export async function runForm(dbName: string, anchor: string) {
    const dbEntry = registry.get(dbName);
    if (!dbEntry) {
        throw new Error(`Database '${dbName}' not found in registry.`);
    }

    const schemaString = dbEntry.schema;
    if (!schemaString || schemaString.trim() === '') {
        throw new Error(`Cannot run /fill on a schema-less database`);
    }

    const fields = schemaString.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
    const parsedFields = fields.map((f: string) => {
        const parts = f.split(':').map((s: string) => s.trim());
        if (parts.length !== 2) {
            throw new Error(`Malformed schema field: '${f}'. Expected format 'name:type'.`);
        }
        return { name: parts[0], type: parts[1] };
    });

    const record: Record<string, any> = {};

    for (const field of parsedFields) {
        let valid = false;
        while (!valid) {
            try {
                const response: any = await prompt({
                    type: 'input',
                    name: field.name,
                    message: `Enter ${field.name} (${field.type}):`
                });

                const value = response[field.name];
                const castedValue = castValue(value, field.type);
                record[field.name] = castedValue;
                valid = true;
            } catch (error) {
                if (error instanceof CastingError) {
                    console.error('\x1b[31mInvalid type. Please try again.\x1b[0m');
                } else if ((error as any).message === '') {
                    // Empty message usually means prompt was cancelled (Ctrl+C)
                    throw new Error("Form cancelled");
                } else {
                    console.error('\x1b[31mInvalid type. Please try again.\x1b[0m');
                }
            }
        }
    }

    const validation = validateRecord(dbName, record, false);
    if (!validation.success) {
        throw new Error(`Final validation failed: ${validation.errors?.join(', ')}`);
    }

    const dbManager = new DBManager();
    dbManager.useDatabase(dbName);
    dbManager.setRecord(anchor, record);

    console.log(`Data saved successfully to ${dbName} at anchor '${anchor}'.`);
}
