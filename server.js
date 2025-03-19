const express = require('express');
const path = require('path');
const https = require('https');
const { scrapeInternshalaKeyword } = require('./internshala');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

let internshipData = [];

// Function to fetch data directly from URL
function loadInternshipsData() {
  const url = 'https://harshkgpian.github.io/internships.json';
  https.get(url, (response) => {
    let data = '';
    response.on('data', (chunk) => {
      data += chunk;
    });

    response.on('end', () => {
      try {
        internshipData = JSON.parse(data);
        console.log('Internship data fetched from URL');
      } catch (error) {
        console.error('Error parsing JSON:', error);
      }
    });
  }).on('error', (error) => {
    console.error('Error fetching data:', error);
  });
}

loadInternshipsData();

// API endpoint to get internship data
app.get('/api/internships', (req, res) => {
  res.json(internshipData);
});

// API endpoint to search and append data using a keyword
app.get('/api/search', async (req, res) => {
  const { keyword } = req.query;
  if (!keyword) {
    return res.status(400).json({ error: 'Keyword is required' });
  }

  try {
    const scrapedData = await scrapeInternshalaKeyword(keyword);

    // Append to internshipData avoiding duplicates using URL as unique identifier
    const existingUrls = new Set(internshipData.map(item => item.detailsUrl));
    const newInternships = scrapedData.filter(item => !existingUrls.has(item.detailsUrl));

    internshipData = [...internshipData, ...newInternships];
    console.log(`Appended ${newInternships.length} new internships from search`);
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
