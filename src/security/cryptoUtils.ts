import crypto from 'crypto';

export class DecryptionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DecryptionError';
    }
}

export function deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.scryptSync(password, salt, 32);
}

export function encryptData(data: string, key: Buffer): { iv: string, authTag: string, encryptedData: string } {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encryptedData = cipher.update(data, 'utf8', 'hex');
    encryptedData += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    return {
        iv: iv.toString('hex'),
        authTag,
        encryptedData
    };
}

export function decryptData(encryptedData: string, key: Buffer, iv: string, authTag: string): string {
    try {
        const ivBuffer = Buffer.from(iv, 'hex');
        const authTagBuffer = Buffer.from(authTag, 'hex');

        const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuffer);
        decipher.setAuthTag(authTagBuffer);

        let decryptedData = decipher.update(encryptedData, 'hex', 'utf8');
        decryptedData += decipher.final('utf8');

        return decryptedData;
    } catch (error) {
        throw new DecryptionError('Failed to decrypt data. Invalid key or tampered data.');
    }
}
