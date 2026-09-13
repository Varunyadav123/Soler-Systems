window.SolarApi = {
    async submitEnquiry(enquiry) {
        const response = await fetch('/api/enquiries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(enquiry)
        });
        if (!response.ok) {
            throw new Error('Enquiry could not be saved');
        }
        return response.json();
    }
};
