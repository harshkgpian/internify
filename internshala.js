const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;

// Create an axios instance with common settings
const api = axios.create({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Referer': 'https://internshala.com/',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0'
  }
});

async function loadExistingData(filename) {
  try {
    const data = await fs.readFile(filename, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

async function saveToJson(internships, filename) {
  try {
    let existingData = await loadExistingData(filename);
    const urlSet = new Set(existingData.map(item => item.detailsUrl));
    
    const newInternships = internships.filter(internship => !urlSet.has(internship.detailsUrl));
    existingData = [...existingData, ...newInternships];
    
    await fs.writeFile(filename, JSON.stringify(existingData, null, 2));
    console.log(`Successfully saved ${newInternships.length} new internships to ${filename}`);
    return existingData;
  } catch (error) {
    console.error('Error saving data:', error);
    throw error;
  }
}

async function scrapeInternshipDetails(url) {
  try {
    const response = await api.get(url);
    const $ = cheerio.load(response.data);

    // Enhanced description extraction with better HTML handling
    const description = $('.internship_details .text-container')
      .html()
      ?.replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'N/A';

    // More robust skills extraction
    const skills = new Set();
    $('.round_tabs_container .round_tabs, .skill-container .round_tabs').each((_, element) => {
      const skill = $(element).text().trim();
      if (skill) skills.add(skill);
    });

    // Additional details extraction
    const perks = [];
    $('.perks_container .round_tabs').each((_, element) => {
      const perk = $(element).text().trim();
      if (perk) perks.push(perk);
    });

    const requirements = $('.requirements-container')
      .text()
      .replace(/\s+/g, ' ')
      .trim() || 'N/A';

    return {
      description,
      skills: Array.from(skills),
      perks,
      requirements
    };
  } catch (error) {
    console.error(`Error scraping details for ${url}: ${error.message}`);
    return { description: 'N/A', skills: [], perks: [], requirements: 'N/A' };
  }
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, retries = 5, delayMs = 1000) {
  try {
    const response = await api.get(url);
    return response;
  } catch (error) {
    if (retries === 0) {
      console.error(`Request failed for ${url} after multiple attempts: ${error.message}`);
      throw error;
    }

    const statusCode = error.response?.status;
    console.log(`Error ${statusCode || 'unknown'} encountered. Retrying ${url} in ${delayMs}ms...`);

    await delay(delayMs);
    return fetchWithRetry(url, retries - 1, delayMs * 2);
  }
}

async function scrapeInternshalaPage(url) {
  try {
    console.log(`Scraping page ${url}...`);
    const response = await fetchWithRetry(url);
    const $ = cheerio.load(response.data);

    const internshipsBasic = [];
    $('.individual_internship').each((_, element) => {
      try {
        const $element = $(element);
        const detailsUrl = $element.find('.job-title-href').attr('href');
        
        if (!detailsUrl) {
          console.warn('Skipping internship with no details URL');
          return;
        }

        const fullUrl = `https://internshala.com${detailsUrl}`;
        const jobTitle = $element.find('.job-title-href').text().trim();

        if (!jobTitle) {
          console.warn('Skipping internship with no job title');
          return;
        }

        internshipsBasic.push({
          internshipId: $element.attr('internshipid') || 'N/A',
          jobTitle,
          companyName: $element.find('.company-name').text().trim() || 'N/A',
          location: $element.find('.locations a').map((_, el) => $(el).text().trim()).get().join(', ') || 'N/A',
          duration: $element.find('.row-1-item:nth-child(2) span').text().trim() || 'N/A',
          stipend: $element.find('.stipend').text().trim() || 'N/A',
          postedTime: $element.find('.status-inactive span, .status-success span').text().trim() || 'N/A',
          activelyHiring: $element.find('.actively-hiring-badge').length > 0 ? 'Yes' : 'No',
          detailsUrl: fullUrl
        });
      } catch (error) {
        console.error(`Error extracting basic data for internship on page ${url}:`, error.message);
      }
    });

    console.log(`Found ${internshipsBasic.length} internships on page ${url}`);

    const detailPromises = internshipsBasic.map(async (internship, index) => {
      await delay(index * 200);
      console.log(`Fetching details for: ${internship.jobTitle}`);
      const details = await scrapeInternshipDetails(internship.detailsUrl);
      return { ...internship, ...details };
    });

    return await Promise.all(detailPromises);

  } catch (error) {
    console.error(`Error scraping page ${url}:`, error);
    return [];
  }
}

async function scrapeInternshala(pageCount = 1, maxConcurrentPages = 2) {
  console.log('Starting enhanced Internshala scraper...');
  const filename = `internships.json`;

  try {
    for (let i = 0; i < pageCount; i += maxConcurrentPages) {
      const pagesToProcess = Math.min(maxConcurrentPages, pageCount - i);
      const pagePromises = [];

      for (let j = 0; j < pagesToProcess; j++) {
        const pageNum = i + j + 1;
        let url = `https://internshala.com/internships/page-${pageNum}/`

        pagePromises.push(scrapeInternshalaPage(url));
        await delay(1000);
      }

      const pagesResults = await Promise.all(pagePromises);
      const validPageResults = pagesResults.flat().filter(internship => 
        internship && 
        internship.jobTitle !== 'N/A' && 
        internship.description !== 'N/A'
      );

      // Save results after each successful page batch
      await saveToJson(validPageResults, filename);
      console.log(`Processed ${i + pagesToProcess}/${pageCount} pages`);
    }

    const finalData = await loadExistingData(filename);
    return finalData;

  } catch (error) {
    console.error('An error occurred during scraping:', error);
    throw error;
  }
}

async function scrapeInternshalaKeyword(keyword) {
  console.log('Starting enhanced Internshala scraper for keyword...', keyword);
  const filename = `internships.json`;
  let keyEncoded = encodeURIComponent(keyword);

  try {
    const url = `https://internshala.com/internships/keywords-${keyEncoded}`;

    // Scrape the page based on the keyword
    const internships = await scrapeInternshalaPage(url);
    
    // Save results to the JSON file after fetching the internships
    await saveToJson(internships, filename);

    console.log(`Finished scraping for keyword: ${keyword}`);

    return internships;

  } catch (error) {
    console.error('An error occurred during keyword scraping:', error);
    throw error;
  }
}



module.exports = { scrapeInternshala,
  scrapeInternshalaKeyword
 }
