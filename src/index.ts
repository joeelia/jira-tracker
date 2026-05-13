import { Hono } from 'hono'

type Env = {
  JIRA_BASE_URL: string
  JIRA_EMAIL: string
  JIRA_API_TOKEN: string
}

const app = new Hono<{ Bindings: Env }>()

async function jiraFetch(env: Env, path: string) {
  const auth = btoa(`${env.JIRA_EMAIL}:${env.JIRA_API_TOKEN}`)
  const url = `${env.JIRA_BASE_URL}${path}`

  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json'
    }
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`Jira API failed: ${res.status} - ${text}`)
    throw new Error(`Jira API failed: ${res.status} - ${text}`)
  }

  return res.json()
}

async function findUserByEmail(env: Env, email: string) {
  const data = await jiraFetch(
    env,
    `/rest/api/3/user/search?query=${encodeURIComponent(email)}`
  )

  console.log(`User search returned:`, JSON.stringify(data))
  console.log(`Array length:`, Array.isArray(data) ? data.length : 'not an array')

  return data?.[0]
}

app.get('/', (c) => {
  return c.html(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Jira Worker Analytics</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 2rem;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    .header {
      text-align: center;
      color: white;
      margin-bottom: 2rem;
    }

    .header h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
    }

    .header p {
      opacity: 0.9;
      font-size: 1.1rem;
    }

    .search-box {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
      margin-bottom: 2rem;
    }

    .search-form {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .search-form input {
      flex: 1;
      min-width: 300px;
      padding: 1rem;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      font-size: 1rem;
      transition: border-color 0.2s;
    }

    .search-form input:focus {
      outline: none;
      border-color: #667eea;
    }

    .search-form select {
      padding: 1rem;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      font-size: 1rem;
      background: white;
      cursor: pointer;
      transition: border-color 0.2s;
    }

    .search-form select:focus {
      outline: none;
      border-color: #667eea;
    }

    .search-form button {
      padding: 1rem 2rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .search-form button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .search-form button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .mode-toggle {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .mode-btn {
      flex: 1;
      padding: 0.75rem 1rem;
      background: #e2e8f0;
      color: #4a5568;
      border: none;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .mode-btn.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .mode-btn:hover:not(.active) {
      background: #cbd5e0;
    }

    .date-filters {
      display: flex;
      gap: 0.5rem;
    }

    .date-filters select,
    .date-filters input {
      flex: 1;
    }

    #engineerInputs {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .engineer-email {
      width: 100%;
      padding: 1rem;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      font-size: 1rem;
      transition: border-color 0.2s;
    }

    .engineer-email:focus {
      outline: none;
      border-color: #667eea;
    }

    .comparison-view {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
    }

    .comparison-view h2 {
      color: #1a202c;
      margin-bottom: 0.5rem;
    }

    .comparison-view .date-range {
      color: #667eea;
      font-size: 0.875rem;
      font-weight: 500;
      margin-bottom: 1.5rem;
    }

    .comparison-table {
      width: 100%;
      border-collapse: collapse;
    }

    .comparison-table th,
    .comparison-table td {
      padding: 1rem;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }

    .comparison-table th {
      background: #f7fafc;
      font-weight: 600;
      color: #4a5568;
    }

    .comparison-table tr:hover {
      background: #f7fafc;
    }

    .error {
      background: #fee;
      color: #c33;
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 1rem;
      display: none;
    }

    .error.show {
      display: block;
    }

    .loading {
      text-align: center;
      color: white;
      font-size: 1.2rem;
      display: none;
    }

    .loading.show {
      display: block;
    }

    .results {
      display: none;
    }

    .results.show {
      display: block;
    }

    .user-info {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
      margin-bottom: 2rem;
    }

    .user-info h2 {
      color: #1a202c;
      margin-bottom: 1rem;
    }

    .user-info .email {
      color: #718096;
      margin-top: 0.5rem;
    }

    .user-info .date-range {
      color: #667eea;
      margin-top: 0.25rem;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .metric-card {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
      text-align: center;
      position: relative;
    }

    .metric-card .value {
      font-size: 3rem;
      font-weight: 700;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 0.5rem;
    }

    .metric-card .label {
      color: #718096;
      font-size: 0.875rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .metric-card .info-icon {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      width: 20px;
      height: 20px;
      background: #e2e8f0;
      color: #718096;
      border-radius: 50%;
      font-size: 0.75rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: help;
    }

    .metric-card .info-tooltip {
      display: none;
      position: absolute;
      top: 2.2rem;
      right: 0.5rem;
      background: #1a202c;
      color: white;
      padding: 0.6rem 0.8rem;
      border-radius: 6px;
      font-size: 0.8rem;
      white-space: normal;
      width: 200px;
      z-index: 100;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      line-height: 1.4;
    }

    .metric-card .info-icon:hover + .info-tooltip {
      display: block;
    }

    .tickets-section {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
    }

    .tickets-section h2 {
      color: #1a202c;
      margin-bottom: 1.5rem;
    }

    .tickets-table {
      width: 100%;
      border-collapse: collapse;
    }

    .tickets-table th,
    .tickets-table td {
      padding: 1rem;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }

    .tickets-table th {
      background: #f7fafc;
      color: #4a5568;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.875rem;
      letter-spacing: 0.05em;
    }

    .tickets-table tr:hover {
      background: #f7fafc;
    }

    .ticket-key {
      color: #667eea;
      font-weight: 600;
    }

    .ticket-summary {
      color: #2d3748;
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ticket-summary:hover {
      overflow: visible;
      white-space: normal;
      position: relative;
      z-index: 10;
    }

    .ticket-hours {
      color: #48bb78;
      font-weight: 600;
    }

    .ticket-points {
      color: #ed8936;
      font-weight: 600;
    }

    .ticket-link {
      color: #667eea;
      text-decoration: none;
      font-weight: 600;
    }

    .ticket-link:hover {
      text-decoration: underline;
    }

    .hours-tooltip {
      position: relative;
      cursor: help;
    }

    .hours-tooltip .tooltip-content {
      display: none;
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      background: #1a202c;
      color: white;
      padding: 0.75rem;
      border-radius: 8px;
      font-size: 0.875rem;
      white-space: nowrap;
      z-index: 100;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      margin-bottom: 8px;
    }

    .hours-tooltip:hover .tooltip-content {
      display: block;
    }

    .tooltip-content .worker {
      display: flex;
      justify-content: space-between;
      gap: 2rem;
      margin-bottom: 0.25rem;
    }

    .tooltip-content .note {
      margin-top: 0.5rem;
      padding-top: 0.5rem;
      border-top: 1px solid #4a5568;
      font-size: 0.75rem;
      color: #a0aec0;
    }

    .empty-state {
      text-align: center;
      padding: 3rem;
      color: white;
      opacity: 0.8;
    }

    .empty-state svg {
      width: 64px;
      height: 64px;
      margin-bottom: 1rem;
      opacity: 0.5;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Jira Worker Analytics</h1>
      <p>Search for a user to view their work metrics</p>
    </div>

    <div class="search-box">
      <div class="error" id="error"></div>
      <div class="mode-toggle">
        <button class="mode-btn active" id="singleMode">Single Engineer</button>
        <button class="mode-btn" id="compareMode">Compare Engineers</button>
      </div>
      <form class="search-form" id="searchForm">
        <div id="singleEngineerForm">
          <input 
            type="email" 
            id="emailInput" 
            name="email"
            autocomplete="off"
            placeholder="Enter user email (e.g., user@example.com)" 
            required
          >
        </div>
        <div id="compareEngineerForm" style="display: none;">
          <div id="engineerInputs">
            <input 
              type="email" 
              class="engineer-email"
              name="engineer-email-1"
              autocomplete="off"
              placeholder="Engineer 1 email" 
            >
          </div>
          <button type="button" id="addEngineerBtn" style="padding: 0.5rem 1rem; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer;">+ Add Engineer</button>
        </div>
        <div class="date-filters">
          <select id="timeRange">
            <option value="-30d" selected>Last 30 days</option>
            <option value="-7d">Last 7 days</option>
            <option value="-365d">Last 52 weeks</option>
            <option value="all">All time</option>
            <option value="custom">Custom range</option>
          </select>
          <input type="date" id="customStartDate" style="display: none;">
          <input type="date" id="customEndDate" style="display: none;">
        </div>
        <button type="submit" id="searchButton">Search</button>
      </form>
    </div>

    <div class="loading" id="loading">Loading...</div>

    <div class="results" id="results">
      <div class="user-info" id="userInfo">
        <h2 id="userName"></h2>
        <p class="email" id="userEmail"></p>
        <p class="date-range" id="dateRange"></p>
      </div>

      <div class="metrics">
        <div class="metric-card">
          <div class="info-icon">?</div>
          <div class="info-tooltip">Total number of completed tickets with worklogs by this user in the selected time range.</div>
          <div class="value" id="totalTickets">0</div>
          <div class="label">Total Tickets</div>
        </div>
        <div class="metric-card">
          <div class="info-icon">?</div>
          <div class="info-tooltip">Total hours this user logged across all completed tickets in the selected time range.</div>
          <div class="value" id="totalHours">0</div>
          <div class="label">Total Hours</div>
        </div>
        <div class="metric-card">
          <div class="info-icon">?</div>
          <div class="info-tooltip">Average hours logged per ticket. Lower values may indicate smaller tasks or faster execution.</div>
          <div class="value" id="avgHoursPerTicket">0</div>
          <div class="label">Avg Hours / Ticket</div>
        </div>
        <div class="metric-card">
          <div class="info-icon">?</div>
          <div class="info-tooltip">Average days from when a ticket moves to "In Progress" to when it is marked "Done". Measures active development speed.</div>
          <div class="value" id="avgCycleTime">0</div>
          <div class="label">Avg Cycle Time (days)</div>
        </div>
        <div class="metric-card">
          <div class="info-icon">?</div>
          <div class="info-tooltip">Average days from ticket creation to completion. Measures total time including backlog wait time.</div>
          <div class="value" id="avgLeadTime">0</div>
          <div class="label">Avg Lead Time (days)</div>
        </div>
      </div>

      <div class="tickets-section">
        <h2>Tickets</h2>
        <table class="tickets-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Title</th>
              <th>Story Points</th>
              <th>Hours</th>
              <th>Comments</th>
              <th>Created</th>
              <th>First In Progress</th>
              <th>Closed</th>
            </tr>
          </thead>
          <tbody id="ticketsTableBody">
          </tbody>
        </table>
      </div>
    </div>

    <div class="empty-state" id="emptyState">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
      <p>Enter an email address to search for a user</p>
    </div>
  </div>

  <script>
    function formatDate(dateStr) {
      if (!dateStr) return '-';
      const date = new Date(dateStr);
      const month = date.toLocaleString('default', { month: 'long' });
      const day = date.getDate();
      const year = date.getFullYear();
      const dayWithSuffix = day + (day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th');
      return month + ' ' + dayWithSuffix + ', ' + year;
    }

    function formatDateRange(dateRange) {
      if (!dateRange.startDate || !dateRange.endDate) return '';
      return formatDate(dateRange.startDate) + ' - ' + formatDate(dateRange.endDate);
    }

    function displayComparison(data) {
      const userInfo = document.getElementById('userInfo');
      const metrics = document.querySelector('.metrics');
      const ticketsSection = document.querySelector('.tickets-section');

      userInfo.style.display = 'none';
      metrics.style.display = 'none';
      ticketsSection.style.display = 'none';

      // Create comparison view
      let comparisonHtml = '<div class="comparison-view"><h2>Engineer Comparison</h2>';
      comparisonHtml += '<p class="date-range">' + formatDateRange(data.dateRange) + '</p>';
      comparisonHtml += '<table class="comparison-table"><thead><tr><th>Rank</th><th>Engineer</th><th>Total Tickets</th><th>Total Hours</th><th>Avg Hours/Ticket</th><th>Avg Cycle Time (days)</th><th>Avg Lead Time (days)</th></tr></thead><tbody>';

      data.rankings.forEach((rank, index) => {
        comparisonHtml += '<tr><td>' + (index + 1) + '</td><td>' + rank.displayName + '</td><td>' + rank.totalTickets + '</td><td>' + rank.totalHours + '</td><td>' + rank.avgHoursPerTicket + '</td><td>' + rank.avgCycleTimeDays + '</td><td>' + rank.avgLeadTimeDays + '</td></tr>';
      });

      comparisonHtml += '</tbody></table></div>';

      const existingComparison = document.querySelector('.comparison-view');
      if (existingComparison) {
        existingComparison.remove();
      }

      results.insertAdjacentHTML('beforeend', comparisonHtml);
      emptyState.classList.remove('show');
      results.classList.add('show');
    }

    const searchForm = document.getElementById('searchForm');
    const emailInput = document.getElementById('emailInput');
    const timeRangeSelect = document.getElementById('timeRange');
    const customStartDate = document.getElementById('customStartDate');
    const customEndDate = document.getElementById('customEndDate');
    const searchButton = document.getElementById('searchButton');
    const singleModeBtn = document.getElementById('singleMode');
    const compareModeBtn = document.getElementById('compareMode');
    const singleEngineerForm = document.getElementById('singleEngineerForm');
    const compareEngineerForm = document.getElementById('compareEngineerForm');
    const engineerInputs = document.getElementById('engineerInputs');
    const addEngineerBtn = document.getElementById('addEngineerBtn');

    let isCompareMode = false;
    let engineerCount = 1;

    // Mode toggle
    singleModeBtn.addEventListener('click', () => {
      isCompareMode = false;
      singleModeBtn.classList.add('active');
      compareModeBtn.classList.remove('active');
      singleEngineerForm.style.display = 'block';
      compareEngineerForm.style.display = 'none';
      emailInput.required = true;

      // Remove required from engineer inputs
      document.querySelectorAll('.engineer-email').forEach(input => {
        input.required = false;
      });

      // Reset UI to single engineer view
      const userInfo = document.getElementById('userInfo');
      const metrics = document.querySelector('.metrics');
      const ticketsSection = document.querySelector('.tickets-section');
      const existingComparison = document.querySelector('.comparison-view');

      userInfo.style.display = 'block';
      metrics.style.display = 'grid';
      ticketsSection.style.display = 'block';
      if (existingComparison) {
        existingComparison.remove();
      }
    });

    compareModeBtn.addEventListener('click', () => {
      isCompareMode = true;
      compareModeBtn.classList.add('active');
      singleModeBtn.classList.remove('active');
      singleEngineerForm.style.display = 'none';
      compareEngineerForm.style.display = 'block';
      emailInput.required = false;

      // Add required to engineer inputs
      document.querySelectorAll('.engineer-email').forEach(input => {
        input.required = true;
      });
    });

    // Add engineer button
    addEngineerBtn.addEventListener('click', () => {
      engineerCount++;
      const input = document.createElement('input');
      input.type = 'email';
      input.className = 'engineer-email';
      input.name = 'engineer-email-' + engineerCount;
      input.autocomplete = 'off';
      input.placeholder = 'Engineer ' + engineerCount + ' email';
      if (isCompareMode) {
        input.required = true;
      }
      engineerInputs.appendChild(input);
    });

    // Show/hide custom date inputs
    timeRangeSelect.addEventListener('change', () => {
      if (timeRangeSelect.value === 'custom') {
        customStartDate.style.display = 'block';
        customEndDate.style.display = 'block';
      } else {
        customStartDate.style.display = 'none';
        customEndDate.style.display = 'none';
      }
    });
    const error = document.getElementById('error');
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const emptyState = document.getElementById('emptyState');
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const dateRangeEl = document.getElementById('dateRange');
    const totalTickets = document.getElementById('totalTickets');
    const totalHours = document.getElementById('totalHours');
    const avgHoursPerTicketEl = document.getElementById('avgHoursPerTicket');
    const avgCycleTimeEl = document.getElementById('avgCycleTime');
    const avgLeadTimeEl = document.getElementById('avgLeadTime');
    const ticketsTableBody = document.getElementById('ticketsTableBody');

    searchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const timeRange = timeRangeSelect.value;
      const customStart = customStartDate.value;
      const customEnd = customEndDate.value;

      if (timeRange === 'custom' && (!customStart || !customEnd)) {
        error.textContent = 'Please select both start and end dates for custom range';
        error.classList.add('show');
        return;
      }

      error.classList.remove('show');
      results.classList.remove('show');
      emptyState.classList.add('show');
      loading.classList.add('show');
      searchButton.disabled = true;

      try {
        let url;
        let data;

        if (isCompareMode) {
          const emails = Array.from(document.querySelectorAll('.engineer-email'))
            .map(input => input.value.trim())
            .filter(email => email);

          if (emails.length < 2) {
            error.textContent = 'Please add at least 2 engineers to compare';
            error.classList.add('show');
            loading.classList.remove('show');
            searchButton.disabled = false;
            return;
          }

          url = '/compare?emails=' + emails.map(encodeURIComponent).join(',') + '&timeRange=' + encodeURIComponent(timeRange);
          if (timeRange === 'custom') {
            url += '&customStart=' + encodeURIComponent(customStart) + '&customEnd=' + encodeURIComponent(customEnd);
          }

          const response = await fetch(url);
          data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch comparison');
          }

          displayComparison(data);
        } else {
          const email = emailInput.value.trim();
          if (!email) return;

          url = '/metrics?email=' + encodeURIComponent(email) + '&timeRange=' + encodeURIComponent(timeRange);
          if (timeRange === 'custom') {
            url += '&customStart=' + encodeURIComponent(customStart) + '&customEnd=' + encodeURIComponent(customEnd);
          }

          const response = await fetch(url);
          data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch metrics');
          }

          // Show single engineer view elements
          const userInfo = document.getElementById('userInfo');
          const metrics = document.querySelector('.metrics');
          const ticketsSection = document.querySelector('.tickets-section');
          const existingComparison = document.querySelector('.comparison-view');
          
          userInfo.style.display = 'block';
          metrics.style.display = 'grid';
          ticketsSection.style.display = 'block';
          if (existingComparison) {
            existingComparison.remove();
          }

          userName.textContent = data.user.displayName;
          userEmail.textContent = email;
          dateRangeEl.textContent = formatDateRange(data.dateRange);
          totalTickets.textContent = data.totalTickets;
          totalHours.textContent = data.totalHours;
          avgHoursPerTicketEl.textContent = data.avgHoursPerTicket;
          avgCycleTimeEl.textContent = data.avgCycleTimeDays;
          avgLeadTimeEl.textContent = data.avgLeadTimeDays;

          const jiraBaseUrl = 'https://marriottcloud.atlassian.net/browse/'
          ticketsTableBody.innerHTML = data.tickets.map(ticket => {
            const workersHtml = ticket.allWorkers && ticket.allWorkers.length > 0
              ? ticket.allWorkers.map(w => '<div class="worker"><span>' + w.displayName + '</span><span>' + w.hours + 'h</span></div>').join('')
              : '<div class="worker">No other workers</div>'

            return '<tr><td><a href="' + jiraBaseUrl + ticket.key + '" target="_blank" class="ticket-link">' + ticket.key + '</a></td><td class="ticket-summary" title="' + ticket.summary + '">' + ticket.summary + '</td><td class="ticket-points">' + (ticket.storyPoints || '-') + '</td><td class="hours-tooltip"><span class="ticket-hours">' + ticket.userHours + 'h</span><div class="tooltip-content">' + workersHtml + '<div class="note">Hours shown above are for ' + data.user.displayName + ' only</div></div></td><td>' + ticket.comments + '</td><td>' + formatDate(ticket.created) + '</td><td>' + (ticket.firstInProgress ? formatDate(ticket.firstInProgress) : '-') + '</td><td>' + (ticket.closedDate ? formatDate(ticket.closedDate) : '-') + '</td></tr>'
          }).join('');

          emptyState.classList.remove('show');
          results.classList.add('show');
        }
      } catch (err) {
        error.textContent = err.message;
        error.classList.add('show');
      } finally {
        loading.classList.remove('show');
        searchButton.disabled = false;
      }
    });

    function formatDate(dateString) {
      if (!dateString) return '-';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
  </script>
</body>
</html>
  `)
})

app.get('/test-users', async (c) => {
  try {
    // Try getting the authenticated user first
    const myself = await jiraFetch(
      c.env,
      '/rest/api/3/myself'
    )

    return c.json({
      myself: myself
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

app.get('/test-wiki', async (c) => {
  try {
    // Try fetching content from wiki
    const content = await jiraFetch(
      c.env,
      '/rest/api/content?limit=1'
    )

    return c.json({
      content: content
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

app.get('/search-user', async (c) => {
  const email = c.req.query('email')

  if (!email) {
    return c.json({ error: 'Missing email' }, 400)
  }

  try {
    const user = await findUserByEmail(c.env, email)

    return c.json({
      accountId: user?.accountId,
      displayName: user?.displayName,
      email: user?.emailAddress
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

app.get('/metrics', async (c) => {
  const email = c.req.query('email')
  const timeRange = c.req.query('timeRange') || 'all'
  const customStart = c.req.query('customStart')
  const customEnd = c.req.query('customEnd')

  if (!email) {
    return c.json({ error: 'Missing email' }, 400)
  }

  try {
    const user = await findUserByEmail(c.env, email)

    if (!user?.accountId) {
      return c.json({ error: 'User not found' }, 404)
    }

    let timeFilter = ''
    if (timeRange === 'custom' && customStart && customEnd) {
      timeFilter = ` AND worklogDate >= "${customStart}" AND worklogDate <= "${customEnd}"`
    } else if (timeRange !== 'all') {
      timeFilter = ` AND worklogDate >= ${timeRange}`
    }

    const jqlQuery = `worklogAuthor = "${user.accountId}" AND statusCategory = Done${timeFilter}`
    console.log(`JQL Query: ${jqlQuery}`)

    const jql = encodeURIComponent(jqlQuery)

    const search: any = await jiraFetch(
      c.env,
      `/rest/api/3/search/jql?jql=${jql}&expand=changelog&fields=summary,customfield_10016,created,comment`
    )

    console.log(`Issues found: ${search.issues?.length || 0}`)

    const issues = search.issues || []

    const results = []

    for (const issue of issues) {

      const worklogs: any = await jiraFetch(
        c.env,
        `/rest/api/3/issue/${issue.key}/worklog`
      )

      const userLogs = (worklogs.worklogs || []).filter(
        (w: any) => w.author.accountId === user.accountId
      )

      const totalSeconds = userLogs.reduce(
        (sum: number, w: any) => sum + (w.timeSpentSeconds || 0),
        0
      )

      // Get all workers on this ticket
      const allWorkers = (worklogs.worklogs || []).map((w: any) => ({
        accountId: w.author.accountId,
        displayName: w.author.displayName,
        hours: +((w.timeSpentSeconds || 0) / 3600).toFixed(2)
      }))

      // Group by worker and sum hours
      const workersByHours: Record<string, { displayName: string; hours: number }> = {}
      for (const worker of allWorkers) {
        if (!workersByHours[worker.accountId]) {
          workersByHours[worker.accountId] = { displayName: worker.displayName, hours: 0 }
        }
        workersByHours[worker.accountId].hours += worker.hours
      }

      const workersList = Object.entries(workersByHours).map(([accountId, data]) => ({
        accountId,
        displayName: data.displayName,
        hours: +data.hours.toFixed(2)
      }))

      const comments = issue.fields?.comment?.total || 0

      let firstInProgress = null
      let closedDate = null

      const histories = issue.changelog?.histories || []

      for (const history of histories) {
        for (const item of history.items || []) {
          if (
            item.field === 'status' &&
            item.toString === 'In Progress' &&
            !firstInProgress
          ) {
            firstInProgress = history.created
          }

          if (
            item.field === 'status' &&
            ['Done', 'Closed'].includes(item.toString)
          ) {
            closedDate = history.created
          }
        }
      }

      results.push({
        key: issue.key,
        summary: issue.fields?.summary || 'No summary',
        storyPoints: issue.fields?.customfield_10016 || null,
        comments,
        created: issue.fields?.created || null,
        firstInProgress,
        closedDate,
        userHours: +(totalSeconds / 3600).toFixed(2),
        allWorkers: workersList
      })
    }

    const totalTickets = results.length
    const totalHours = +results.reduce((sum, r) => sum + r.userHours, 0).toFixed(2)
    const avgHoursPerTicket = totalTickets > 0 ? +(totalHours / totalTickets).toFixed(2) : 0

    // Avg cycle time (In Progress -> Done) in days
    const cycleTimes = results
      .filter(r => r.firstInProgress && r.closedDate)
      .map(r => {
        const start = new Date(r.firstInProgress!).getTime()
        const end = new Date(r.closedDate!).getTime()
        return (end - start) / (1000 * 60 * 60 * 24)
      })
    const avgCycleTimeDays = cycleTimes.length > 0
      ? +(cycleTimes.reduce((sum, d) => sum + d, 0) / cycleTimes.length).toFixed(1)
      : 0

    // Avg lead time (Created -> Done) in days
    const leadTimes = results
      .filter(r => r.created && r.closedDate)
      .map(r => {
        const start = new Date(r.created!).getTime()
        const end = new Date(r.closedDate!).getTime()
        return (end - start) / (1000 * 60 * 60 * 24)
      })
    const avgLeadTimeDays = leadTimes.length > 0
      ? +(leadTimes.reduce((sum, d) => sum + d, 0) / leadTimes.length).toFixed(1)
      : 0

    // Story points
    const ticketsWithPoints = results.filter(r => r.storyPoints)
    const totalStoryPoints = ticketsWithPoints.reduce((sum, r) => sum + (r.storyPoints || 0), 0)
    const avgHoursPerStoryPoint = totalStoryPoints > 0 ? +(totalHours / totalStoryPoints).toFixed(2) : 0

    // Calculate date range
    let dateRange = { startDate: null as string | null, endDate: null as string | null }
    if (timeRange === 'custom' && customStart && customEnd) {
      dateRange.startDate = new Date(customStart).toISOString()
      dateRange.endDate = new Date(customEnd).toISOString()
    } else if (timeRange === 'all' && results.length > 0) {
      const dates = results
        .filter(r => r.created)
        .map(r => new Date(r.created!).getTime())
      if (dates.length > 0) {
        dateRange.startDate = new Date(Math.min(...dates)).toISOString()
        dateRange.endDate = new Date(Math.max(...dates)).toISOString()
      }
    } else if (timeRange !== 'all') {
      const now = new Date()
      dateRange.endDate = now.toISOString()
      if (timeRange === '-7d') {
        dateRange.startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      } else if (timeRange === '-30d') {
        dateRange.startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      } else if (timeRange === '-365d') {
        dateRange.startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString()
      }
    }

    return c.json({
      user: {
        accountId: user.accountId,
        displayName: user.displayName
      },
      totalTickets,
      totalHours,
      avgHoursPerTicket,
      avgCycleTimeDays,
      avgLeadTimeDays,
      dateRange,
      totalStoryPoints,
      avgHoursPerStoryPoint,
      tickets: results
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

app.get('/compare', async (c) => {
  const emails = c.req.query('emails')?.split(',').map(e => e.trim())
  const timeRange = c.req.query('timeRange') || '-30d'
  const customStart = c.req.query('customStart')
  const customEnd = c.req.query('customEnd')

  if (!emails || emails.length < 2) {
    return c.json({ error: 'At least 2 emails required' }, 400)
  }

  try {
    const results = []

    for (const email of emails) {
      const user = await findUserByEmail(c.env, email)
      if (!user?.accountId) continue

      let timeFilter = ''
      if (timeRange === 'custom' && customStart && customEnd) {
        timeFilter = ` AND worklogDate >= "${customStart}" AND worklogDate <= "${customEnd}"`
      } else if (timeRange !== 'all') {
        timeFilter = ` AND worklogDate >= ${timeRange}`
      }

      const jql = encodeURIComponent(
        `worklogAuthor = "${user.accountId}" AND statusCategory = Done${timeFilter}`
      )

      const search: any = await jiraFetch(
        c.env,
        `/rest/api/3/search/jql?jql=${jql}&expand=changelog&fields=summary,customfield_10016,created,comment`
      )

      const issues = search.issues || []
      let totalSeconds = 0

      for (const issue of issues) {
        const worklogs: any = await jiraFetch(
          c.env,
          `/rest/api/3/issue/${issue.key}/worklog`
        )
        const userLogs = (worklogs.worklogs || []).filter(
          (w: any) => w.author.accountId === user.accountId
        )
        totalSeconds += userLogs.reduce((sum: number, w: any) => sum + (w.timeSpentSeconds || 0), 0)

        // Calculate cycle time and lead time from changelog
        let firstInProgress = null
        let closedDate = null

        const histories = issue.changelog?.histories || []
        for (const history of histories) {
          for (const item of history.items || []) {
            if (
              item.field === 'status' &&
              item.toString === 'In Progress' &&
              !firstInProgress
            ) {
              firstInProgress = history.created
            }

            if (
              item.field === 'status' &&
              ['Done', 'Closed'].includes(item.toString)
            ) {
              closedDate = history.created
            }
          }
        }

        issue.firstInProgress = firstInProgress
        issue.closedDate = closedDate
        issue.created = issue.fields?.created
      }

      const totalHours = +(totalSeconds / 3600).toFixed(2)
      const avgHoursPerTicket = issues.length > 0 ? +(totalHours / issues.length).toFixed(2) : 0

      const cycleTimes = issues
        .filter((r: any) => r.firstInProgress && r.closedDate)
        .map((r: any) => {
          const start = new Date(r.firstInProgress!).getTime()
          const end = new Date(r.closedDate!).getTime()
          return (end - start) / (1000 * 60 * 60 * 24)
        })
      const avgCycleTimeDays = cycleTimes.length > 0
        ? +(cycleTimes.reduce((sum: number, d: number) => sum + d, 0) / cycleTimes.length).toFixed(1)
        : 0

      const leadTimes = issues
        .filter((r: any) => r.created && r.closedDate)
        .map((r: any) => {
          const start = new Date(r.created!).getTime()
          const end = new Date(r.closedDate!).getTime()
          return (end - start) / (1000 * 60 * 60 * 24)
        })
      const avgLeadTimeDays = leadTimes.length > 0
        ? +(leadTimes.reduce((sum: number, d: number) => sum + d, 0) / leadTimes.length).toFixed(1)
        : 0

      results.push({
        email,
        displayName: user.displayName,
        totalTickets: issues.length,
        totalHours: +totalHours.toFixed(2),
        avgHoursPerTicket,
        avgCycleTimeDays,
        avgLeadTimeDays
      })
    }

    // Sort by total hours (highest first)
    results.sort((a, b) => b.totalHours - a.totalHours)

    // Calculate date range for display
    let dateRange = { startDate: null as string | null, endDate: null as string | null }
    if (timeRange === 'custom' && customStart && customEnd) {
      dateRange.startDate = new Date(customStart).toISOString()
      dateRange.endDate = new Date(customEnd).toISOString()
    } else if (timeRange === '-7d') {
      const now = new Date()
      dateRange.endDate = now.toISOString()
      dateRange.startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    } else if (timeRange === '-30d') {
      const now = new Date()
      dateRange.endDate = now.toISOString()
      dateRange.startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    } else if (timeRange === '-365d') {
      const now = new Date()
      dateRange.endDate = now.toISOString()
      dateRange.startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString()
    }

    return c.json({
      rankings: results,
      dateRange
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default app
