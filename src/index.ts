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
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .email-input-wrapper {
      position: relative;
    }

    .email-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      max-height: 200px;
      overflow-y: auto;
      z-index: 1000;
      margin-top: 4px;
    }

    .email-dropdown-item {
      padding: 0.5rem 0.75rem;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .email-dropdown-item:hover {
      background: #f7fafc;
    }

    .email-dropdown-item .delete-email {
      color: #e53e3e;
      font-size: 0.875rem;
      padding: 0.25rem 0.5rem;
      cursor: pointer;
    }

    .email-dropdown-item .delete-email:hover {
      background: #fed7d7;
      border-radius: 4px;
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

    .comparison-table th, .tickets-table th {
      position: relative;
      cursor: help;
    }

    .comparison-table .header-tooltip, .tickets-table .header-tooltip {
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

    .comparison-table th:hover .header-tooltip, .tickets-table th:hover .header-tooltip {
      opacity: 1;
    }

    @keyframes popoverIn {
      0%   { opacity: 0; transform: translateY(8px); }
      60%  { opacity: 1; transform: translateY(-4px); }
      100% { opacity: 1; transform: translateY(0); }
    }

    @keyframes pillPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(102,126,234,0.5); }
      50%       { box-shadow: 0 0 0 7px rgba(102,126,234,0); }
    }

    .zero-metrics-popover {
      display: none;
      position: absolute;
      z-index: 100;
      bottom: calc(100% + 10px);
      left: 0;
    }

    .zero-metrics-popover.visible {
      display: block;
      animation: popoverIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }

    .pill-pulse {
      animation: pillPulse 0.8s ease 3;
    }

    .zero-metrics-popover .popover-box {
      background: white;
      border-radius: 12px;
      padding: 1.25rem 1.5rem 1rem;
      width: 340px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.18);
      position: relative;
      border: 1px solid #e2e8f0;
    }

    .zero-metrics-popover .popover-arrow {
      position: absolute;
      bottom: -10px;
      left: 2rem;
      width: 0;
      height: 0;
      border-left: 10px solid transparent;
      border-right: 10px solid transparent;
      border-top: 10px solid white;
      filter: drop-shadow(0 2px 2px rgba(0,0,0,0.08));
    }

    .zero-metrics-popover .popover-close {
      position: absolute;
      top: 0.6rem;
      right: 0.75rem;
      background: none;
      border: none;
      font-size: 1.25rem;
      cursor: pointer;
      color: #a0aec0;
      line-height: 1;
      padding: 0;
    }

    .zero-metrics-popover .popover-close:hover { color: #2d3748; }

    .zero-metrics-popover p {
      margin: 0.5rem 0 0;
      color: #2d3748;
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .zero-metrics-popover .popover-hint {
      font-size: 0.8rem;
      color: #718096;
      margin-top: 0.5rem;
    }

    .onboarding-arrow {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.3);
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 1500;
    }

    .onboarding-arrow .arrow-content {
      background: white;
      padding: 1rem 1.5rem;
      border-radius: 12px;
      max-width: 350px;
      position: relative;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    }

    .onboarding-arrow .arrow-content p {
      margin: 0;
      color: #2d3748;
      line-height: 1.5;
      font-size: 0.875rem;
    }

    .onboarding-arrow .arrow-pointer {
      position: absolute;
      bottom: -10px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 10px solid transparent;
      border-right: 10px solid transparent;
      border-top: 10px solid white;
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
      margin-bottom: 2.5rem;
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
          <div class="form-group">
            <label for="emailInput">Email</label>
            <div class="email-input-wrapper">
              <input 
                type="email" 
                id="emailInput" 
                placeholder="engineer@example.com" 
                required 
                autocomplete="off"
              >
              <div class="email-dropdown" id="emailDropdown" style="display: none;"></div>
            </div>
          </div>
        </div>
        <div id="compareEngineerForm" style="display: none;">
          <div id="engineerInputs">
            <div class="engineer-input-wrapper">
              <input 
                type="email" 
                class="engineer-email"
                autocomplete="new-password"
                placeholder="Engineer 1 email" 
              >
            </div>
            <div class="engineer-input-wrapper">
              <input 
                type="email" 
                class="engineer-email"
                autocomplete="new-password"
                placeholder="Engineer 2 email" 
              >
            </div>
          </div>
          <button type="button" id="addEngineerBtn" style="padding: 0.5rem 1rem; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer;">+ Add Engineer</button>
        </div>
        <div class="date-filters">
          <select id="timeRangeType">
            <option value="days">Date Range</option>
            <option value="sprint">Sprint</option>
          </select>
          <div id="daysFilter" style="display: flex; gap: 0.5rem; flex: 1;">
            <select id="timeRange">
              <option value="-30d" selected>Last 30 days</option>
              <option value="-7d">Last 7 days</option>
              <option value="-365d">Last 52 weeks</option>
              <option value="all">All time</option>
              <option value="custom">Custom</option>
            </select>
            <input type="date" id="customStartDate" style="display: none;">
            <input type="date" id="customEndDate" style="display: none;">
          </div>
          <div id="sprintFilter" style="display: none; gap: 0.5rem; flex: 1; flex-direction: column;">
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <select id="sprintSelect" style="flex: 1;">
                <option value="">Select a sprint...</option>
              </select>
            </div>
            <div id="extraSprintSelectors"></div>
            <button type="button" id="addSprintBtn" style="display:none; align-self: flex-start; padding: 0.4rem 0.75rem; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.875rem;">+ Add Sprint</button>
          </div>
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
        <div class="metric-card" id="carriedOverCard" style="display: none;">
          <div class="info-icon">?</div>
          <div class="info-tooltip">Story points on tickets that were assigned to a <em>previous sprint</em> at some point before being moved into this sprint and closed. Detected by checking sprint change history in Jira changelog.</div>
          <div class="value" id="carriedOverPoints">0</div>
          <div class="label">Carried Over Story Points</div>
          <div style="font-size:0.7rem; color:#718096; margin-top:0.25rem;">Tickets carried in from prior sprints</div>
          <button type="button" id="carriedOverFilterBtn" style="margin-top:0.5rem; padding:0.3rem 0.6rem; font-size:0.75rem; background:#667eea; color:white; border:none; border-radius:5px; cursor:pointer;">Show Carried Over Tickets</button>
        </div>
      </div>

      <div class="tickets-section" style="position: relative;">
        <div id="zeroMetricsPopover" class="zero-metrics-popover">
          <div class="popover-box">
            <button class="popover-close" id="popoverClose">&times;</button>
            <p><strong>This person doesn't submit worklogs</strong> — they may only create or manage tickets.</p>
            <p class="popover-hint">Click <strong style="color:#667eea">"All"</strong> below to see all tickets where they were assigned.</p>
            <div class="popover-arrow"></div>
          </div>
        </div>
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
              <th>Sprints <span class="info-icon">?</span><div class="header-tooltip">Number of sprints this ticket appeared in. A value &gt; 1 means it was carried over from a prior sprint. Hover the number to see which sprints.</div></th>
            </tr>
          </thead>
          <tbody id="ticketsTableBody">
          </tbody>
        </table>
      </div>
    </div>

    <div class="empty-state" id="emptyState">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <p>Search for an engineer to see their metrics</p>
      </div>

      <div class="onboarding-arrow" id="onboardingArrow" style="display: none;">
        <div class="arrow-content">
          <p>Use filters to switch between All tickets and Work Log tickets</p>
          <div class="arrow-pointer"></div>
        </div>
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
      const timeRangeType = timeRangeTypeSelect.value;
      const selectedSprintIds = getSelectedSprintIds();

      // Store comparison data for pill filtering
      window._compareData = data;
      window._compareContext = { timeRange, customStart, customEnd, timeRangeType, selectedSprintIds };

      // Build sprint label if sprint mode
      let sprintLabel = '';
      if (timeRangeType === 'sprint' && data.sprintNames && data.sprintNames.length) {
        sprintLabel = data.sprintNames.join(' + ');
      }

      // Remove old comparison views
      document.querySelectorAll('.comparison-view').forEach(el => el.remove());

      // Render one table per sprint grouping in data
      const sprintGroups = data.sprintGroups || [{ sprintName: sprintLabel, dateRange: data.dateRange, rankings: data.rankings }];

      sprintGroups.forEach((group, groupIdx) => {
        const tableId = 'compareTableBody_' + groupIdx;
        let comparisonHtml = '<div class="comparison-view" data-group="' + groupIdx + '">';
        comparisonHtml += '<div class="pill-filter" style="display: flex; margin-bottom: 1.5rem;">';
        comparisonHtml += '<button type="button" class="pill-btn" data-filter="all">All <span class="info-icon">?</span><div class="filter-tooltip">Includes worklog tickets and closed tickets where the user was assigned at any point.</div></button>';
        comparisonHtml += '<button type="button" class="pill-btn active" data-filter="worklog">Work Log <span class="info-icon">?</span><div class="filter-tooltip">Tickets where the user logged work.</div></button>';
        comparisonHtml += '</div>';
        comparisonHtml += '<h2>Engineer Comparison' + (group.sprintName ? ': ' + group.sprintName : '') + '</h2>';
        comparisonHtml += '<p class="date-range">' + formatDateRange(group.dateRange) + '</p>';
        comparisonHtml += '<table class="comparison-table"><thead><tr><th>Rank</th><th>Engineer</th><th>Total Tickets <span class="info-icon">?</span><div class="header-tooltip">Total tickets where the engineer was assigned at any point (All) or logged work (Work Log)</div></th><th>Total Story Points <span class="info-icon">?</span><div class="header-tooltip">Sum of story points from all tickets shown</div></th><th>Carried Over SP <span class="info-icon">?</span><div class="header-tooltip">Story points on tickets closed in this sprint that were originally from a previous sprint.</div></th><th>Total Hours <span class="info-icon">?</span><div class="header-tooltip">Total hours logged by this engineer across all tickets shown</div></th><th>Avg Hours/Ticket <span class="info-icon">?</span><div class="header-tooltip">Average hours logged per ticket. Total hours ÷ total tickets</div></th><th>Avg Cycle Time (days) <span class="info-icon">?</span><div class="header-tooltip">Average days from In Progress to Done. Measures active development time</div></th><th>Avg Lead Time (days) <span class="info-icon">?</span><div class="header-tooltip">Average days from ticket creation to completion. Includes backlog wait time</div></th></tr></thead><tbody id="' + tableId + '"></tbody></table></div>';

        results.insertAdjacentHTML('beforeend', comparisonHtml);

        renderCompareRows(group.rankings, 'worklog', timeRange, customStart, customEnd, timeRangeType, selectedSprintIds[groupIdx] || selectedSprintIds[0] || '', tableId);

        // Wire up pill buttons for this group
        const groupEl = results.querySelector('.comparison-view[data-group="' + groupIdx + '"]');
        groupEl.querySelectorAll('.pill-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            groupEl.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.dataset.filter || 'all';
            renderCompareRows(group.rankings, filter, timeRange, customStart, customEnd, timeRangeType, selectedSprintIds[groupIdx] || selectedSprintIds[0] || '', tableId);
          });
        });
      });

      emptyState.classList.remove('show');
      results.classList.add('show');
    }

    function renderCompareRows(rankings, filter, timeRange, customStart, customEnd, timeRangeType, sprintId, tableId) {
      const bodyId = tableId || 'compareTableBody';
      const compareBody = document.getElementById(bodyId);
      if (!compareBody) return;

      let html = '';
      rankings.forEach((rank, index) => {
        const isWorklog = filter === 'worklog';
        const tickets = isWorklog ? (rank.worklogTotalTickets || 0) : rank.totalTickets;
        const storyPoints = isWorklog ? (rank.worklogTotalStoryPoints || 0) : rank.totalStoryPoints;
        const carriedOver = rank.carriedOverStoryPoints || 0;
        const hours = isWorklog ? (rank.worklogTotalHours || 0) : rank.totalHours;
        const avgHours = isWorklog ? (rank.worklogAvgHoursPerTicket || 0) : rank.avgHoursPerTicket;
        const cycleTime = isWorklog ? (rank.worklogAvgCycleTimeDays || 0) : rank.avgCycleTimeDays;
        const leadTime = isWorklog ? (rank.worklogAvgLeadTimeDays || 0) : rank.avgLeadTimeDays;

        let singleUrl = '?search=single&email=' + rank.email;
        if (timeRangeType === 'sprint' && sprintId) {
          singleUrl += '&sprintIds=' + sprintId;
        } else {
          singleUrl += '&time=' + timeRange;
          if (timeRange === 'custom' && customStart && customEnd) {
            singleUrl += '&customStart=' + customStart + '&customEnd=' + customEnd;
          }
        }

        const carriedOverCell = carriedOver > 0
          ? '<td style="color:#e53e3e;font-weight:bold">' + carriedOver + '</td>'
          : '<td>' + carriedOver + '</td>';
        html += '<tr><td>' + (index + 1) + '</td><td>' + rank.displayName + ' <a href="' + singleUrl + '" class="ticket-link" style="font-size: 0.75rem;">(view)</a></td><td>' + tickets + '</td><td>' + (storyPoints || 0) + '</td>' + carriedOverCell + '<td>' + hours + '</td><td>' + avgHours + '</td><td>' + cycleTime + '</td><td>' + leadTime + '</td></tr>';
      });
      compareBody.innerHTML = html;
    }

    const searchForm = document.getElementById('searchForm');
    const emailInput = document.getElementById('emailInput');
    const timeRangeSelect = document.getElementById('timeRange');
    const customStartDate = document.getElementById('customStartDate');
    const customEndDate = document.getElementById('customEndDate');
    const timeRangeTypeSelect = document.getElementById('timeRangeType');
    const daysFilter = document.getElementById('daysFilter');
    const sprintFilter = document.getElementById('sprintFilter');
    const sprintSelect = document.getElementById('sprintSelect');
    const addSprintBtn = document.getElementById('addSprintBtn');
    const extraSprintSelectors = document.getElementById('extraSprintSelectors');
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
    let allSprints = [];


    // Email dropdown functionality
    const emailDropdown = document.getElementById('emailDropdown');

    function getSavedEmails() {
      const saved = localStorage.getItem('savedEmails');
      return saved ? JSON.parse(saved) : [];
    }

    function saveEmail(email) {
      if (!email) return;
      const emails = getSavedEmails();
      if (!emails.includes(email)) {
        emails.push(email);
        localStorage.setItem('savedEmails', JSON.stringify(emails));
      }
    }

    function deleteEmail(email) {
      const emails = getSavedEmails();
      const filtered = emails.filter(e => e !== email);
      localStorage.setItem('savedEmails', JSON.stringify(filtered));
    }

    function showEmailDropdown(input, dropdown) {
      const emails = getSavedEmails();
      if (emails.length === 0) {
        dropdown.style.display = 'none';
        return;
      }

      dropdown.innerHTML = emails.map(email => 
        '<div class="email-dropdown-item"><span>' + email + '</span><span class="delete-email" data-email="' + email + '">×</span></div>'
      ).join('');

      dropdown.style.display = 'block';

      // Add click handlers for dropdown items
      dropdown.querySelectorAll('.email-dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
          if (e.target.classList.contains('delete-email')) {
            e.stopPropagation();
            const emailToDelete = e.target.dataset.email;
            deleteEmail(emailToDelete);
            showEmailDropdown(input, dropdown);
          } else {
            input.value = item.querySelector('span').textContent;
            dropdown.style.display = 'none';
          }
        });
      });
    }

    function wireEmailDropdownForInput(input) {
      const dropdown = document.createElement('div');
      dropdown.className = 'email-dropdown';
      dropdown.style.cssText = 'position: absolute; z-index: 1000; background: white; border: 1px solid #e2e8f0; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 100%; top: 100%; left: 0; display: none; max-height: 200px; overflow-y: auto;';
      const parent = input.parentElement;
      parent.style.position = 'relative';
      parent.appendChild(dropdown);

      function getCompareExclusions() {
        if (!isCompareMode) return new Set();
        const used = new Set();
        document.querySelectorAll('.engineer-email').forEach(el => {
          if (el !== input && el.value.trim()) used.add(el.value.trim().toLowerCase());
        });
        return used;
      }

      function showCompareDropdown() {
        const excluded = getCompareExclusions();
        const value = input.value.toLowerCase();
        const emails = getSavedEmails().filter(e => e.toLowerCase().includes(value) && !excluded.has(e.toLowerCase()));
        if (emails.length === 0) { dropdown.style.display = 'none'; return; }
        dropdown.innerHTML = emails.map(email =>
          '<div class="email-dropdown-item"><span>' + email + '</span><span class="delete-email" data-email="' + email + '">×</span></div>'
        ).join('');
        dropdown.style.display = 'block';
        dropdown.querySelectorAll('.email-dropdown-item').forEach(item => {
          item.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-email')) {
              e.stopPropagation();
              deleteEmail(e.target.dataset.email);
              showCompareDropdown();
            } else {
              input.value = item.querySelector('span').textContent;
              dropdown.style.display = 'none';
            }
          });
        });
      }

      input.addEventListener('focus', showCompareDropdown);
      input.addEventListener('input', showCompareDropdown);
      document.addEventListener('click', (e) => {
        if (!parent.contains(e.target)) dropdown.style.display = 'none';
      }, { capture: true });
    }

    emailInput.addEventListener('focus', () => showEmailDropdown(emailInput, emailDropdown));
    emailInput.addEventListener('input', () => {
      const value = emailInput.value.toLowerCase();
      const emails = getSavedEmails().filter(e => e.toLowerCase().includes(value));
      if (emails.length === 0) {
        emailDropdown.style.display = 'none';
        return;
      }

      emailDropdown.innerHTML = emails.map(email => 
        '<div class="email-dropdown-item"><span>' + email + '</span><span class="delete-email" data-email="' + email + '">×</span></div>'
      ).join('');

      emailDropdown.style.display = 'block';

      emailDropdown.querySelectorAll('.email-dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
          if (e.target.classList.contains('delete-email')) {
            e.stopPropagation();
            const emailToDelete = e.target.dataset.email;
            deleteEmail(emailToDelete);
            showEmailDropdown(emailInput, emailDropdown);
          } else {
            emailInput.value = item.querySelector('span').textContent;
            emailDropdown.style.display = 'none';
          }
        });
      });
    });

    document.addEventListener('click', (e) => {
      if (!emailInput.contains(e.target) && !emailDropdown.contains(e.target)) {
        emailDropdown.style.display = 'none';
      }
    }, { capture: true });

    // Time range type toggle (days vs sprint)
    timeRangeTypeSelect.addEventListener('change', () => {
      if (timeRangeTypeSelect.value === 'days') {
        daysFilter.style.display = 'flex';
        sprintFilter.style.display = 'none';
        addSprintBtn.style.display = 'none';
      } else {
        daysFilter.style.display = 'none';
        sprintFilter.style.display = 'flex';
        // Only show add sprint button in compare mode
        addSprintBtn.style.display = isCompareMode ? 'inline-block' : 'none';
        fetchSprints();
      }
    });

    function getSprintSortDate(sprint) {
      return new Date(sprint.startDate || sprint.endDate || sprint.completeDate || 0).getTime();
    }

    function parseDdcSprint(sprintName) {
      const quarterMatch = sprintName.match(/Q(\d)\.(\d{4})/i);
      const sprintMatch = sprintName.match(/Sprint\s+(\d+)/i);
      return {
        year: quarterMatch ? parseInt(quarterMatch[2], 10) : 0,
        quarter: quarterMatch ? parseInt(quarterMatch[1], 10) : 0,
        sprint: sprintMatch ? parseInt(sprintMatch[1], 10) : 0
      };
    }

    function sortSprints(sprints) {
      return [...sprints].sort((a, b) => {
        const aDdc = a.name?.toUpperCase().startsWith('DDC') ? 1 : 0;
        const bDdc = b.name?.toUpperCase().startsWith('DDC') ? 1 : 0;
        if (aDdc !== bDdc) return bDdc - aDdc;

        if (aDdc && bDdc) {
          const aParts = parseDdcSprint(a.name || '');
          const bParts = parseDdcSprint(b.name || '');
          if (aParts.year !== bParts.year) return bParts.year - aParts.year;
          if (aParts.quarter !== bParts.quarter) return bParts.quarter - aParts.quarter;
          if (aParts.sprint !== bParts.sprint) return bParts.sprint - aParts.sprint;
        }

        return getSprintSortDate(b) - getSprintSortDate(a);
      });
    }

    function renderSprintOptions() {
      sprintSelect.innerHTML = '<option value="">Select a sprint...</option>';
      allSprints.forEach(sprint => {
        const status = sprint.state === 'closed' ? '(Closed)' : '(Open)';
        const dates = formatDateRangeSprint(sprint.startDate, sprint.endDate);
        sprintSelect.innerHTML += '<option value="' + sprint.id + '">' + sprint.name + ' ' + status + ' - ' + dates + '</option>';
      });
    }

    sprintSelect.addEventListener('change', refreshExtraSprintOptions);

    function showSprintOnCorrectPage(sprintId) {
      renderSprintOptions();
      sprintSelect.value = sprintId;
    }

    // Fetch sprints from Jira
    async function fetchSprints() {
      try {
        if (allSprints.length > 0) {
          renderSprintOptions();
          return;
        }

        const response = await fetch('/sprints');
        const data = await response.json();
        if (data.sprints && data.sprints.length > 0) {
          allSprints = sortSprints(data.sprints);
          renderSprintOptions();
        } else {
          sprintSelect.innerHTML = '<option value="">No sprints found</option>';
        }
      } catch (err) {
        console.error('Failed to fetch sprints:', err);
        sprintSelect.innerHTML = '<option value="">Failed to load sprints</option>';
      }
    }

    function formatDateRangeSprint(startDate, endDate) {
      if (!startDate) return 'No start date';
      const start = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        return start.toLocaleDateString() + ' - ' + end.toLocaleDateString();
      }
      return start.toLocaleDateString() + ' - Present';
    }

    function getSelectedSprintIds() {
      const ids = [];
      if (sprintSelect.value) ids.push(sprintSelect.value);
      extraSprintSelectors.querySelectorAll('.extra-sprint-select').forEach(sel => {
        if (sel.value) ids.push(sel.value);
      });
      return ids;
    }

    function getAlreadySelectedSprintIds(excludeSel) {
      const ids = new Set();
      if (sprintSelect.value) ids.add(sprintSelect.value);
      extraSprintSelectors.querySelectorAll('.extra-sprint-select').forEach(s => {
        if (s !== excludeSel && s.value) ids.add(s.value);
      });
      return ids;
    }

    function refreshExtraSprintOptions() {
      // Update main select: disable anything chosen in extra selects
      const extraSelected = new Set();
      extraSprintSelectors.querySelectorAll('.extra-sprint-select').forEach(s => {
        if (s.value) extraSelected.add(s.value);
      });
      Array.from(sprintSelect.options).forEach(opt => {
        if (opt.value) opt.disabled = extraSelected.has(opt.value);
      });

      // Update each extra select: disable anything chosen in main or other extra selects
      extraSprintSelectors.querySelectorAll('.extra-sprint-select').forEach(sel => {
        const alreadySelected = getAlreadySelectedSprintIds(sel);
        Array.from(sel.options).forEach(opt => {
          if (opt.value) opt.disabled = alreadySelected.has(opt.value);
        });
      });
    }

    function buildExtraSprintSelect() {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'display: flex; gap: 0.5rem; align-items: center; margin-top: 0.4rem;';
      const sel = document.createElement('select');
      sel.className = 'extra-sprint-select';
      sel.style.flex = '1';
      const alreadySelected = getAlreadySelectedSprintIds(sel);
      sel.innerHTML = '<option value="">Select a sprint...</option>';
      allSprints.forEach(sprint => {
        const status = sprint.state === 'closed' ? '(Closed)' : '(Open)';
        const dates = formatDateRangeSprint(sprint.startDate, sprint.endDate);
        const disabled = alreadySelected.has(String(sprint.id)) ? ' disabled' : '';
        sel.innerHTML += '<option value="' + sprint.id + '"' + disabled + '>' + sprint.name + ' ' + status + ' - ' + dates + '</option>';
      });
      sel.addEventListener('change', refreshExtraSprintOptions);
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = '×';
      removeBtn.style.cssText = 'padding: 0.4rem 0.6rem; background: #e53e3e; color: white; border: none; border-radius: 6px; cursor: pointer;';
      removeBtn.addEventListener('click', () => { wrapper.remove(); refreshExtraSprintOptions(); });
      wrapper.appendChild(sel);
      wrapper.appendChild(removeBtn);
      return wrapper;
    }

    addSprintBtn.addEventListener('click', () => {
      if (allSprints.length === 0) { alert('Please wait for sprints to load first.'); return; }
      extraSprintSelectors.appendChild(buildExtraSprintSelect());
      refreshExtraSprintOptions();
    });

    // Mode toggle
    singleModeBtn.addEventListener('click', () => {
      isCompareMode = false;
      singleModeBtn.classList.add('active');
      compareModeBtn.classList.remove('active');
      singleEngineerForm.style.display = 'block';
      compareEngineerForm.style.display = 'none';
      pillFilter.style.display = 'flex';
      emailInput.required = true;
      addSprintBtn.style.display = 'none';
      // Remove extra sprint selectors
      extraSprintSelectors.innerHTML = '';

      // Remove required from engineer inputs
      document.querySelectorAll('.engineer-email').forEach(input => {
        input.required = false;
      });

      // Reset UI to single engineer view
      const userInfo = document.getElementById('userInfo');
      const metrics = document.querySelector('.metrics');
      const ticketsSection = document.querySelector('.tickets-section');
      document.querySelectorAll('.comparison-view').forEach(el => el.remove());

      userInfo.style.display = 'block';
      metrics.style.display = 'grid';
      ticketsSection.style.display = 'block';
    });

    compareModeBtn.addEventListener('click', () => {
      isCompareMode = true;
      compareModeBtn.classList.add('active');
      singleModeBtn.classList.remove('active');
      singleEngineerForm.style.display = 'none';
      compareEngineerForm.style.display = 'block';
      pillFilter.style.display = 'none';
      emailInput.required = false;
      // Show add sprint button only in compare+sprint mode
      if (timeRangeTypeSelect.value === 'sprint') {
        addSprintBtn.style.display = 'inline-block';
      }

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

        const sprintCountVal = ticket.sprintCount != null ? ticket.sprintCount : '-';
        const sprintNamesHtml = (ticket.seenSprintNames && ticket.seenSprintNames.length)
          ? ticket.seenSprintNames.map(n => '<div style="white-space:nowrap;padding:2px 0">' + n + '</div>').join('')
          : '';
        const sprintCell = ticket.sprintCount > 1
          ? '<td style="text-align:center; position:relative;"><span class="hours-tooltip" style="cursor:default;"><span style="font-weight:bold;color:#e53e3e">' + sprintCountVal + '</span><div class="tooltip-content" style="min-width:200px;text-align:left;">' + sprintNamesHtml + '</div></span></td>'
          : '<td style="text-align:center;">' + (sprintNamesHtml ? '<span class="hours-tooltip" style="cursor:default;">' + sprintCountVal + '<div class="tooltip-content" style="min-width:200px;text-align:left;">' + sprintNamesHtml + '</div></span>' : sprintCountVal) + '</td>';
        return '<tr><td><a href="' + jiraBaseUrl + ticket.key + '" target="_blank" class="ticket-link">' + ticket.key + '</a></td><td class="ticket-summary" title="' + ticket.summary + '">' + ticket.summary + '</td><td class="ticket-points">' + (ticket.storyPoints || '-') + '</td><td class="hours-tooltip"><span class="ticket-hours">' + ticket.userHours + 'h</span><div class="tooltip-content">' + workersHtml + '<div class="note">Hours shown above are for ' + userName.textContent + ' only</div></div></td><td>' + ticket.comments + '</td><td>' + formatDate(ticket.created) + '</td><td>' + (ticket.firstInProgress ? formatDate(ticket.firstInProgress) : '-') + '</td><td>' + (ticket.closedDate ? formatDate(ticket.closedDate) : '-') + '</td>' + sprintCell + '</tr>'
      }).join('');

      // Update metrics based on filter
      updateMetricsForFilter();
    }

    function showOnboardingArrow() {
      const arrow = document.getElementById('onboardingArrow');
      const pillFilter = document.getElementById('pillFilter');
      if (!arrow || !pillFilter) return;

      // Position arrow above the pill filter
      const filterRect = pillFilter.getBoundingClientRect();
      const arrowContent = arrow.querySelector('.arrow-content');
      if (arrowContent) {
        const arrowWidth = 350;
        const arrowLeft = Math.max(10, filterRect.left + (filterRect.width / 2) - (arrowWidth / 2));
        arrowContent.style.position = 'fixed';
        arrowContent.style.top = (filterRect.top - 70) + 'px';
        arrowContent.style.left = arrowLeft + 'px';
      }

      arrow.style.display = 'flex';

      // Auto-hide after 5 seconds
      setTimeout(() => {
        arrow.style.display = 'none';
      }, 5000);
    }

    function showZeroMetricsModal() {
      const popover = document.getElementById('zeroMetricsPopover');
      const pillFilter = document.getElementById('pillFilter');
      if (!popover || !pillFilter) return;

      popover.classList.remove('visible');
      void popover.offsetWidth; // force reflow to restart animation
      popover.classList.add('visible');
      pillFilter.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Pulse the "All" pill button to draw attention
      const allPill = pillFilter.querySelector('[data-filter="all"]');
      if (allPill) {
        allPill.classList.remove('pill-pulse');
        void allPill.offsetWidth;
        allPill.classList.add('pill-pulse');
        allPill.addEventListener('animationend', () => allPill.classList.remove('pill-pulse'), { once: true });
      }

      // Close button
      document.getElementById('popoverClose').onclick = () => { popover.classList.remove('visible'); popover.style.display = 'none'; };

      // Dismiss on outside click
      setTimeout(() => {
        document.addEventListener('click', function dismissPopover(e) {
          if (!popover.contains(e.target)) {
            popover.style.display = 'none';
            document.removeEventListener('click', dismissPopover);
          }
        });
      }, 0);
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
      wrapper.innerHTML = '<input type="email" class="engineer-email" autocomplete="new-password" placeholder="Engineer ' + engineerCount + ' email"><button type="button" class="delete-engineer-btn">×</button>';
      engineerInputs.appendChild(wrapper);
      wireEmailDropdownForInput(wrapper.querySelector('.engineer-email'));

      // Wire up delete button
      wrapper.querySelector('.delete-engineer-btn').addEventListener('click', () => {
        if (document.querySelectorAll('.engineer-email').length <= 2) {
          alert('You must have at least 2 engineers to compare');
          return;
        }
        wrapper.remove();
      });
    });

    // Add delete buttons and email dropdowns to initial engineer inputs
    document.querySelectorAll('.engineer-input-wrapper').forEach(wrapper => {
      const input = wrapper.querySelector('input');
      wireEmailDropdownForInput(input);
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
      const timeRangeType = timeRangeTypeSelect.value;
      const timeRange = timeRangeSelect.value;
      const customStart = customStartDate.value;
      const customEnd = customEndDate.value;
      const selectedSprintIds = getSelectedSprintIds();
      const sprintId = selectedSprintIds[0] || '';

      if (timeRangeType === 'days') {
        if (timeRange === 'custom' && (!customStart || !customEnd)) {
          error.textContent = 'Please select both start and end dates for custom range';
          error.classList.add('show');
          return;
        }
      } else if (timeRangeType === 'sprint' && selectedSprintIds.length === 0) {
        error.textContent = 'Please select a sprint';
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
          const inputs = document.querySelectorAll('.engineer-email');
          const emails = Array.from(inputs).map((input) => input.value.trim()).filter(e => e);

          if (emails.length < 2) {
            error.textContent = 'Please enter at least 2 engineer emails to compare';
            error.classList.add('show');
            loading.classList.remove('show');
            searchButton.disabled = false;
            return;
          }

          let url = '/compare?emails=' + emails.join(',');
          if (timeRangeType === 'days') {
            url += '&timeRange=' + timeRange;
            if (timeRange === 'custom') {
              url += '&customStart=' + customStart + '&customEnd=' + customEnd;
            }
          } else if (timeRangeType === 'sprint') {
            url += '&sprintIds=' + selectedSprintIds.join(',');
          }

          const response = await fetch(url);
          data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch comparison');
          }

          displayComparison(data);
          
          // Update URL with search parameters (no encoding)
          let urlParams = '?search=compare&email=' + emails.join(',');
          if (timeRangeType === 'days') {
            if (timeRange !== '-30d') {
              urlParams += '&time=' + timeRange;
            }
            if (timeRange === 'custom') {
              urlParams += '&customStart=' + customStart + '&customEnd=' + customEnd;
            }
          } else if (timeRangeType === 'sprint') {
            urlParams += '&sprintIds=' + selectedSprintIds.join(',');
          }
          window.history.pushState({}, '', urlParams);

          // Save emails to local storage
          emails.forEach(saveEmail);
        } else {
          const email = emailInput.value.trim();
          if (!email) return;

          url = '/metrics?email=' + email;
          if (timeRangeType === 'days') {
            url += '&timeRange=' + timeRange;
            if (timeRange === 'custom') {
              url += '&customStart=' + customStart + '&customEnd=' + customEnd;
            }
          } else if (timeRangeType === 'sprint') {
            url += '&sprintIds=' + selectedSprintIds.join(',');
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

          // Show carried-over story points if sprint mode
          const carriedOverCard = document.getElementById('carriedOverCard');
          const carriedOverEl = document.getElementById('carriedOverPoints');
          const carriedOverBtn = document.getElementById('carriedOverFilterBtn');
          if (data.carriedOverStoryPoints != null && carriedOverCard && carriedOverEl) {
            carriedOverEl.textContent = data.carriedOverStoryPoints;
            carriedOverCard.style.display = 'block';
            if (carriedOverBtn) {
              let carriedOverActive = false;
              const carriedTickets = (data.tickets || []).filter(t => t.carriedOver);
              carriedOverBtn.onclick = () => {
                const ticketsSection = document.querySelector('.tickets-section');
                const heading = ticketsSection.querySelector('h2');
                if (!carriedOverActive) {
                  carriedOverActive = true;
                  carriedOverBtn.textContent = 'Hide Carried Over Tickets';
                  carriedOverBtn.style.background = '#e53e3e';
                  allTicketsData = carriedTickets;
                  filterAndDisplayTickets();
                  if (heading) {
                    heading.textContent = 'Carried Over Tickets (' + carriedTickets.length + ')';
                    heading.style.display = 'inline';
                    // Add clear button next to heading
                    let clearBtn = document.getElementById('carriedOverClearBtn');
                    if (!clearBtn) {
                      clearBtn = document.createElement('button');
                      clearBtn.id = 'carriedOverClearBtn';
                      clearBtn.textContent = 'Clear';
                      clearBtn.style.cssText = 'margin-left:0.75rem; padding:0.2rem 0.5rem; font-size:0.75rem; background:#718096; color:white; border:none; border-radius:4px; cursor:pointer; vertical-align:middle;';
                      clearBtn.addEventListener('click', () => carriedOverBtn.click());
                      heading.parentNode.insertBefore(clearBtn, heading.nextSibling);
                    }
                  }
                } else {
                  carriedOverActive = false;
                  carriedOverBtn.textContent = 'Show Carried Over Tickets';
                  carriedOverBtn.style.background = '#667eea';
                  allTicketsData = data.tickets || [];
                  filterAndDisplayTickets();
                  if (heading) heading.textContent = 'Tickets';
                  const clearBtn = document.getElementById('carriedOverClearBtn');
                  if (clearBtn) clearBtn.remove();
                }
              };
            }
          } else if (carriedOverCard) {
            carriedOverCard.style.display = 'none';
          }

          // Store all tickets data for client-side filtering
          allTicketsData = data.tickets || [];

          // Check if all metrics are zero (no worklogs)
          const noWorklogs = data.totalHours === 0 && data.totalTickets > 0;
          if (noWorklogs) {
            // Has tickets but no worklogs - show modal
            showZeroMetricsModal();
          }

          // Display filtered tickets based on current filter
          filterAndDisplayTickets();

          emptyState.classList.remove('show');
          results.classList.add('show');

          // Save email to local storage
          saveEmail(email);

          // Show onboarding arrow on first search
          if (!localStorage.getItem('onboardingShown')) {
            showOnboardingArrow();
            localStorage.setItem('onboardingShown', 'true');
          }
          
          // Update URL with search parameters (no encoding)
          let urlParams = '?search=single&email=' + email;
          if (timeRangeType === 'days') {
            if (timeRange !== '-30d') {
              urlParams += '&time=' + timeRange;
            }
            if (timeRange === 'custom') {
              urlParams += '&customStart=' + customStart + '&customEnd=' + customEnd;
            }
          } else if (timeRangeType === 'sprint') {
            urlParams += '&sprintIds=' + selectedSprintIds.join(',');
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
      const sprintIdsParam = params.get('sprintIds') || params.get('sprintId');

      if (!searchMode || !emailsParam) return;

      const emails = emailsParam.split(',').map(e => e.trim()).filter(Boolean);
      if (!emails.length) return;

      const runSearch = () => {
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
      };

      // Handle sprint parameter
      if (sprintIdsParam) {
        timeRangeTypeSelect.value = 'sprint';
        daysFilter.style.display = 'none';
        sprintFilter.style.display = 'flex';
        fetchSprints().then(() => {
          const ids = sprintIdsParam.split(',');
          showSprintOnCorrectPage(ids[0]);
          // Restore extra sprint selectors
          ids.slice(1).forEach(id => {
            const wrapper = buildExtraSprintSelect();
            extraSprintSelectors.appendChild(wrapper);
            wrapper.querySelector('.extra-sprint-select').value = id;
          });
          runSearch();
        });
        return;
      } else {
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
      }

      // Set custom dates if provided
      if (customStartParam && customEndParam && timeRangeSelect.value !== 'custom') {
        timeRangeSelect.value = 'custom';
        customStartDate.value = customStartParam;
        customEndDate.value = customEndParam;
        customStartDate.style.display = 'block';
        customEndDate.style.display = 'block';
      }

      runSearch();
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
  const sprintIdsRaw = c.req.query('sprintIds') || c.req.query('sprintId')
  const sprintIds = sprintIdsRaw ? sprintIdsRaw.split(',').map(s => s.trim()).filter(Boolean) : []

  if (!email) {
    return c.json({ error: 'Missing email' }, 400)
  }

  try {
    const user = await findUserByEmail(c.env, email)

    if (!user?.accountId) {
      return c.json({ error: 'User not found' }, 404)
    }

    let timeFilter = ''
    let sprintFilter = ''
    let sprintStartDate: string | null = null
    let sprintEndDate: string | null = null
    const sprintNames: string[] = []

    if (sprintIds.length > 0) {
      // Fetch all sprint details in parallel
      const sprintDetails: any[] = await Promise.all(
        sprintIds.map(id => jiraFetch(c.env, `/rest/agile/1.0/sprint/${id}`))
      )
      // Use earliest startDate and latest endDate for display
      const starts = sprintDetails.map(s => s.startDate).filter(Boolean)
      const ends = sprintDetails.map(s => s.endDate || s.completeDate).filter(Boolean)
      sprintStartDate = starts.length ? starts.sort()[0] : null
      sprintEndDate = ends.length ? ends.sort().reverse()[0] : null
      sprintDetails.forEach(s => s.name && sprintNames.push(s.name))
      // Build JQL: sprint in (id1, id2, ...)
      sprintFilter = ` AND sprint in (${sprintIds.join(',')})`
    } else if (timeRange === 'custom' && customStart && customEnd) {
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

    const worklogJqlQuery = `worklogAuthor = "${user.accountId}" AND statusCategory = Done${sprintFilter}${timeFilter}`
    console.log(`Worklog JQL Query: ${worklogJqlQuery}`)

    const worklogJql = encodeURIComponent(worklogJqlQuery)

    const worklogSearch: any = await jiraFetch(
      c.env,
      `/rest/api/3/search/jql?jql=${worklogJql}&expand=changelog&fields=summary,${storyPointsFieldId},created,comment,customfield_10020`
    )

    console.log(`Worklog Issues found: ${worklogSearch.issues?.length || 0}`)

    const worklogIssues = worklogSearch.issues || []

    // Fetch closed tickets (for 'all' filter)
    let closedExtraFilter = ''
    if (sprintIds.length > 0) {
      closedExtraFilter = ` AND sprint in (${sprintIds.join(',')})`
    } else if (timeRange === 'custom' && customStart && customEnd) {
      closedExtraFilter = ` AND updated >= "${customStart}" AND updated <= "${customEnd}"`
    } else if (timeRange !== 'all') {
      closedExtraFilter = ` AND updated >= ${timeRange}`
    }

    const closedJqlQuery = `assignee was "${user.accountId}" AND statusCategory = Done${closedExtraFilter}`
    console.log(`Closed JQL Query: ${closedJqlQuery}`)

    const closedJql = encodeURIComponent(closedJqlQuery)

    const closedSearch: any = await jiraFetch(
      c.env,
      `/rest/api/3/search/jql?jql=${closedJql}&expand=changelog&fields=summary,${storyPointsFieldId},created,comment,customfield_10020`
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
      let carriedOver = false
      const seenSprintIds = new Set<string>()
      const sprintIdNameMap: Record<string, string> = {}

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

          // Track all sprint IDs+names this ticket has ever been in
          if (item.field === 'Sprint') {
            const toIds = (item.to || '').split(',').map((s: string) => s.trim()).filter(Boolean)
            const fromIds = (item.from || '').split(',').map((s: string) => s.trim()).filter(Boolean)
            const toNames = (item.toString || '').split(',').map((s: string) => s.trim()).filter(Boolean)
            const fromNames = (item.fromString || '').split(',').map((s: string) => s.trim()).filter(Boolean)
            toIds.forEach((id: string, i: number) => { seenSprintIds.add(id); if (toNames[i]) sprintIdNameMap[id] = toNames[i] })
            fromIds.forEach((id: string, i: number) => { seenSprintIds.add(id); if (fromNames[i]) sprintIdNameMap[id] = fromNames[i] })

            // Detect carry-over into target sprint
            if (sprintIds.length > 0) {
              const movedIntoTarget = toIds.some((id: string) => sprintIds.includes(id))
              const cameFromDifferentSprint = fromIds.some((id: string) => !sprintIds.includes(id))
              if (movedIntoTarget && cameFromDifferentSprint) {
                carriedOver = true
              }
            }
          }
        }
      }

      // Also add current sprint from fields if available
      const currentSprintField = issue.fields?.sprint || issue.fields?.customfield_10020
      if (currentSprintField) {
        const arr = Array.isArray(currentSprintField) ? currentSprintField : [currentSprintField]
        arr.forEach((s: any) => { if (s?.id) { seenSprintIds.add(String(s.id)); if (s.name) sprintIdNameMap[String(s.id)] = s.name } })
      }

      const sprintCount = seenSprintIds.size || null
      const seenSprintNames = Array.from(seenSprintIds).map(id => sprintIdNameMap[id] || id)

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
        type: 'worklog',
        carriedOver,
        sprintCount,
        seenSprintNames
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
      let carriedOver = false
      const seenSprintIds = new Set<string>()
      const sprintIdNameMap: Record<string, string> = {}

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

          if (item.field === 'Sprint') {
            const toIds = (item.to || '').split(',').map((s: string) => s.trim()).filter(Boolean)
            const fromIds = (item.from || '').split(',').map((s: string) => s.trim()).filter(Boolean)
            const toNames = (item.toString || '').split(',').map((s: string) => s.trim()).filter(Boolean)
            const fromNames = (item.fromString || '').split(',').map((s: string) => s.trim()).filter(Boolean)
            toIds.forEach((id: string, i: number) => { seenSprintIds.add(id); if (toNames[i]) sprintIdNameMap[id] = toNames[i] })
            fromIds.forEach((id: string, i: number) => { seenSprintIds.add(id); if (fromNames[i]) sprintIdNameMap[id] = fromNames[i] })

            if (sprintIds.length > 0) {
              const movedIntoTarget = toIds.some((id: string) => sprintIds.includes(id))
              const cameFromDifferentSprint = fromIds.some((id: string) => !sprintIds.includes(id))
              if (movedIntoTarget && cameFromDifferentSprint) {
                carriedOver = true
              }
            }
          }
        }
      }

      const currentSprintField = issue.fields?.sprint || issue.fields?.customfield_10020
      if (currentSprintField) {
        const arr = Array.isArray(currentSprintField) ? currentSprintField : [currentSprintField]
        arr.forEach((s: any) => { if (s?.id) { seenSprintIds.add(String(s.id)); if (s.name) sprintIdNameMap[String(s.id)] = s.name } })
      }

      const sprintCount = seenSprintIds.size || null
      const seenSprintNames = Array.from(seenSprintIds).map(id => sprintIdNameMap[id] || id)

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
        carriedOver,
        sprintCount,
        seenSprintNames,
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

    // Carried-over story points: detected via changelog sprint field changes
    let carriedOverStoryPoints: number | null = null
    if (sprintIds.length > 0) {
      carriedOverStoryPoints = allResults
        .filter((r: any) => r.carriedOver)
        .reduce((sum: number, r: any) => sum + (r.storyPoints || 0), 0)
    }

    // Calculate date range
    let dateRange = { startDate: null as string | null, endDate: null as string | null }
    if (sprintIds.length > 0 && sprintStartDate) {
      dateRange.startDate = new Date(sprintStartDate).toISOString()
      if (sprintEndDate) {
        dateRange.endDate = new Date(sprintEndDate).toISOString()
      }
    } else if (timeRange === 'custom' && customStart && customEnd) {
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
      carriedOverStoryPoints,
      sprintNames,
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
  const sprintIdsRaw = c.req.query('sprintIds') || c.req.query('sprintId')
  const sprintIds = sprintIdsRaw ? sprintIdsRaw.split(',').map(s => s.trim()).filter(Boolean) : []

  if (!emails || emails.length < 2) {
    return c.json({ error: 'At least 2 emails required' }, 400)
  }

  try {
    // Find the story points field ID
    const allFields: any = await jiraFetch(c.env, '/rest/api/3/field')
    const storyPointsField = allFields.find((f: any) => 
      f.name?.toLowerCase().includes('story point') || 
      f.name?.toLowerCase().includes('story points')
    )
    const storyPointsFieldId = storyPointsField?.id || 'customfield_10016'

    // Fetch all sprint details up-front (if any)
    const sprintDetailsMap: Record<string, any> = {}
    const sprintNames: string[] = []
    if (sprintIds.length > 0) {
      const details: any[] = await Promise.all(
        sprintIds.map(id => jiraFetch(c.env, `/rest/agile/1.0/sprint/${id}`))
      )
      details.forEach((s, i) => {
        sprintDetailsMap[sprintIds[i]] = s
        if (s.name) sprintNames.push(s.name)
      })
    }

    // Process each sprint separately so we get one table per sprint
    const sprintGroups: any[] = []
    const effectiveSprints = sprintIds.length > 0 ? sprintIds : [null]

    for (const currentSprintId of effectiveSprints) {
      const sprintDetail = currentSprintId ? sprintDetailsMap[currentSprintId] : null
      const sprintStartDate: string | null = sprintDetail?.startDate || null
      const sprintEndDate: string | null = sprintDetail?.endDate || sprintDetail?.completeDate || null
      const groupResults: any[] = []

    for (const email of emails) {
      const user = await findUserByEmail(c.env, email)
      if (!user?.accountId) continue

      let timeFilter = ''
      let sprintJql = ''
      if (currentSprintId) {
        sprintJql = ` AND sprint = ${currentSprintId}`
      } else if (timeRange === 'custom' && customStart && customEnd) {
        timeFilter = ` AND worklogDate >= "${customStart}" AND worklogDate <= "${customEnd}"`
      } else if (timeRange !== 'all') {
        timeFilter = ` AND worklogDate >= ${timeRange}`
      }

      // Fetch worklog tickets
      const worklogJql = encodeURIComponent(
        `worklogAuthor = "${user.accountId}" AND statusCategory = Done${sprintJql}${timeFilter}`
      )

      const worklogSearch: any = await jiraFetch(
        c.env,
        `/rest/api/3/search/jql?jql=${worklogJql}&expand=changelog&fields=summary,${storyPointsFieldId},created,comment`
      )

      const worklogIssues = worklogSearch.issues || []

      // Fetch closed tickets
      let closedExtraFilter = ''
      if (currentSprintId) {
        closedExtraFilter = ` AND sprint = ${currentSprintId}`
      } else if (timeRange === 'custom' && customStart && customEnd) {
        closedExtraFilter = ` AND updated >= "${customStart}" AND updated <= "${customEnd}"`
      } else if (timeRange !== 'all') {
        closedExtraFilter = ` AND updated >= ${timeRange}`
      }

      const closedJql = encodeURIComponent(
        `assignee was "${user.accountId}" AND statusCategory = Done${closedExtraFilter}`
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

      // Carried-over story points: detect via changelog Sprint field changes
      let carriedOverStoryPoints = 0
      if (currentSprintId) {
        const allIssuesForCarry = [...worklogIssues, ...closedIssues.filter((i: any) => !worklogKeys.has(i.key))]
        for (const issue of allIssuesForCarry) {
          let isCarried = false
          for (const history of (issue.changelog?.histories || [])) {
            for (const item of (history.items || [])) {
              if (item.field === 'Sprint') {
                const toIds = (item.to || '').split(',').map((s: string) => s.trim()).filter(Boolean)
                const fromIds = (item.from || '').split(',').map((s: string) => s.trim()).filter(Boolean)
                if (toIds.includes(String(currentSprintId)) && fromIds.some((id: string) => id !== String(currentSprintId))) {
                  isCarried = true
                }
              }
            }
          }
          if (isCarried) {
            carriedOverStoryPoints += issue.fields?.[storyPointsFieldId] || 0
          }
        }
      }

      groupResults.push({
        email,
        displayName: user.displayName,
        totalTickets: allIssues.length,
        totalHours: +totalHours.toFixed(2),
        avgHoursPerTicket,
        avgCycleTimeDays,
        avgLeadTimeDays,
        totalStoryPoints,
        carriedOverStoryPoints,
        // Worklog-only
        worklogTotalTickets: worklogIssues.length,
        worklogTotalHours: +worklogTotalHours.toFixed(2),
        worklogAvgHoursPerTicket,
        worklogAvgCycleTimeDays,
        worklogAvgLeadTimeDays,
        worklogTotalStoryPoints
      })
    } // end email loop

    // Sort group by total hours
    groupResults.sort((a, b) => b.totalHours - a.totalHours)

    // Date range for this sprint/group
    let groupDateRange = { startDate: null as string | null, endDate: null as string | null }
    if (currentSprintId && sprintStartDate) {
      groupDateRange.startDate = new Date(sprintStartDate).toISOString()
      groupDateRange.endDate = sprintEndDate ? new Date(sprintEndDate).toISOString() : null
    } else if (timeRange === 'custom' && customStart && customEnd) {
      groupDateRange.startDate = new Date(customStart).toISOString()
      groupDateRange.endDate = new Date(customEnd).toISOString()
    } else if (timeRange === '-7d') {
      const now = new Date()
      groupDateRange.endDate = now.toISOString()
      groupDateRange.startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    } else if (timeRange === '-30d') {
      const now = new Date()
      groupDateRange.endDate = now.toISOString()
      groupDateRange.startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    } else if (timeRange === '-365d') {
      const now = new Date()
      groupDateRange.endDate = now.toISOString()
      groupDateRange.startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString()
    }

    sprintGroups.push({
      sprintId: currentSprintId,
      sprintName: currentSprintId ? sprintDetailsMap[currentSprintId]?.name || '' : '',
      dateRange: groupDateRange,
      rankings: groupResults
    })
    } // end sprint loop

    // For backwards compat, also expose flat rankings from first group
    const firstGroup = sprintGroups[0] || { rankings: [], dateRange: { startDate: null, endDate: null } }

    return c.json({
      rankings: firstGroup.rankings,
      dateRange: firstGroup.dateRange,
      sprintGroups,
      sprintNames
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

app.get('/sprints', async (c) => {
  try {
    const boardId = (c.env as any).JIRA_BOARD_ID;
    if (!boardId) {
      return c.json({ error: 'JIRA_BOARD_ID not configured in environment' }, 500);
    }

    const allSprints = []
    let startAt = 0
    let isLast = false

    while (!isLast) {
      const sprints: any = await jiraFetch(
        c.env,
        `/rest/agile/1.0/board/${boardId}/sprint?state=active,closed&startAt=${startAt}&maxResults=50`
      )

      allSprints.push(...(sprints.values || []))
      isLast = sprints.isLast !== false
      startAt += 50
    }

    return c.json({
      sprints: allSprints
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default app
