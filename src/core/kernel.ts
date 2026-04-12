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

function dispatcher(input: string) {
    if (input === '/exit' || input === 'quit') {
        rl.close();
        return;
    }

    const createDbRegex = /^\/create\s+database\s+([a-zA-Z0-9_]+)$/i;
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

    rl.prompt();
}

rl.prompt();

rl.on('line', (line) => {
    const input = line.trim();
    if (input) {
        dispatcher(input);
    } else {
        rl.prompt();
    }
});

rl.on('SIGINT', () => {
    console.log('\nCaught interrupt signal. Exiting gracefully...');
    rl.close();
});

rl.on('close', () => {
    process.exit(0);
});
