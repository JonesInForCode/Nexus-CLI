import fs from 'fs-extra';
import path from 'path';

export async function exportHtml(dbName: string, anchor: string, templateName: string, htmlContent: string): Promise<string> {
    const filename = `${dbName}_${anchor}_${templateName}_${Date.now()}.html`;
    const exportPath = path.join(process.cwd(), 'data', 'exports', filename);

    await fs.outputFile(exportPath, htmlContent);
    return exportPath;
}
