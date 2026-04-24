export function resolvePath(obj: any, path: string): string {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
        if (current === null || current === undefined) {
            return "";
        }
        current = current[part];
    }
    if (current === null || current === undefined) {
        return "";
    }
    return String(current);
}

export function compileTemplate(templateObj: any, dataObj: any): string {
    const html = templateObj.html || "";
    const css = templateObj.css || "";

    const replacedHtml = html.replace(/\{\{([\w.]+)\}\}/g, (match: string, p1: string) => {
        return resolvePath(dataObj, p1);
    });

    const styleTag = `<style>\n${css}\n</style>`;
    return `${styleTag}\n${replacedHtml}`;
}
