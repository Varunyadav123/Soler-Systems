const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const ENQUIRIES_FILE = path.join(DATA_DIR, 'enquiries.json');

function sendJson(response, statusCode, payload) {
    response.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8'
    });
    response.end(JSON.stringify(payload));
}

function readRequestBody(request) {
    return new Promise((resolve, reject) => {
        let body = '';
        let tooLarge = false;
        request.on('data', chunk => {
            if (tooLarge) return;
            body += chunk;
            if (body.length > 100_000) {
                tooLarge = true;
                request.resume();
                const error = new Error('Request body is too large');
                error.statusCode = 413;
                reject(error);
            }
        });
        request.on('end', () => resolve(body));
        request.on('error', reject);
    });
}

function saveEnquiry(enquiry) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    let enquiries = [];
    if (fs.existsSync(ENQUIRIES_FILE)) {
        try {
            enquiries = JSON.parse(fs.readFileSync(ENQUIRIES_FILE, 'utf8'));
        } catch {
            enquiries = [];
        }
    }
    enquiries.push(enquiry);
    fs.writeFileSync(ENQUIRIES_FILE, JSON.stringify(enquiries, null, 2));
}

function serveFrontend(request, response) {
    const requestedPath = new URL(request.url, 'http://localhost').pathname;
    const frontendPath = requestedPath === '/' ? '/index.html' : requestedPath;
    const filePath = path.normalize(path.join(ROOT, frontendPath));
    const relativePath = path.relative(ROOT, filePath);
    const isFrontendFile = relativePath === 'index.html' || relativePath.startsWith(`frontend${path.sep}`);
    if (path.isAbsolute(relativePath) || relativePath.startsWith(`..${path.sep}`) || !isFrontendFile || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Not found');
        return;
    }
    const extension = path.extname(filePath);
    const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
    response.writeHead(200, { 'Content-Type': contentTypes[extension] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
    if (request.method === 'POST' && request.url === '/api/enquiries') {
        try {
            const body = JSON.parse(await readRequestBody(request));
            const requiredFields = ['name', 'phone', 'service'];
            if (requiredFields.some(field => typeof body[field] !== 'string' || !body[field].trim())) {
                sendJson(response, 400, { error: 'Name, phone and service are required.' });
                return;
            }
            const enquiry = {
                id: crypto.randomUUID(),
                name: body.name.trim(),
                phone: body.phone.trim(),
                service: body.service.trim(),
                location: typeof body.location === 'string' ? body.location.trim() : '',
                message: typeof body.message === 'string' ? body.message.trim() : '',
                createdAt: new Date().toISOString()
            };
            saveEnquiry(enquiry);
            sendJson(response, 201, { success: true, id: enquiry.id });
        } catch (error) {
            sendJson(response, error.statusCode || 400, { error: error.statusCode === 413 ? error.message : 'Invalid enquiry data.' });
        }
        return;
    }

    if (request.method === 'GET') {
        serveFrontend(request, response);
        return;
    }

    sendJson(response, 405, { error: 'Method not allowed.' });
});

server.listen(PORT, () => {
    console.log(`My Solar Services running at http://localhost:${PORT}`);
});
