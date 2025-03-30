document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('internshipTableBody');
    const refreshBtn = document.getElementById('refreshBtn');
    const searchInput = document.getElementById('searchInput');
    const skillsInput = document.getElementById('skillsInput');
    const timeFilter = document.getElementById('timeFilter');
    const locationFilter = document.getElementById('locationFilter');
    const stipendSort = document.getElementById('stipendSort');
    const stipendRange = document.getElementById('stipendRange');
    let allInternships = [];

    // Direct data source URL
    const dataSourceUrl = 'https://harshkgpian.github.io/internships.json';
    
    // Function to fetch data directly from source
    async function fetchDataFromSource() {
        try {
            tableBody.innerHTML = '<tr><td colspan="8" class="loading">Loading...</td></tr>';
            const response = await fetch(dataSourceUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            allInternships = await response.json();
            filterAndSortData();
        } catch (error) {
            tableBody.innerHTML = '<tr><td colspan="8" class="loading">Error loading data</td></tr>';
            console.error('Error fetching data:', error);
        }
    }

    // Function to populate table
    function populateTable(data) {
        tableBody.innerHTML = '';
        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8" class="loading">No internships found for this filter</td></tr>';
        } else {
            data.forEach(internship => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${internship.jobTitle}</td>
                    <td>${internship.companyName}</td>
                    <td>${internship.location}</td>
                    <td>${internship.duration}</td>
                    <td>${internship.stipend}</td>
                    <td>${internship.postedTime}</td>
                    <td>${internship.skills ? internship.skills.join(', ') : 'N/A'}</td>
                    <td><a href="${internship.detailsUrl}" target="_blank" class="apply-btn">Apply</a></td>
                `;
                tableBody.appendChild(row);
            });
        }
    }

    // Function to parse time string to hours ago
    function parseTimeAgo(timeStr) {
        if (!timeStr || timeStr === 'N/A') return Infinity;
        const match = timeStr.match(/(\d+)\s*(hour|day|week|month)/i);
        if (!match) return Infinity;
        
        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        
        switch (unit) {
            case 'hour': return value;
            case 'day': return value * 24;
            case 'week': return value * 24 * 7;
            case 'month': return value * 24 * 30;
            default: return Infinity;
        }
    }

    // Function to parse stipend to number
    function parseStipend(stipendStr) {
        if (!stipendStr || stipendStr === 'N/A' || stipendStr.toLowerCase().includes('unpaid')) return 0;
        const match = stipendStr.match(/[\d,]+/);
        return match ? parseInt(match[0].replace(/,/g, '')) : 0;
    }

    // Function to filter and sort data
    function filterAndSortData() {
        let filteredData = [...allInternships];

        // Search by job title/company
        const searchTerm = searchInput.value.toLowerCase();
        if (searchTerm) {
            filteredData = filteredData.filter(internship =>
                internship.jobTitle.toLowerCase().includes(searchTerm) ||
                internship.companyName.toLowerCase().includes(searchTerm)
            );
        }

        // Search by skills (and description if available)
        const skillsTerm = skillsInput.value.toLowerCase();
        if (skillsTerm) {
            filteredData = filteredData.filter(internship =>
                // Check if skills array contains the term
                (internship.skills && internship.skills.some(skill => 
                    skill.toLowerCase().includes(skillsTerm)
                )) || 
                // Also check job description if it exists
                (internship.description && 
                internship.description.toLowerCase().includes(skillsTerm)) ||
                // Check job title as fallback for relevant keywords
                internship.jobTitle.toLowerCase().includes(skillsTerm)
            );
        }

        // Time filter
        const timeValue = timeFilter.value;
        if (timeValue !== 'all') {
            const hoursLimit = {
                'hours': 6,
                'day': 24,
                'week': 168
            }[timeValue];
            filteredData = filteredData.filter(internship => 
                parseTimeAgo(internship.postedTime) <= hoursLimit
            );
        }

        // Location filter
        const locationValue = locationFilter.value;
        if (locationValue !== 'all') {
            filteredData = filteredData.filter(internship => {
                const loc = internship.location.toLowerCase();
                return locationValue === 'remote' ? 
                    (loc.includes('remote') || loc.includes('work from home')) :
                    !(loc.includes('remote') || loc.includes('work from home'));
            });
        }

        // Stipend sort
        const sortValue = stipendSort.value;
        if (sortValue !== 'none') {
            filteredData.sort((a, b) => {
                const stipendA = parseStipend(a.stipend);
                const stipendB = parseStipend(b.stipend);
                return sortValue === 'high-to-low' ? 
                    stipendB - stipendA : 
                    stipendA - stipendB;
            });
        }

        // Stipend range filter
        const stipendRangeValue = stipendRange.value;
        if (stipendRangeValue !== 'all') {
            filteredData = filteredData.filter(internship => {
                const stipendAmount = parseStipend(internship.stipend);
                
                if (stipendRangeValue === 'unpaid') {
                    return stipendAmount === 0 || 
                        internship.stipend.toLowerCase().includes('unpaid');
                }
                
                const [min, max] = stipendRangeValue.split('-').map(val => {
                    return val.endsWith('+') ? Infinity : parseInt(val);
                });
                
                return stipendAmount >= min && (max === Infinity || stipendAmount <= max);
            });
        }

        populateTable(filteredData);
    }

    // Function to search internships by keyword using browser-based scraping
    // Note: Browser-based scraping has limitations due to CORS policies
    async function searchByKeyword(keyword) {
        // This is where you would implement a browser-based solution
        // However, direct scraping from the browser may be blocked by CORS
        
        tableBody.innerHTML = '<tr><td colspan="8" class="loading">Note: Direct keyword scraping requires a server or proxy due to CORS limitations</td></tr>';
        
        // For now, we'll just filter existing data instead
        const keywordLower = keyword.toLowerCase();
        const results = allInternships.filter(internship => 
            internship.jobTitle.toLowerCase().includes(keywordLower) ||
            internship.companyName.toLowerCase().includes(keywordLower) ||
            (internship.skills && internship.skills.some(skill => skill.toLowerCase().includes(keywordLower))) ||
            (internship.description && internship.description.toLowerCase().includes(keywordLower))
        );
        
        populateTable(results);
    }


    // Function to refresh data
    async function refreshData() {
        try {
            refreshBtn.disabled = true;
            refreshBtn.textContent = 'Refreshing...';
            await fetchDataFromSource();
        } catch (error) {
            alert('Error refreshing data: ' + error.message);
        } finally {
            refreshBtn.disabled = false;
            refreshBtn.textContent = 'Refresh Data';
        }
    }

    // Debounce function
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Event listeners
    const debouncedFilter = debounce(filterAndSortData, 300);
    refreshBtn.addEventListener('click', refreshData);
    searchInput.addEventListener('input', debouncedFilter);
    skillsInput.addEventListener('input', debouncedFilter);
    timeFilter.addEventListener('change', filterAndSortData);
    locationFilter.addEventListener('change', filterAndSortData);
    stipendSort.addEventListener('change', filterAndSortData);
    stipendRange.addEventListener('change', filterAndSortData);

    // Initial data load
    fetchDataFromSource();
});