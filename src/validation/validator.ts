import { z } from 'zod';
import { Registry } from '../storage/registry.js';
import { buildZodSchema } from './schemaBuilder.js';

const registry = new Registry();

export function validateRecord(dbName: string, record: any, isPartial: boolean = false): { success: boolean; errors?: string[] } {
    const dbEntry = registry.get(dbName);
    if (!dbEntry || !dbEntry.schema) {
        return { success: true };
    }

    const schema = buildZodSchema(dbEntry.schema, isPartial);
    const result = schema.safeParse(record);

    if (!result.success) {
        let errList: any[] = [];
        try {
            errList = JSON.parse(result.error.message);
        } catch (e) {
            return { success: false, errors: [result.error.message] };
        }

        const formattedErrors = errList.map((err: any) => {
            const fieldPath = err.path ? err.path.join('.') : 'unknown';
            return `Validation failed on field '${fieldPath}': ${err.message}`;
        });
        return { success: false, errors: formattedErrors };
    }

    return { success: true };
}
