import * as readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'Nexus > '
});

function dispatcher(input: string) {
    if (input === '/exit' || input === 'quit') {
        rl.close();
        return;
    }
    console.log(`Dispatched: ${input}`);
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
