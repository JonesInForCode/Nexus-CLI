export class CastingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CastingError';
    }
}

export function castValue(value: string, expectedType: string): any {
    switch (expectedType.toLowerCase()) {
        case 'string':
            return value;
        case 'number': {
            const num = Number(value);
            if (isNaN(num)) {
                throw new CastingError(`Expected type [number] for field received '${value}'`);
            }
            return num;
        }
        case 'boolean': {
            const lowerValue = value.toLowerCase();
            if (['true', 'yes', 'y', '1'].includes(lowerValue)) {
                return true;
            }
            if (['false', 'no', 'n', '0'].includes(lowerValue)) {
                return false;
            }
            throw new CastingError(`Expected type [boolean] for field received '${value}'`);
        }
        default:
            return value; // Or throw error for unsupported type if needed
    }
}

export function getFieldType(schemaString: string, field: string): string | null {
    if (!schemaString || schemaString.trim() === '') {
        return null;
    }

    const fields = schemaString.split(',').map(s => s.trim()).filter(s => s.length > 0);

    for (const f of fields) {
        const parts = f.split(':').map(s => s.trim());
        if (parts.length === 2) {
            const [name, type] = parts;
            if (name === field) {
                return type;
            }
        }
    }

    return null;
}
