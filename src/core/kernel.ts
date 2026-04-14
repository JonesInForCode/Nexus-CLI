import * as readline from 'readline';
import { Registry } from '../storage/registry.js';
import { DBManager } from '../storage/dbManager.js';
import path from 'path';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'Nexus > '
});

const registry = new Registry();
const dbManager = new DBManager();


let currentDatabase: string | null = null;

function updatePrompt() {
    if (currentDatabase) {
        rl.setPrompt(`Nexus (${currentDatabase}) > `);
    } else {
        rl.setPrompt('Nexus > ');
    }
}

function dispatcher(input: string) {
    if (input === '/exit' || input === 'quit') {
        rl.close();
        return;
    }

    const createDbRegex = /^\/create\s+database\s+([a-zA-Z0-9_]+)$/i;

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
                console.error((error as Error).message);
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

            try {
                dbManager.set(anchor, key, value);
                console.log(`Saved ${key}='${value}' to anchor '${anchor}'.`);
            } catch (error) {
                console.error((error as Error).message);
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
                console.error((error as Error).message);
            }
        }
        updatePrompt();
        rl.prompt();
        return;
    }

    const match = input.match(createDbRegex);

    if (match) {
        const dbName = match[1];

        if (registry.get(dbName)) {
            console.error(`Error: Database '${dbName}' already exists.`);
        } else {
            const relativePath = path.relative(process.cwd(), dbManager.getDbPath(dbName));
            const created = dbManager.createDatabase(dbName);
            if (created) {
                const added = registry.add(dbName, {
                    path: relativePath,
                    schema: null,
                    encrypted: false,
                    createdAt: Date.now()
                });

                if (added) {
                    console.log(`Nexus > Database '${dbName}' created successfully.`);
                } else {
                    console.error(`Error: Failed to register database '${dbName}'.`);
                }
            } else {
                 console.error(`Error: Database file for '${dbName}' already exists physically but not in registry.`);
            }
        }
    } else {
        console.log(`Dispatched: ${input}`);
    }

    updatePrompt(); rl.prompt();
}

updatePrompt(); rl.prompt();

rl.on('line', (line) => {
    const input = line.trim();
    if (input) {
        dispatcher(input);
    } else {
        updatePrompt(); rl.prompt();
    }
});

rl.on('SIGINT', () => {
    console.log('\nCaught interrupt signal. Exiting gracefully...');
    rl.close();
});

rl.on('close', () => {
    process.exit(0);
});
