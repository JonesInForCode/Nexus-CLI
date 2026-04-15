import { z } from 'zod';

export function buildZodSchema(schemaString: string | null | undefined, isPartial: boolean = false) {
    if (!schemaString || schemaString.trim() === '') {
        return z.record(z.any());
    }

    const fields = schemaString.split(',').map(s => s.trim()).filter(s => s.length > 0);
    const shape: Record<string, z.ZodTypeAny> = {};

    for (const field of fields) {
        const parts = field.split(':').map(s => s.trim());
        if (parts.length !== 2) {
            throw new Error(`Malformed schema field: '${field}'. Expected format 'name:type'.`);
        }

        const [name, type] = parts;
        if (!name || !type) {
            throw new Error(`Malformed schema field: '${field}'. Name and type cannot be empty.`);
        }

        switch (type.toLowerCase()) {
            case 'string':
                shape[name] = z.string();
                break;
            case 'number':
                shape[name] = z.number();
                break;
            case 'boolean':
                shape[name] = z.boolean();
                break;
            default:
                throw new Error(`Unsupported schema type: '${type}' for field '${name}'. Supported types are 'string', 'number', 'boolean'.`);
        }
    }

    const schema = z.object(shape);
    return isPartial ? schema.partial() : schema;
}
