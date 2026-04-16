import * as bip39 from 'bip39';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs-extra';
import { deriveKey, encryptData, decryptData, DecryptionError } from './cryptoUtils.js';

const VAULT_FILE_PATH = path.join(process.cwd(), 'data', 'vault.bin');

export async function initializeVault(masterPassword: string): Promise<string> {
    // 1. Generate 16 bytes of random entropy (The "Root Secret") for a 12-word phrase
    const rootSecret = crypto.randomBytes(16);

    // 2. Convert entropy into 12-word mnemonic
    const mnemonic = bip39.entropyToMnemonic(rootSecret.toString('hex'));

    // 3. Generate a random salt
    const salt = crypto.randomBytes(16);

    // 4. Derive KEK
    const kek = deriveKey(masterPassword, salt);

    // 5. Encrypt Root Secret
    // We encrypt the hex string representation of the root secret
    const { iv, authTag, encryptedData } = encryptData(rootSecret.toString('hex'), kek);

    // 6. Save payload
    const payload = {
        salt: salt.toString('hex'),
        iv,
        authTag,
        encryptedData
    };

    await fs.ensureDir(path.dirname(VAULT_FILE_PATH));
    await fs.writeJson(VAULT_FILE_PATH, payload, { spaces: 2 });

    // 7. Return 12-word mnemonic
    return mnemonic;
}

export async function unlockVault(masterPassword: string): Promise<Buffer> {
    // 1. Read vault.bin
    if (!await fs.pathExists(VAULT_FILE_PATH)) {
        throw new Error('Vault not initialized.');
    }

    const payload = await fs.readJson(VAULT_FILE_PATH);
    const { salt, iv, authTag, encryptedData } = payload;

    // 2. Extract salt, derive KEK
    const saltBuffer = Buffer.from(salt, 'hex');
    const kek = deriveKey(masterPassword, saltBuffer);

    // 3. Decrypt Root Secret
    try {
        const decryptedHex = decryptData(encryptedData, kek, iv, authTag);
        return Buffer.from(decryptedHex, 'hex');
    } catch (error) {
        if (error instanceof DecryptionError) {
            throw new Error('AuthError: Incorrect Master Password.');
        }
        throw error;
    }
}
