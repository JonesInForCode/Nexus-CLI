# Nexus-CLI

Nexus-CLI is a headless, schema-driven object engine built on Node.js and TypeScript (ESM). It operates via a stateful REPL (Read-Eval-Print Loop) kernel, persisting data to modular JSON files backed by dynamic runtime validation.

## Architecture

The system is broken down into modular domains:

- `src/core/`: The REPL kernel and command dispatcher. Manages the terminal interface and routes inputs.
- `src/storage/`: Handles persistence. Includes the FileSystem Manager for atomic database operations and the central Registry (`data/registry.json`) to track DB schemas and metadata.
- `src/validation/`: Dynamic schema engine. Converts terminal strings into typed primitives and compiles comma-separated schema definitions into native Zod schemas on the fly.
- `src/security/`: Cryptographic vault logic for encrypted I/O (Work In Progress).
- `data/databases/`: Storage directory for isolated JSON database files.

## Data Integrity & Persistence

Data is stored as standard JSON structures mapped to anchor keys. Before persisting to disk, the `DBManager` evaluates the in-memory representation against its associated Zod schema (allowing partial updates). If the structure is invalid, atomic writes are aborted, and a `ValidationError` is thrown.

File writes are atomic: data is written to a `.tmp` file and renamed, preventing corruption during I/O interruptions. Terminal inputs are intercepted and strictly type-cast (e.g., `'true'` to boolean `true`, `'42'` to number `42`) prior to schema validation.

## Setup

Requires Node.js >= 18.

```bash
npm install
npm start
```

## Commands

The kernel prompt (`Nexus >`) maintains context for the active workspace.

- `/create database <name> [--schema field1:type1,field2:type2]`
  Initializes a new database and registers the schema. Supported types: `string`, `number`, `boolean`.
- `/list`
  Lists all registered databases and their metadata.
- `/use <name>`
  Switches context to the specified database.
- `/set <anchor> <key>=<value>`
  Upserts a field on a specific record (anchor). Casts the value and triggers a validation pass before committing to disk.
- `/get <anchor>`
  Retrieves and formats the JSON record for a given anchor.
- `/fill <anchor>`
  Triggers a procedural form to iteratively populate a record based on its schema.
- `/debug-schema <name>`
  Verifies schema compilation for a specific database.
- `/exit` or `quit`
  Terminates the process.

## License

ISC
