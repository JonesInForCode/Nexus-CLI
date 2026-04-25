import { exportHtml } from './exporter.js';
import * as readline from 'readline';
import { Registry } from '../storage/registry.js';
import { DBManager, ValidationError } from '../storage/dbManager.js';
import { createTemplate } from '../storage/templateManager.js';
import path from 'path';
import fs from 'fs';
import { buildZodSchema } from '../validation/schemaBuilder.js';
import { castValue, getFieldType } from '../validation/typeCaster.js';
import { runForm } from './formEngine.js';
import crypto from 'crypto';
import { deriveKey, encryptData, decryptData, DecryptionError } from '../security/cryptoUtils.js';
import { initializeVault, unlockVault } from '../security/vault.js';
import enquirer from 'enquirer';
import { compileTemplate } from './compiler.js';




const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'Nexus > '
});

const registry = new Registry();
const dbManager = new DBManager();
dbManager.getSessionKey = getSessionKey;
let kernelState: { rootSecret: Buffer | null } = { rootSecret: null };

export function getSessionKey(): Buffer | null {
    return kernelState.rootSecret;
}



let currentDatabase: string | null = null;

function updatePrompt() {
    if (currentDatabase) {
        rl.setPrompt(`Nexus (${currentDatabase}) > `);
    } else {
        rl.setPrompt('Nexus > ');
    }
}


async function handleAuthError(): Promise<boolean> {
    rl.pause();
    try {
        const response = await enquirer.prompt<{ masterPassword: string }>({
            type: 'password',
            name: 'masterPassword',
            message: '[Vault Locked] Enter Master Password:'
        });
        kernelState.rootSecret = await unlockVault(response.masterPassword);
        console.log('Vault Unlocked.');
        rl.resume();
        return true;
    } catch (error) {
        console.error((error as Error).message);
        rl.resume();
        return false;
    }
}

