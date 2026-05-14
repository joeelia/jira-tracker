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

    .engineer-input-wrapper {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .engineer-input-wrapper input {
      flex: 1;
    }

    .delete-engineer-btn {
      padding: 0.5rem 1rem;
      background: #ef4444;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.875rem;
    }

    .delete-engineer-btn:hover {
      background: #dc2626;
    }

    .comparison-table th {
      position: relative;
      cursor: help;
    }

    .comparison-table .header-tooltip {
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      background: #1a202c;
      color: white;
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      font-size: 0.75rem;
      white-space: nowrap;
      z-index: 1000;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s;
      margin-bottom: 0.5rem;
    }

    .comparison-table th:hover .header-tooltip {
      opacity: 1;
    }

    .pill-filter {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .pill-btn {
      padding: 0.5rem 1rem;
      background: #e2e8f0;
      color: #4a5568;
      border: none;
      border-radius: 20px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
    }

    .pill-btn.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .pill-btn:hover:not(.active) {
      background: #cbd5e0;
    }

    .pill-btn .info-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      background: rgba(255, 255, 255, 0.3);
      color: white;
      border-radius: 50%;
      font-size: 0.7rem;
      font-weight: 700;
      margin-left: 0.5rem;
      cursor: help;
    }

    .pill-btn:not(.active) .info-icon {
      background: #a0aec0;
      color: white;
    }

    .pill-btn .filter-tooltip {
      display: none;
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      background: #1a202c;
      color: white;
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      font-size: 0.75rem;
      white-space: normal;
      width: 220px;
      z-index: 100;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      line-height: 1.4;
      margin-top: 8px;
    }

    .pill-btn:hover .filter-tooltip {
      display: block;
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
            <div class="engineer-input-wrapper">
              <input 
                type="email" 
                class="engineer-email"
                name="engineer-email-1"
                autocomplete="off"
                placeholder="Engineer 1 email" 
              >
            </div>
            <div class="engineer-input-wrapper">
              <input 
                type="email" 
                class="engineer-email"
                name="engineer-email-2"
                autocomplete="off"
                placeholder="Engineer 2 email" 
              >
            </div>
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
        <div class="metric-card">
          <div class="info-icon">?</div>
          <div class="info-tooltip">Total story points from all tickets in the selected time range.</div>
          <div class="value" id="totalStoryPoints">0</div>
          <div class="label">Total Story Points</div>
        </div>
        <div class="metric-card">
          <div class="info-icon">?</div>
          <div class="info-tooltip">Average hours this person logged per story point. Not 1:1 because QA and others also log time, and actual effort may differ from initial estimates.<br><br>0 = no work logged<br>Under 1 = efficient<br>Over 1 = less efficient</div>
          <div class="value" id="avgHoursPerStoryPoint">0</div>
          <div class="label">Avg Hours / Story Point</div>
        </div>
      </div>

      <div class="tickets-section">
        <div class="pill-filter" id="pillFilter" style="display: flex; margin-bottom: 1.5rem;">
          <button type="button" class="pill-btn" data-filter="all">All <span class="info-icon">?</span><div class="filter-tooltip">Includes worklog tickets and closed tickets where the user was assigned at any point.</div></button>
          <button type="button" class="pill-btn active" data-filter="worklog">Work Log <span class="info-icon">?</span><div class="filter-tooltip">Tickets where the user logged work.</div></button>
        </div>
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

      // Get custom dates if present in URL
      const params = new URLSearchParams(window.location.search);
      const customStart = params.get('customStart');
      const customEnd = params.get('customEnd');
      const timeRange = timeRangeSelect.value;

      // Store comparison data for pill filtering
      window._compareData = data;

      // Create comparison view
      let comparisonHtml = '<div class="comparison-view">';
      comparisonHtml += '<div class="pill-filter" style="display: flex; margin-bottom: 1.5rem;">';
      comparisonHtml += '<button type="button" class="pill-btn" data-filter="all">All <span class="info-icon">?</span><div class="filter-tooltip">Includes worklog tickets and closed tickets where the user was assigned at any point.</div></button>';
      comparisonHtml += '<button type="button" class="pill-btn active" data-filter="worklog">Work Log <span class="info-icon">?</span><div class="filter-tooltip">Tickets where the user logged work.</div></button>';
      comparisonHtml += '</div>';
      comparisonHtml += '<h2>Engineer Comparison</h2>';
      comparisonHtml += '<p class="date-range">' + formatDateRange(data.dateRange) + '</p>';
      comparisonHtml += '<table class="comparison-table"><thead><tr><th>Rank</th><th>Engineer</th><th>Total Tickets <span class="info-icon">?</span><div class="header-tooltip">Total tickets where the engineer was assigned at any point (All) or logged work (Work Log)</div></th><th>Total Story Points <span class="info-icon">?</span><div class="header-tooltip">Sum of story points from all tickets shown</div></th><th>Total Hours <span class="info-icon">?</span><div class="header-tooltip">Total hours logged by this engineer across all tickets shown</div></th><th>Avg Hours/Ticket <span class="info-icon">?</span><div class="header-tooltip">Average hours logged per ticket. Total hours ÷ total tickets</div></th><th>Avg Cycle Time (days) <span class="info-icon">?</span><div class="header-tooltip">Average days from In Progress to Done. Measures active development time</div></th><th>Avg Lead Time (days) <span class="info-icon">?</span><div class="header-tooltip">Average days from ticket creation to completion. Includes backlog wait time</div></th></tr></thead><tbody id="compareTableBody"></tbody></table></div>';

      const existingComparison = document.querySelector('.comparison-view');
      if (existingComparison) {
        existingComparison.remove();
      }

      results.insertAdjacentHTML('beforeend', comparisonHtml);

      // Now render rows (after HTML is in DOM)
      renderCompareRows(data.rankings, 'worklog', timeRange, customStart, customEnd);

      emptyState.classList.remove('show');
      results.classList.add('show');

      // Wire up compare pill buttons
      document.querySelectorAll('.comparison-view .pill-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.comparison-view .pill-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const filter = btn.dataset.filter || 'all';
          const compareBody = document.getElementById('compareTableBody');
          if (compareBody && window._compareData) {
            compareBody.innerHTML = '';
            renderCompareRows(window._compareData.rankings, filter, timeRange, customStart, customEnd);
          }
        });
      });
    }

    function renderCompareRows(rankings, filter, timeRange, customStart, customEnd) {
      const compareBody = document.getElementById('compareTableBody');
      if (!compareBody) return;

      let html = '';
      rankings.forEach((rank, index) => {
        const isWorklog = filter === 'worklog';
        const tickets = isWorklog ? (rank.worklogTotalTickets || 0) : rank.totalTickets;
        const storyPoints = isWorklog ? (rank.worklogTotalStoryPoints || 0) : rank.totalStoryPoints;
        const hours = isWorklog ? (rank.worklogTotalHours || 0) : rank.totalHours;
        const avgHours = isWorklog ? (rank.worklogAvgHoursPerTicket || 0) : rank.avgHoursPerTicket;
        const cycleTime = isWorklog ? (rank.worklogAvgCycleTimeDays || 0) : rank.avgCycleTimeDays;
        const leadTime = isWorklog ? (rank.worklogAvgLeadTimeDays || 0) : rank.avgLeadTimeDays;

        let singleUrl = '?search=single&email=' + rank.email + '&time=' + timeRange;
        if (timeRange === 'custom' && customStart && customEnd) {
          singleUrl += '&customStart=' + customStart + '&customEnd=' + customEnd;
        }

        html += '<tr><td>' + (index + 1) + '</td><td>' + rank.displayName + ' <a href="' + singleUrl + '" class="ticket-link" style="font-size: 0.75rem;">(view)</a></td><td>' + tickets + '</td><td>' + (storyPoints || 0) + '</td><td>' + hours + '</td><td>' + avgHours + '</td><td>' + cycleTime + '</td><td>' + leadTime + '</td></tr>';
      });
      compareBody.innerHTML = html;
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
    const pillFilter = document.getElementById('pillFilter');
    const pillBtns = document.querySelectorAll('.pill-btn');
    const totalStoryPointsEl = document.getElementById('totalStoryPoints');
    const avgHoursPerStoryPointEl = document.getElementById('avgHoursPerStoryPoint');

    let isCompareMode = false;
    let currentFilter = 'worklog';
    let allTicketsData = [];
    let engineerCount = 2;

    // Mode toggle
    singleModeBtn.addEventListener('click', () => {
      isCompareMode = false;
      singleModeBtn.classList.add('active');
      compareModeBtn.classList.remove('active');
      singleEngineerForm.style.display = 'block';
      compareEngineerForm.style.display = 'none';
      pillFilter.style.display = 'flex';
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
      pillFilter.style.display = 'none';
      emailInput.required = false;

      // Add required to engineer inputs
      document.querySelectorAll('.engineer-email').forEach(input => {
        input.required = true;
      });
    });

    // Function to filter and display tickets based on current filter
    function filterAndDisplayTickets() {
      if (!allTicketsData.length) return;

      let filteredTickets = [];
      if (currentFilter === 'all') {
        filteredTickets = allTicketsData;
      } else if (currentFilter === 'worklog') {
        filteredTickets = allTicketsData.filter(t => t.type === 'worklog');
      }

      const jiraBaseUrl = 'https://marriottcloud.atlassian.net/browse/'
      ticketsTableBody.innerHTML = filteredTickets.map(ticket => {
        const workersHtml = ticket.allWorkers && ticket.allWorkers.length > 0
          ? ticket.allWorkers.map(w => '<div class="worker"><span>' + w.displayName + '</span><span>' + w.hours + 'h</span></div>').join('')
          : '<div class="worker">No other workers</div>'

        return '<tr><td><a href="' + jiraBaseUrl + ticket.key + '" target="_blank" class="ticket-link">' + ticket.key + '</a></td><td class="ticket-summary" title="' + ticket.summary + '">' + ticket.summary + '</td><td class="ticket-points">' + (ticket.storyPoints || '-') + '</td><td class="hours-tooltip"><span class="ticket-hours">' + ticket.userHours + 'h</span><div class="tooltip-content">' + workersHtml + '<div class="note">Hours shown above are for ' + userName.textContent + ' only</div></div></td><td>' + ticket.comments + '</td><td>' + formatDate(ticket.created) + '</td><td>' + (ticket.firstInProgress ? formatDate(ticket.firstInProgress) : '-') + '</td><td>' + (ticket.closedDate ? formatDate(ticket.closedDate) : '-') + '</td></tr>'
      }).join('');

      // Update metrics based on filter
      updateMetricsForFilter();
    }

    function updateMetricsForFilter() {
      if (!window._singleMetricsData) return;
      const d = window._singleMetricsData;
      const isWorklog = currentFilter === 'worklog';

      totalTickets.textContent = isWorklog ? (d.worklogTotalTickets || 0) : d.totalTickets;
      totalHours.textContent = isWorklog ? (d.worklogTotalHours || 0) : d.totalHours;
      avgHoursPerTicketEl.textContent = isWorklog ? (d.worklogAvgHoursPerTicket || 0) : d.avgHoursPerTicket;
      avgCycleTimeEl.textContent = isWorklog ? (d.worklogAvgCycleTimeDays || 0) : d.avgCycleTimeDays;
      avgLeadTimeEl.textContent = isWorklog ? (d.worklogAvgLeadTimeDays || 0) : d.avgLeadTimeDays;
      totalStoryPointsEl.textContent = isWorklog ? (d.worklogTotalStoryPoints || 0) : d.totalStoryPoints;
      avgHoursPerStoryPointEl.textContent = d.avgHoursPerStoryPoint;
    }

    // Pill filter click handlers
    pillBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        pillBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter || 'all';
        filterAndDisplayTickets();
      });
    });

    // Add engineer button
    addEngineerBtn.addEventListener('click', () => {
      engineerCount++;
      const wrapper = document.createElement('div');
      wrapper.className = 'engineer-input-wrapper';
      
      const input = document.createElement('input');
      input.type = 'email';
      input.className = 'engineer-email';
      input.name = 'engineer-email-' + engineerCount;
      input.autocomplete = 'off';
      input.placeholder = 'Engineer ' + engineerCount + ' email';
      if (isCompareMode) {
        input.required = true;
      }
      
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'delete-engineer-btn';
      deleteBtn.textContent = '×';
      deleteBtn.addEventListener('click', () => {
        const wrappers = document.querySelectorAll('.engineer-input-wrapper');
        if (wrappers.length > 2) {
          wrapper.remove();
        } else {
          alert('At least 2 engineers are required for comparison');
        }
      });
      
      wrapper.appendChild(input);
      wrapper.appendChild(deleteBtn);
      engineerInputs.appendChild(wrapper);
    });

    // Add delete buttons to initial engineer inputs
    document.querySelectorAll('.engineer-input-wrapper').forEach(wrapper => {
      const input = wrapper.querySelector('input');
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'delete-engineer-btn';
      deleteBtn.textContent = '×';
      deleteBtn.addEventListener('click', () => {
        const wrappers = document.querySelectorAll('.engineer-input-wrapper');
        if (wrappers.length > 2) {
          wrapper.remove();
        } else {
          alert('At least 2 engineers are required for comparison');
        }
      });
      wrapper.appendChild(deleteBtn);
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

          url = '/compare?emails=' + emails.join(',') + '&timeRange=' + timeRange;
          if (timeRange === 'custom') {
            url += '&customStart=' + customStart + '&customEnd=' + customEnd;
          }

          const response = await fetch(url);
          data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch comparison');
          }

          displayComparison(data);
          
          // Update URL with search parameters (no encoding)
          let urlParams = '?search=compare&email=' + emails.join(',');
          if (timeRange !== '-30d') {
            urlParams += '&time=' + timeRange;
          }
          if (timeRange === 'custom') {
            urlParams += '&customStart=' + customStart + '&customEnd=' + customEnd;
          }
          window.history.pushState({}, '', urlParams);
        } else {
          const email = emailInput.value.trim();
          if (!email) return;

          url = '/metrics?email=' + email + '&timeRange=' + timeRange;
          if (timeRange === 'custom') {
            url += '&customStart=' + customStart + '&customEnd=' + customEnd;
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

          // Store metrics data for pill filtering
          window._singleMetricsData = data;

          // Store all tickets data for client-side filtering
          allTicketsData = data.tickets || [];

          // Display filtered tickets based on current filter
          filterAndDisplayTickets();

          emptyState.classList.remove('show');
          results.classList.add('show');
          
          // Update URL with search parameters (no encoding)
          let urlParams = '?search=single&email=' + email;
          if (timeRange !== '-30d') {
            urlParams += '&time=' + timeRange;
          }
          if (timeRange === 'custom') {
            urlParams += '&customStart=' + customStart + '&customEnd=' + customEnd;
          }
          window.history.pushState({}, '', urlParams);
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

    // Handle URL params for auto-search
    (function handleUrlParams() {
      const params = new URLSearchParams(window.location.search);
      const searchMode = params.get('search');
      const emailsParam = params.get('email');
      const timeParam = params.get('time');
      const customStartParam = params.get('customStart');
      const customEndParam = params.get('customEnd');

      if (!searchMode || !emailsParam) return;

      const emails = emailsParam.split(',').map(e => e.trim()).filter(Boolean);
      if (!emails.length) return;

      // Set time range if provided
      if (timeParam) {
        const validRanges = ['-7d', '-30d', '-365d', 'all'];
        if (validRanges.includes(timeParam)) {
          timeRangeSelect.value = timeParam;
        } else if (timeParam.startsWith('-') && timeParam.endsWith('d')) {
          // Custom range like -90d
          const days = parseInt(timeParam.slice(1, -1));
          if (!isNaN(days) && days > 0) {
            timeRangeSelect.value = 'custom';
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            customStartDate.value = startDate.toISOString().split('T')[0];
            customEndDate.value = endDate.toISOString().split('T')[0];
            customStartDate.style.display = 'block';
            customEndDate.style.display = 'block';
          }
        }
      }

      // Set custom dates if provided
      if (customStartParam && customEndParam && timeRangeSelect.value !== 'custom') {
        timeRangeSelect.value = 'custom';
        customStartDate.value = customStartParam;
        customEndDate.value = customEndParam;
        customStartDate.style.display = 'block';
        customEndDate.style.display = 'block';
      }

      if (searchMode === 'single') {
        emailInput.value = emails[0];
        searchForm.dispatchEvent(new Event('submit'));
      } else if (searchMode === 'compare') {
        // Switch to compare mode
        compareModeBtn.click();

        // Fill in emails
        const inputs = document.querySelectorAll('.engineer-email');
        emails.forEach((email, i) => {
          if (i < inputs.length) {
            inputs[i].value = email;
          } else {
            // Add more inputs if needed
            addEngineerBtn.click();
            const newInputs = document.querySelectorAll('.engineer-email');
            newInputs[newInputs.length - 1].value = email;
          }
        });

        searchForm.dispatchEvent(new Event('submit'));
      }
    })();
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

    // Fetch worklog tickets (for 'all' and 'worklog' filters)
    // Find the story points field ID
    const allFields: any = await jiraFetch(c.env, '/rest/api/3/field')
    const storyPointsField = allFields.find((f: any) => 
      f.name?.toLowerCase().includes('story point') || 
      f.name?.toLowerCase().includes('story points')
    )
    const storyPointsFieldId = storyPointsField?.id || 'customfield_10016'
    console.log(`Story points field: ${storyPointsField?.name} (${storyPointsFieldId})`)

    const worklogJqlQuery = `worklogAuthor = "${user.accountId}" AND statusCategory = Done${timeFilter}`
    console.log(`Worklog JQL Query: ${worklogJqlQuery}`)

    const worklogJql = encodeURIComponent(worklogJqlQuery)

    const worklogSearch: any = await jiraFetch(
      c.env,
      `/rest/api/3/search/jql?jql=${worklogJql}&expand=changelog&fields=summary,${storyPointsFieldId},created,comment`
    )

    console.log(`Worklog Issues found: ${worklogSearch.issues?.length || 0}`)

    const worklogIssues = worklogSearch.issues || []

    // Fetch closed tickets (for 'closed' filter)
    let closedTimeFilter = ''
    if (timeRange === 'custom' && customStart && customEnd) {
      closedTimeFilter = ` AND updated >= "${customStart}" AND updated <= "${customEnd}"`
    } else if (timeRange !== 'all') {
      closedTimeFilter = ` AND updated >= ${timeRange}`
    }

    const closedJqlQuery = `assignee was "${user.accountId}" AND statusCategory = Done${closedTimeFilter}`
    console.log(`Closed JQL Query: ${closedJqlQuery}`)

    const closedJql = encodeURIComponent(closedJqlQuery)

    const closedSearch: any = await jiraFetch(
      c.env,
      `/rest/api/3/search/jql?jql=${closedJql}&expand=changelog&fields=summary,${storyPointsFieldId},created,comment`
    )

    console.log(`Closed Issues found: ${closedSearch.issues?.length || 0}`)

    const closedIssues = closedSearch.issues || []

    // Process worklog tickets
    const worklogResults = []

    for (const issue of worklogIssues) {

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

      worklogResults.push({
        key: issue.key,
        summary: issue.fields?.summary || 'No summary',
        storyPoints: issue.fields?.[storyPointsFieldId] || null,
        comments,
        created: issue.fields?.created || null,
        firstInProgress,
        closedDate,
        userHours: +(totalSeconds / 3600).toFixed(2),
        allWorkers: workersList,
        type: 'worklog'
      })
    }

    // Process closed tickets (without worklog details, just basic info)
    const closedResults = []
    const closedTicketKeys = new Set(worklogResults.map(t => t.key))

    for (const issue of closedIssues) {
      // Skip if already in worklog results to avoid duplicates
      if (closedTicketKeys.has(issue.key)) continue

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

      closedResults.push({
        key: issue.key,
        summary: issue.fields?.summary || 'No summary',
        storyPoints: issue.fields?.[storyPointsFieldId] || null,
        comments,
        created: issue.fields?.created || null,
        firstInProgress,
        closedDate,
        userHours: 0,
        allWorkers: [],
        type: 'closed'
      })
    }

    // Combine results (worklog + closed)
    const allResults = [...worklogResults, ...closedResults]

    // Calculate metrics from all results
    const totalTickets = allResults.length
    const totalHours = +worklogResults.reduce((sum: number, r: any) => sum + r.userHours, 0).toFixed(2)
    const avgHoursPerTicket = totalTickets > 0 ? +(totalHours / totalTickets).toFixed(2) : 0

    // Avg cycle time (In Progress -> Done) in days - from all results
    const cycleTimes = allResults
      .filter((r: any) => r.firstInProgress && r.closedDate)
      .map((r: any) => {
        const start = new Date(r.firstInProgress!).getTime()
        const end = new Date(r.closedDate!).getTime()
        return (end - start) / (1000 * 60 * 60 * 24)
      })
    const avgCycleTimeDays = cycleTimes.length > 0
      ? +(cycleTimes.reduce((sum: number, d: number) => sum + d, 0) / cycleTimes.length).toFixed(1)
      : 0

    // Avg lead time (Created -> Done) in days - from all results
    const leadTimes = allResults
      .filter((r: any) => r.created && r.closedDate)
      .map((r: any) => {
        const start = new Date(r.created!).getTime()
        const end = new Date(r.closedDate!).getTime()
        return (end - start) / (1000 * 60 * 60 * 24)
      })
    const avgLeadTimeDays = leadTimes.length > 0
      ? +(leadTimes.reduce((sum: number, d: number) => sum + d, 0) / leadTimes.length).toFixed(1)
      : 0

    // Story points from all results
    const ticketsWithPoints = allResults.filter((r: any) => r.storyPoints)
    const totalStoryPoints = ticketsWithPoints.reduce((sum: number, r: any) => sum + (r.storyPoints || 0), 0)
    const avgHoursPerStoryPoint = totalStoryPoints > 0 ? +(totalHours / totalStoryPoints).toFixed(2) : 0

    // Worklog-only metrics
    const worklogTotalTickets = worklogResults.length
    const worklogTotalHours = +worklogResults.reduce((sum: number, r: any) => sum + r.userHours, 0).toFixed(2)
    const worklogAvgHoursPerTicket = worklogTotalTickets > 0 ? +(worklogTotalHours / worklogTotalTickets).toFixed(2) : 0

    const worklogCycleTimes = worklogResults
      .filter((r: any) => r.firstInProgress && r.closedDate)
      .map((r: any) => {
        const start = new Date(r.firstInProgress!).getTime()
        const end = new Date(r.closedDate!).getTime()
        return (end - start) / (1000 * 60 * 60 * 24)
      })
    const worklogAvgCycleTimeDays = worklogCycleTimes.length > 0
      ? +(worklogCycleTimes.reduce((sum: number, d: number) => sum + d, 0) / worklogCycleTimes.length).toFixed(1)
      : 0

    const worklogLeadTimes = worklogResults
      .filter((r: any) => r.created && r.closedDate)
      .map((r: any) => {
        const start = new Date(r.created!).getTime()
        const end = new Date(r.closedDate!).getTime()
        return (end - start) / (1000 * 60 * 60 * 24)
      })
    const worklogAvgLeadTimeDays = worklogLeadTimes.length > 0
      ? +(worklogLeadTimes.reduce((sum: number, d: number) => sum + d, 0) / worklogLeadTimes.length).toFixed(1)
      : 0

    const worklogTicketsWithPoints = worklogResults.filter((r: any) => r.storyPoints)
    const worklogTotalStoryPoints = worklogTicketsWithPoints.reduce((sum: number, r: any) => sum + (r.storyPoints || 0), 0)

    // Calculate date range
    let dateRange = { startDate: null as string | null, endDate: null as string | null }
    if (timeRange === 'custom' && customStart && customEnd) {
      dateRange.startDate = new Date(customStart).toISOString()
      dateRange.endDate = new Date(customEnd).toISOString()
    } else if (timeRange === 'all' && worklogResults.length > 0) {
      const dates = worklogResults
        .filter((r: any) => r.created)
        .map((r: any) => new Date(r.created!).getTime())
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
      // Worklog-only
      worklogTotalTickets,
      worklogTotalHours,
      worklogAvgHoursPerTicket,
      worklogAvgCycleTimeDays,
      worklogAvgLeadTimeDays,
      worklogTotalStoryPoints,
      tickets: allResults
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

    // Find the story points field ID
    const allFields: any = await jiraFetch(c.env, '/rest/api/3/field')
    const storyPointsField = allFields.find((f: any) => 
      f.name?.toLowerCase().includes('story point') || 
      f.name?.toLowerCase().includes('story points')
    )
    const storyPointsFieldId = storyPointsField?.id || 'customfield_10016'

    for (const email of emails) {
      const user = await findUserByEmail(c.env, email)
      if (!user?.accountId) continue

      let timeFilter = ''
      if (timeRange === 'custom' && customStart && customEnd) {
        timeFilter = ` AND worklogDate >= "${customStart}" AND worklogDate <= "${customEnd}"`
      } else if (timeRange !== 'all') {
        timeFilter = ` AND worklogDate >= ${timeRange}`
      }

      // Fetch worklog tickets
      const worklogJql = encodeURIComponent(
        `worklogAuthor = "${user.accountId}" AND statusCategory = Done${timeFilter}`
      )

      const worklogSearch: any = await jiraFetch(
        c.env,
        `/rest/api/3/search/jql?jql=${worklogJql}&expand=changelog&fields=summary,${storyPointsFieldId},created,comment`
      )

      const worklogIssues = worklogSearch.issues || []

      // Fetch closed tickets
      let closedTimeFilter = ''
      if (timeRange === 'custom' && customStart && customEnd) {
        closedTimeFilter = ` AND updated >= "${customStart}" AND updated <= "${customEnd}"`
      } else if (timeRange !== 'all') {
        closedTimeFilter = ` AND updated >= ${timeRange}`
      }

      const closedJql = encodeURIComponent(
        `assignee was "${user.accountId}" AND statusCategory = Done${closedTimeFilter}`
      )

      const closedSearch: any = await jiraFetch(
        c.env,
        `/rest/api/3/search/jql?jql=${closedJql}&expand=changelog&fields=summary,${storyPointsFieldId},created,comment`
      )

      const closedIssues = closedSearch.issues || []

      // Combine and deduplicate
      const worklogKeys = new Set(worklogIssues.map((i: any) => i.key))
      const allIssues = [...worklogIssues, ...closedIssues.filter((i: any) => !worklogKeys.has(i.key))]

      let totalSeconds = 0
      let totalStoryPoints = 0
      let worklogTotalSeconds = 0
      let worklogTotalStoryPoints = 0

      for (const issue of allIssues) {
        // Sum story points
        totalStoryPoints += issue.fields?.[storyPointsFieldId] || 0
        if (worklogKeys.has(issue.key)) {
          worklogTotalStoryPoints += issue.fields?.[storyPointsFieldId] || 0
        }

        // Only fetch worklogs for worklog tickets
        if (worklogKeys.has(issue.key)) {
          const worklogs: any = await jiraFetch(
            c.env,
            `/rest/api/3/issue/${issue.key}/worklog`
          )
          const userLogs = (worklogs.worklogs || []).filter(
            (w: any) => w.author.accountId === user.accountId
          )
          const seconds = userLogs.reduce((sum: number, w: any) => sum + (w.timeSpentSeconds || 0), 0)
          totalSeconds += seconds
          worklogTotalSeconds += seconds
        }

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
      const avgHoursPerTicket = allIssues.length > 0 ? +(totalHours / allIssues.length).toFixed(2) : 0

      // Worklog-only metrics
      const worklogTotalHours = +(worklogTotalSeconds / 3600).toFixed(2)
      const worklogAvgHoursPerTicket = worklogIssues.length > 0 ? +(worklogTotalHours / worklogIssues.length).toFixed(2) : 0

      const cycleTimes = allIssues
        .filter((r: any) => r.firstInProgress && r.closedDate)
        .map((r: any) => {
          const start = new Date(r.firstInProgress!).getTime()
          const end = new Date(r.closedDate!).getTime()
          return (end - start) / (1000 * 60 * 60 * 24)
        })
      const avgCycleTimeDays = cycleTimes.length > 0
        ? +(cycleTimes.reduce((sum: number, d: number) => sum + d, 0) / cycleTimes.length).toFixed(1)
        : 0

      // Worklog-only cycle time
      const worklogCycleTimes = worklogIssues
        .filter((r: any) => r.firstInProgress && r.closedDate)
        .map((r: any) => {
          const start = new Date(r.firstInProgress!).getTime()
          const end = new Date(r.closedDate!).getTime()
          return (end - start) / (1000 * 60 * 60 * 24)
        })
      const worklogAvgCycleTimeDays = worklogCycleTimes.length > 0
        ? +(worklogCycleTimes.reduce((sum: number, d: number) => sum + d, 0) / worklogCycleTimes.length).toFixed(1)
        : 0

      const leadTimes = allIssues
        .filter((r: any) => r.created && r.closedDate)
        .map((r: any) => {
          const start = new Date(r.created!).getTime()
          const end = new Date(r.closedDate!).getTime()
          return (end - start) / (1000 * 60 * 60 * 24)
        })
      const avgLeadTimeDays = leadTimes.length > 0
        ? +(leadTimes.reduce((sum: number, d: number) => sum + d, 0) / leadTimes.length).toFixed(1)
        : 0

      // Worklog-only lead time
      const worklogLeadTimes = worklogIssues
        .filter((r: any) => r.created && r.closedDate)
        .map((r: any) => {
          const start = new Date(r.created!).getTime()
          const end = new Date(r.closedDate!).getTime()
          return (end - start) / (1000 * 60 * 60 * 24)
        })
      const worklogAvgLeadTimeDays = worklogLeadTimes.length > 0
        ? +(worklogLeadTimes.reduce((sum: number, d: number) => sum + d, 0) / worklogLeadTimes.length).toFixed(1)
        : 0

      results.push({
        email,
        displayName: user.displayName,
        totalTickets: allIssues.length,
        totalHours: +totalHours.toFixed(2),
        avgHoursPerTicket,
        avgCycleTimeDays,
        avgLeadTimeDays,
        totalStoryPoints,
        // Worklog-only
        worklogTotalTickets: worklogIssues.length,
        worklogTotalHours: +worklogTotalHours.toFixed(2),
        worklogAvgHoursPerTicket,
        worklogAvgCycleTimeDays,
        worklogAvgLeadTimeDays,
        worklogTotalStoryPoints
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
