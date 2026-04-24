# Nexus-CLI

Nexus-CLI is a headless, schema-driven object database management system and template engine built on Node.js and TypeScript (ESM). It operates via a stateful REPL (Read-Eval-Print Loop) kernel, persisting data to modular JSON files backed by dynamic runtime validation.

Designed for power users with database, console, and code experience, Nexus-CLI functions as a highly modular, scriptable alternative to traditional spreadsheets.

## Use Cases

Nexus-CLI allows you to define strict database schemas, populate records, and then build custom templates that dynamically pull and inject that data.

### Document Generation
You can create standard document templates using curly-brace interpolation mapped to database records:

```text
Dear {{employeeDB.name}},

We are writing to inquire about your current status since your {{injuryDB.name.bodypart}} was injured on {{injuryDB.name.date}} when you {{injuryDB.name.summary}}.
```

### Tabular Data Generation
It can also be utilized to generate reporting tables:

```text
{{injuryDB.name}} | {{injuryDB.date}} | {{injuryDB.shift}} | {{injuryDB.name.status}}
```

Data can be directly queried and searched via the REPL console or extended programmatically.

## Architecture

The system is broken down into modular domains:

- `src/core/`: The REPL kernel and command dispatcher. Manages the terminal interface and routes inputs.
- `src/storage/`: Handles persistence. Includes the FileSystem Manager for atomic database operations, the Template Manager for scaffolding templates, and the central Registry (`data/registry.json`) to track DB schemas, templates, and metadata.
- `src/validation/`: Dynamic schema engine. Converts terminal strings into typed primitives and compiles comma-separated schema definitions into native Zod schemas on the fly.
- `src/security/`: Cryptographic vault logic for encrypted I/O (Work In Progress).
- `data/databases/`: Storage directory for isolated JSON database files.
- `data/templates/`: Storage directory for structured template files.

## Data Integrity & Persistence

Data is stored as standard JSON structures mapped to anchor keys. Before persisting to disk, the `DBManager` evaluates the in-memory representation against its associated Zod schema (allowing partial updates). If the structure is invalid, atomic writes are aborted, and a `ValidationError` is thrown.

File writes are atomic: data is written to a `.tmp` file and renamed, preventing corruption during I/O interruptions. Terminal inputs are intercepted and strictly type-cast (e.g., `'true'` to boolean `true`, `'42'` to number `42`) prior to schema validation.

## Setup

Requires Node.js >= 18.

```bash
npm install
npm run start # Use the run start script to start the CLI
```

## Commands

The kernel prompt (`Nexus >` or `Nexus (db_name) >`) maintains context for the active workspace.

### Core Database Commands

- `/create database <name> [--schema field1:type1,field2:type2] [--encrypt]`
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
  Triggers an interactive procedural form to iteratively populate a record based on its schema.
- `/debug-schema <name>`
  Verifies schema compilation for a specific database.

### Template Engine Commands

- `/create template <name>`
  Scaffolds a new structured template file (JSON format) in the `data/templates/` directory to define layouts and data bindings.
- `/list-templates`
  Lists all registered templates in the system.

### Security Commands

- `/init-vault`
  Initializes the cryptographic vault for encrypted databases.
- `/unlock`
  Unlocks the vault with a master password for the active session.
- `/lock`
  Locks the vault and securely purges the active session key.

### General

- `/exit` or `quit`
  Securely terminates the process, zeroing out sensitive memory before exit.

## License

ISC
