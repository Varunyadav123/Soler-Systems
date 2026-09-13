const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const storageFile = path.join('/tmp', 'solar-enquiries.json');

module.exports = function handler(request, response) {
    if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST');
        response.status(405).json({ error: 'Method not allowed.' });
        return;
    }

    const body = request.body || {};
    const requiredFields = ['name', 'phone', 'service'];
    if (requiredFields.some(field => typeof body[field] !== 'string' || !body[field].trim())) {
        response.status(400).json({ error: 'Name, phone and service are required.' });
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

    try {
        let enquiries = [];
        if (fs.existsSync(storageFile)) {
            enquiries = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
        }
        enquiries.push(enquiry);
        fs.writeFileSync(storageFile, JSON.stringify(enquiries, null, 2));
    } catch {
        // WhatsApp remains the primary enquiry channel if temporary storage fails.
    }

    response.status(201).json({ success: true, id: enquiry.id });
};
