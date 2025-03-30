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
    // Filter out expired internships by comparing apply by date with current date
    const currentDate = new Date();
    
    const validInternships = internships.filter(internship => {
      if (!internship.applyBy || internship.applyBy === 'N/A') return true; // Keep if no date available
      
      // Parse the apply by date (format: "DD MMM' YY")
      const dateMatch = internship.applyBy.match(/(\d+)\s+(\w+)'\s*(\d+)/);
      if (!dateMatch) return true; // Keep if can't parse date
      
      const day = parseInt(dateMatch[1]);
      const month = dateMatch[2];
      const year = parseInt(dateMatch[3]);
      
      // Convert month abbreviation to month number (0-11)
      const monthMap = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      };
      
      const monthNum = monthMap[month];
      if (monthNum === undefined) return true; // Keep if invalid month
      
      // Assume 2-digit year format (20XX)
      const fullYear = 2000 + year;
      const applyByDate = new Date(fullYear, monthNum, day);
      
      // Keep only if apply by date is in the future
      return applyByDate >= currentDate;
    });
    
    // Overwrite the old data instead of appending
    await fs.writeFile(filename, JSON.stringify(validInternships, null, 2));
    console.log(`Successfully saved ${validInternships.length} active internships to ${filename}`);
    return validInternships;
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
    
    // Extract apply by date from the details page
    let applyByDate = 'N/A';
    $('.other_detail_item').each((_, element) => {
      const $element = $(element);
      const headingText = $element.find('.item_heading span').text().trim();
      if (headingText === 'APPLY BY') {
        applyByDate = $element.find('.item_body').text().trim();
      }
    });

    return {
      description,
      skills: Array.from(skills),
      applyByDate
    };
  } catch (error) {
    console.error(`Error scraping details for ${url}: ${error.message}`);
    return { description: 'N/A', skills: []};
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

        // We'll extract the apply by date from the details page instead

        internshipsBasic.push({
          internshipId: $element.attr('internshipid') || 'N/A',
          jobTitle,
          companyName: $element.find('.company-name').text().trim() || 'N/A',
          location: $element.find('.locations a').map((_, el) => $(el).text().trim()).get().join(', ') || 'N/A',
          duration: $element.find('.row-1-item:nth-child(2) span').text().trim() || 'N/A',
          stipend: $element.find('.stipend').text().trim() || 'N/A',
          // We'll get the apply by date from the details page
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
      return { 
        ...internship, 
        ...details,
        applyBy: details.applyByDate // Make sure we use the correct field name in the final object
      };
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
    let allValidInternships = [];
    
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
      
      // Collect all results instead of saving after each batch
      allValidInternships = [...allValidInternships, ...validPageResults];
      console.log(`Processed ${i + pagesToProcess}/${pageCount} pages`);
    }
    
    // Save all results at once, overwriting any existing data
    await saveToJson(allValidInternships, filename);
    return allValidInternships;

  } catch (error) {
    console.error('An error occurred during scraping:', error);
    throw error;
  }
}

async function scrapeInternshalaKeyword(keyword) {
  console.log('Starting enhanced Internshala scraper for keyword...', keyword);
  const filename = `internships.json`;
  let keyEncoded = encodeURIComponent(keyword.toLowerCase());

  try {
    const url = `https://internshala.com/internships/keywords-${keyEncoded}`;

    // Scrape the page based on the keyword
    const internships = await scrapeInternshalaPage(url);
    
    // Save results directly, overwriting any existing data and filtering expired listings
    await saveToJson(internships, filename);

    console.log(`Finished scraping for keyword: ${keyword}`);
    return internships;

  } catch (error) {
    console.error('An error occurred during keyword scraping:', error);
    throw error;
  }
}

module.exports = { scrapeInternshala, scrapeInternshalaKeyword };