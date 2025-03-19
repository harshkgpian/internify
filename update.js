const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { scrapeInternshala } = require('./internshala');

async function refreshNewData() {
    try {
        // Clear existing data by writing an empty array to internships.json
        fs.writeFileSync(path.join(__dirname, 'internships.json'), JSON.stringify([], null, 2));

        internshipData = await scrapeInternshala(50, 1); // Scraping the data, can adjust parameters
        // Save the new data to internships.json
        fs.writeFileSync(path.join(__dirname, 'internships.json'), JSON.stringify(internshipData, null, 2));
        console.log('Data refreshed and saved to internships.json');

        // Git commands to push updates to GitHub
        
        // Add changes
        execSync('git add internships.json', { stdio: 'inherit' });
        
        // Commit with timestamp
        const timestamp = new Date().toISOString();
        execSync(`git commit -m "Update internships data - ${timestamp}"`, { stdio: 'inherit' });
        
        // Push to remote repository
        execSync('git push origin main', { stdio: 'inherit' });
        
        console.log('Successfully pushed updates to GitHub');
    } catch (error) {
        console.error('Error refreshing data or pushing to GitHub:', error);
    }
}

refreshNewData()