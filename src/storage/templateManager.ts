import fs from 'fs-extra';
import path from 'path';
import { Registry } from './registry.js';

export async function createTemplate(name: string): Promise<void> {
    const registry = new Registry();
    const templateData = registry.getTemplate(name);

    if (templateData) {
        throw new Error(`Template '${name}' already exists.`);
    }

    const templatesDir = path.join(process.cwd(), 'data', 'templates');
    fs.ensureDirSync(templatesDir);

    const templatePath = path.join(templatesDir, `${name}.json`);

    const boilerplate = {
        name: name,
        html: "<div class='container'>\n  <h1>{{anchor}}</h1>\n  \n</div>",
        css: ".container { padding: 20px; font-family: sans-serif; }"
    };

    fs.writeJsonSync(templatePath, boilerplate, { spaces: 2 });

    const relativePath = path.relative(process.cwd(), templatePath);

    const added = registry.addTemplate(name, {
        path: relativePath,
        createdAt: Date.now()
    });

    if (!added) {
        // Fallback in case there's a race condition
        fs.unlinkSync(templatePath);
        throw new Error(`Failed to register template '${name}'.`);
    }
}
