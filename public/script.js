document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('internshipTableBody');
    const refreshBtn = document.getElementById('refreshBtn');
    const searchInput = document.getElementById('searchInput');
    const skillsInput = document.getElementById('skillsInput');
    const keywordInput = document.getElementById('keywordInput');
    const timeFilter = document.getElementById('timeFilter');
    const locationFilter = document.getElementById('locationFilter');
    const stipendSort = document.getElementById('stipendSort');
    let allInternships = [];

    // Function to populate table
    function populateTable(data) {
        tableBody.innerHTML = '';
        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8" class="loading">No internships found for this keyword</td></tr>';
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
                    <td>${internship.skills.join(', ') || 'N/A'}</td>
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

        // Search by skills
        const skillsTerm = skillsInput.value.toLowerCase();
        if (skillsTerm) {
            filteredData = filteredData.filter(internship =>
                internship.skills.some(skill => 
                    skill.toLowerCase().includes(skillsTerm)
                )
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

        populateTable(filteredData);
    }
    async function fetchData() {
        try {
            tableBody.innerHTML = '<tr><td colspan="7" class="loading">Loading...</td></tr>';
            const response = await fetch('/api/internships');
            allInternships = await response.json();
            filterAndSortData();
        } catch (error) {
            tableBody.innerHTML = '<tr><td colspan="7" class="loading">Error loading data</td></tr>';
            console.error('Error fetching data:', error);
        }
    }


    // Function to fetch data based on keyword
    async function fetchDataByKeyword(keyword) {
        try {
            if (!keyword) {
                // If no keyword is entered, show default data
                tableBody.innerHTML = '<tr><td colspan="8" class="loading">Loading...</td></tr>';
                const response = await fetch('/api/internships');
                allInternships = await response.json();
                filterAndSortData();
            } else {
                // If keyword is provided, search for internships by keyword
                tableBody.innerHTML = '<tr><td colspan="8" class="loading">Searching for internships...</td></tr>';
                const response = await fetch(`/api/search?keyword=${encodeURIComponent(keyword)}`);
                const data = await response.json();
                populateTable(data);
            }
        } catch (error) {
            tableBody.innerHTML = '<tr><td colspan="8" class="loading">Error loading data</td></tr>';
            console.error('Error fetching data:', error);
        }
    }

    // Event listeners
    keywordInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            const keyword = keywordInput.value.trim();
            fetchDataByKeyword(keyword);
        }
    });
    

    // Function to refresh data
    async function refreshData() {
        try {
            refreshBtn.disabled = true;
            refreshBtn.textContent = 'Refreshing...';
            const response = await fetch('/api/internships');
            const result = await response.json();
            
            if (response.ok) {
                await fetchData();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            alert('Error refreshing data: ' + error.message);
        } finally {
            refreshBtn.disabled = false;
            refreshBtn.textContent = 'Refresh Data';
        }
    }

    // Initial data load
    fetchDataByKeyword('');

    // Event listeners
    refreshBtn.addEventListener('click', refreshData);
    searchInput.addEventListener('input', filterAndSortData);
    skillsInput.addEventListener('input', filterAndSortData);
    timeFilter.addEventListener('change', filterAndSortData);
    locationFilter.addEventListener('change', filterAndSortData);
    stipendSort.addEventListener('change', filterAndSortData);
});
