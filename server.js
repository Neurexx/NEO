const express = require('express');
const axios = require('axios');
const app = express();
const path = require('path');

// Middleware to log requests
app.use((req, res, next) => {
    console.log(`Request received: ${req.method} ${req.url}`);
    next();
});

// Set a permissive CSP
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self' https://cdnjs.cloudflare.com; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline';"
    );
    next();
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/horizons', async (req, res) => {
    try {
        const response = await axios.get('https://ssd.jpl.nasa.gov/api/horizons.api', {
            params: req.query
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching data from Horizons API:', error);
        res.status(500).json({ error: 'Failed to fetch data from Horizons API' });
    }
});

// Catch-all route to serve neptune.html for any unmatched routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'neptune.html'));
});

const port = 3000;
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});