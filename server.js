const express = require('express');
const path = require('path');
const fs = require('fs'); // To read the internships.json file
const { scrapeInternshala, scrapeInternshalaKeyword } = require('./internshala');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));
// Add body parser middleware
app.use(express.json());

// Store internship data
let internshipData = [];

// Function to load internship data from internships.json
function loadInternshipsData() {
    try {
        const data = fs.readFileSync(path.join(__dirname, 'internships.json'), 'utf8');
        internshipData = JSON.parse(data);
        console.log('Internship data loaded from internships.json');
        return internshipData;
    } catch (error) {
        console.error('Error reading internships.json:', error);
        return [];
    }
}

loadInternshipsData();


// Function to refresh data by scraping






// API endpoint to get internship data
app.get('/api/internships', (req, res) => {
    res.json(internshipData);
});

// API endpoint to refresh data by scraping and saving to internships.json
app.get('/api/refresh', async (req, res) => {
    try {
        // Load the refreshed data from the file
        const updatedData = loadInternshipsData();
        res.json({ message: 'Data refreshed and loaded successfully', count: updatedData.length });
    } catch (error) {
        res.status(500).json({ error: 'Error refreshing data: ' + error.message });
    }
});

app.get('/api/search', async (req, res) => {
    const { keyword } = req.query;
    try {
        const scrapedData = await scrapeInternshalaKeyword(keyword);
        res.json(scrapedData);
    } catch (error) {
        res.status(500).json({ error: 'Error searching for internships: ' + error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to view the internship listings`);
});