async function dispatcher(input: string) {
    const debugCryptoMatch = input.match(/^\/debug-crypto$/i);
    if (debugCryptoMatch) {
        const testPassword = 'mySecretPassword123!';
        const testString = 'This is a top secret message.';
        console.log(`Original string: ${testString}`);
        console.log(`Password: ${testPassword}`);

        const salt = crypto.randomBytes(16);
        console.log(`Salt: ${salt.toString('hex')}`);

        try {
            const key = deriveKey(testPassword, salt);
            console.log(`Derived Key: ${key.toString('hex')}`);

            const { iv, authTag, encryptedData } = encryptData(testString, key);
            console.log(`IV: ${iv}`);
            console.log(`Auth Tag: ${authTag}`);
            console.log(`Encrypted Data: ${encryptedData}`);

            const decryptedData = decryptData(encryptedData, key, iv, authTag);
            console.log(`Decrypted string: ${decryptedData}`);

            if (decryptedData === testString) {
                console.log('Success: Decrypted text perfectly matches original string.');
            } else {
                console.error('Error: Decrypted text does not match original string.');
            }
        } catch (error) {
            console.error(`Crypto Error: ${(error as Error).message}`);
        }

        updatePrompt();
        rl.prompt();
        return;
    }



    const initVaultMatch = input.match(/^\/init-vault$/i);
    if (initVaultMatch) {
        const vaultPath = path.join(process.cwd(), 'data', 'vault.bin');
        if (fs.existsSync(vaultPath)) {
            console.error('Error: Vault already initialized.');
            updatePrompt();
            rl.prompt();
            return;
        }

        rl.pause();
        try {
            const response = await enquirer.prompt<{ masterPassword: string }>({
                type: 'password',
                name: 'masterPassword',
                message: 'Create a Master Password for the Vault:'
            });
            const confirmResponse = await enquirer.prompt<{ confirmPassword: string }>({
                type: 'password',
                name: 'confirmPassword',
                message: 'Confirm Master Password:'
            });

            if (response.masterPassword !== confirmResponse.confirmPassword) {
                console.error('Error: Passwords do not match.');
            } else {
                const mnemonic = await initializeVault(response.masterPassword);
                console.log('\n\x1b[41m\x1b[37m\x1b[1m MASSIVE WARNING: WRITE THIS DOWN \x1b[0m');
                console.log('\x1b[31m\x1b[1mThis is your ONLY recovery phrase. If you lose your password and this phrase, your data is gone forever.\x1b[0m');
                console.log('\nRecovery Phrase:');
                console.log('\x1b[33m\x1b[1m' + mnemonic + '\x1b[0m\n');
            }
        } catch (error) {
            console.error('Vault initialization aborted or failed:', (error as Error).message);
        }
        rl.resume();
        updatePrompt();
        rl.prompt();
        return;
    }

    const unlockMatch = input.match(/^\/unlock$/i);
    if (unlockMatch) {
        rl.pause();
        try {
            const response = await enquirer.prompt<{ masterPassword: string }>({
                type: 'password',
                name: 'masterPassword',
                message: 'Enter Master Password to unlock Vault:'
            });

            kernelState.rootSecret = await unlockVault(response.masterPassword);
            console.log('Vault Unlocked.');
        } catch (error) {
            console.error((error as Error).message);
        }
        rl.resume();
        updatePrompt();
        rl.prompt();
        return;
    }


    const lockMatch = input.match(/^\/lock$/i);
    if (lockMatch) {
        if (kernelState.rootSecret) {
            kernelState.rootSecret.fill(0);
            kernelState.rootSecret = null;
            console.log('Vault securely locked. Session key purged from memory.');
        } else {
            console.log('Vault is already locked.');
        }

        if (currentDatabase) {
            const dbEntry = registry.get(currentDatabase);
            if (dbEntry && dbEntry.encrypted) {
                currentDatabase = null;
                dbManager.currentDbName = null;
                dbManager.currentData = {};
            }
        }
        updatePrompt();
        rl.prompt();
        return;
    }


    if (input === '/exit' || input === 'quit') {
        if (kernelState.rootSecret) {
            kernelState.rootSecret.fill(0);
            kernelState.rootSecret = null;
        }
        rl.close();
        return;
    }




    const createDbRegex = /^\/create\s+database\s+([a-zA-Z0-9_]+)(?:\s+--schema\s+([^\s]+))?(?:\s+(--encrypt))?$/i;


    const listTemplatesMatch = input.match(/^\/list-templates$/i);
    if (listTemplatesMatch) {
        const templates = registry.getTemplates();
        const output = Object.keys(templates).map(name => {
            const tmpl = templates[name];
            return {
                Name: name,
                Created: new Date(tmpl.createdAt).toLocaleString()
            };
        });
        if (output.length === 0) {
            console.log('No templates registered.');
        } else {
            console.table(output);
        }
        updatePrompt();
        rl.prompt();
        return;
    }

    const listMatch = input.match(/^\/list$/i);
    if (listMatch) {
        const dbs = registry.getRegistry();
        const output = Object.keys(dbs).map(name => {
            const db = dbs[name];
            return {
                Name: name,
                Encrypted: db.encrypted,
                Created: new Date(db.createdAt).toLocaleString()
            };
        });
        if (output.length === 0) {
            console.log('No databases registered.');
        } else {
            console.table(output);
        }
        updatePrompt();
        rl.prompt();
        return;
    }


    const useMatch = input.match(/^\/use\s+([a-zA-Z0-9_]+)$/i);
    if (useMatch) {
        const dbName = useMatch[1];
        if (!registry.get(dbName)) {
            console.error(`Error: Database '${dbName}' is not registered.`);
        } else {
            try {
                dbManager.useDatabase(dbName);
                currentDatabase = dbName;
                console.log(`Switched to workspace: ${dbName}`);
            } catch (error) {
                if ((error as Error).message.includes('AuthError')) {
                    const unlocked = await handleAuthError();
                    if (unlocked) {
                        return dispatcher(input);
                    }
                } else {
                    console.error((error as Error).message);
                }
            }
        }
        updatePrompt();
        rl.prompt();
        return;
    }


    const setMatch = input.match(/^\/set\s+([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+)=(.+)$/i);
    if (setMatch) {
        if (!currentDatabase) {
            console.error('Error: No database selected. Use /use [name] first.');
        } else {
            const anchor = setMatch[1];
            const key = setMatch[2];
            let value = setMatch[3];

            // Remove surrounding quotes if they exist
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }

            let finalValue: any = value;
            const dbEntry = registry.get(currentDatabase);
            if (dbEntry && dbEntry.schema) {
                const expectedType = getFieldType(dbEntry.schema, key);
                if (expectedType) {
                    try {
                        finalValue = castValue(value, expectedType);
                    } catch (error) {
                        console.error(`Error: Expected type [${expectedType}] for field '${key}', received '${value}'.`);
                        updatePrompt();
                        rl.prompt();
                        return;
                    }
                }
            }

            try {
                dbManager.set(anchor, key, finalValue);
                console.log(`Saved ${key}='${value}' to anchor '${anchor}'.`);
            } catch (error) {
                if (error instanceof ValidationError) {
                    console.error('Validation Error:');
                    error.errors.forEach(err => console.error(err));
                } else if ((error as Error).message.includes('AuthError')) {
                    const unlocked = await handleAuthError();
                    if (unlocked) {
                        return dispatcher(input);
                    }
                } else {
                    console.error((error as Error).message);
                }
            }
        }
        updatePrompt();
        rl.prompt();
        return;
    }


    const getMatch = input.match(/^\/get\s+([a-zA-Z0-9_]+)$/i);
    if (getMatch) {
        if (!currentDatabase) {
            console.error('Error: No database selected. Use /use [name] first.');
        } else {
            const anchor = getMatch[1];
            try {
                const data = dbManager.get(anchor);
                if (data === undefined) {
                    console.log(`No data found for anchor '${anchor}'.`);
                } else {
                    console.log(JSON.stringify(data, null, 2));
                }
            } catch (error) {
                if ((error as Error).message.includes('AuthError')) {
                    const unlocked = await handleAuthError();
                    if (unlocked) {
                        return dispatcher(input);
                    }
                } else {
                    console.error((error as Error).message);
                }
            }
        }
        updatePrompt();
        rl.prompt();
        return;
    }


    const debugSchemaMatch = input.match(/^\/debug-schema\s+([a-zA-Z0-9_]+)$/i);
    if (debugSchemaMatch) {
        const dbName = debugSchemaMatch[1];
        const dbEntry = registry.get(dbName);
        if (!dbEntry) {
            console.error(`Error: Database '${dbName}' is not registered.`);
        } else {
            try {
                const schema = buildZodSchema(dbEntry.schema);
                console.log(`Success: Schema for '${dbName}' compiled properly.`);
            } catch (error) {
                console.error(`Error compiling schema for '${dbName}': ${(error as Error).message}`);
            }
        }
        updatePrompt();
        rl.prompt();
        return;
    }

    const fillMatch = input.match(/^\/fill\s+([a-zA-Z0-9_]+)$/i);
    if (fillMatch) {
        if (!currentDatabase) {
            console.error('Error: No database selected. Use /use [name] first.');
        } else {
            const anchor = fillMatch[1];
            rl.pause();
            try {
                await runForm(currentDatabase, anchor);
                // refresh dbManager state
                dbManager.useDatabase(currentDatabase);
            } catch (error) {
                if ((error as Error).message.includes('AuthError')) {
                    const unlocked = await handleAuthError();
                    if (unlocked) {
                        return dispatcher(input);
                    }
                } else {
                    console.error((error as Error).message);
                }
            }
            rl.resume();
        }
        updatePrompt();
        rl.prompt();
        return;
    }










    const renderMatch = input.match(/^\/render\s+([a-zA-Z0-9_-]+)\s+([a-zA-Z0-9_]+)$/i);
    if (renderMatch) {
        if (!currentDatabase) {
            console.error('Error: No database selected. Use /use [name] first.');
        } else {
            const templateName = renderMatch[1];
            const anchor = renderMatch[2];

            const templatePath = path.join(process.cwd(), 'data', 'templates', `${templateName}.json`);
            if (!fs.existsSync(templatePath)) {
                console.error(`Error: Template '${templateName}' not found at ${templatePath}.`);
            } else {
                try {
                    const templateObj = JSON.parse(fs.readFileSync(templatePath, "utf-8"));
                    const dataObj = dbManager.get(anchor);
                    if (dataObj === undefined) {
                        console.error(`Error: No data found for anchor '${anchor}'.`);
                    } else {
                        const output = compileTemplate(templateObj, dataObj);
                        const outputPath = await exportHtml(currentDatabase, anchor, templateName, output);
                        console.log(`Render Complete! Output saved to: ${outputPath}`);
                    }
                } catch (error) {
                    if ((error as Error).message.includes('AuthError')) {
                        const unlocked = await handleAuthError();
                        if (unlocked) {
                            return dispatcher(input);
                        }
                    } else {
                        console.error((error as Error).message);
                    }
                }
            }
        }
        updatePrompt();
        rl.prompt();
        return;
    }

const renderTestMatch = input.match(/^\/render-test\s+([a-zA-Z0-9_-]+)\s+([a-zA-Z0-9_]+)$/i);
    if (renderTestMatch) {
        if (!currentDatabase) {
            console.error('Error: No database selected. Use /use [name] first.');
        } else {
            const templateName = renderTestMatch[1];
            const anchor = renderTestMatch[2];

            const templatePath = path.join(process.cwd(), 'data', 'templates', `${templateName}.json`);
            if (!fs.existsSync(templatePath)) {
                console.error(`Error: Template '${templateName}' not found at ${templatePath}.`);
            } else {
                try {
                    const templateObj = JSON.parse(fs.readFileSync(templatePath, "utf-8"));
                    const dataObj = dbManager.get(anchor);
                    if (dataObj === undefined) {
                        console.error(`Error: No data found for anchor '${anchor}'.`);
                    } else {
                        const output = compileTemplate(templateObj, dataObj);
                        console.log(output);
                    }
                } catch (error) {
                    if ((error as Error).message.includes('AuthError')) {
                        const unlocked = await handleAuthError();
                        if (unlocked) {
                            return dispatcher(input);
                        }
                    } else {
                        console.error((error as Error).message);
                    }
                }
            }
        }
        updatePrompt();
        rl.prompt();
        return;
    }

    const createTemplateMatch = input.match(/^\/create\s+template\s+([a-zA-Z0-9_-]+)$/i);

    if (createTemplateMatch) {
        const templateName = createTemplateMatch[1];
        try {
            await createTemplate(templateName);
            console.log(`Template '${templateName}' created. Edit the file at data/templates/${templateName}.json to define your layout.`);
        } catch (error) {
            console.error(`Error: ${(error as Error).message}`);
        }
        updatePrompt();
        rl.prompt();
        return;
    }

    const match = input.match(createDbRegex);

    if (match) {
        const dbName = match[1];
        let schemaString: string | null = match[2] || null;
        const isEncrypted = !!match[3];

        if (schemaString) {
            if (schemaString === '--encrypt') {
                 schemaString = null;
            } else {
                 schemaString = schemaString.trim();
                 if ((schemaString.startsWith('"') && schemaString.endsWith('"')) || (schemaString.startsWith("'") && schemaString.endsWith("'"))) {
                     schemaString = schemaString.slice(1, -1);
                 }
            }
        }

        // if there's no schema but there is encrypt, it's possible match[2] captured '--encrypt'
        if (input.includes('--encrypt') && !isEncrypted && schemaString === '--encrypt') {
             schemaString = null;
        }

        const actualIsEncrypted = input.includes('--encrypt');


        if (registry.get(dbName)) {
            console.error(`Error: Database '${dbName}' already exists.`);
        } else {
            if (actualIsEncrypted) {
                const vaultPath = path.join(process.cwd(), 'data', 'vault.bin');
                if (!fs.existsSync(vaultPath)) {
                    console.error('Error: Vault not initialized. Run /init-vault first.');
                    updatePrompt();
                    rl.prompt();
                    return;
                }
                if (!getSessionKey()) {
                    console.error('Error: Vault is locked. Run /unlock first.');
                    updatePrompt();
                    rl.prompt();
                    return;
                }
            }

            const relativePath = path.relative(process.cwd(), dbManager.getDbPath(dbName));

            // Register FIRST so that createDatabase knows if it should encrypt the initial empty object
            const added = registry.add(dbName, {
                path: relativePath,
                schema: schemaString,
                encrypted: actualIsEncrypted,
                createdAt: Date.now()
            });

            if (added) {
                const created = dbManager.createDatabase(dbName);
                if (created) {
                    console.log(`Nexus > Database '${dbName}' created successfully.`);
                } else {
                    // rollback registry if physical creation fails (though it shouldn't)
                    registry.remove(dbName);
                    console.error(`Error: Database file for '${dbName}' already exists physically but not in registry.`);
                }
            } else {
                console.error(`Error: Failed to register database '${dbName}'.`);
            }
        }
    } else {
        console.log(`Dispatched: ${input}`);
    }

    updatePrompt(); rl.prompt();
}

updatePrompt(); rl.prompt();

rl.on('line', async (line) => {
    const input = line.trim();
    if (input) {
        await dispatcher(input);
    } else {
        updatePrompt(); rl.prompt();
    }
});


rl.on('SIGINT', () => {
    console.log('\nCaught interrupt signal. Exiting gracefully...');
    if (kernelState.rootSecret) {
        kernelState.rootSecret.fill(0);
        kernelState.rootSecret = null;
    }
    rl.close();
});


rl.on('close', () => {
    process.exit(0);
});
