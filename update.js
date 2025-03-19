async function refreshNewData() {
    try {
        internshipData = await scrapeInternshala(100, 1); // Scraping the data, can adjust parameters
        // Save the new data to internships.json
        fs.writeFileSync(path.join(__dirname, 'internships.json'), JSON.stringify(internshipData, null, 2));
        console.log('Data refreshed and saved to internships.json');
    } catch (error) {
        console.error('Error refreshing data:', error);
    }
}

