import { WebSocketServer, WebSocket } from 'ws';
import * as fs from 'fs';
import * as path from 'path';

let clients: WebSocket[] = [];

export async function startServer(port = 8080) {
    const wss = new WebSocketServer({ port });

    wss.on('connection', (ws: WebSocket) => {
        clients.push(ws);
        ws.on('close', () => {
            clients = clients.filter(client => client !== ws);
        });
    });

    const templatesDir = path.join(process.cwd(), 'data', 'templates');
    const viewerPath = path.join(templatesDir, 'viewer.html');

    if (!fs.existsSync(templatesDir)) {
        fs.mkdirSync(templatesDir, { recursive: true });
    }

    if (!fs.existsSync(viewerPath)) {
        const viewerHtml = `<!DOCTYPE html>
<html>
<head>
    <title>Nexus Live Viewer</title>
</head>
<body>
    <script>
        const socket = new WebSocket('ws://localhost:${port}');
        socket.onmessage = (event) => {
            document.body.innerHTML = event.data;
        };
        socket.onopen = () => {
            console.log('Connected to Nexus Broadcast Server');
        };
        socket.onclose = () => {
            console.log('Disconnected from server');
        };
    </script>
</body>
</html>`;
        fs.writeFileSync(viewerPath, viewerHtml, 'utf8');
    }
}

export function broadcast(htmlContent: string) {
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(htmlContent);
        }
    });
}
