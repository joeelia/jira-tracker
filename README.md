# Jira Worker Analytics

Cloudflare Worker project for engineering analytics powered by Jira.

Features:
- Search Jira users by email
- Pull worklogs
- Calculate:
  - Time to In Progress
  - Cycle time
  - Logged hours
  - Comment counts
  - Sprint carryover
  - Reopens
  - Story point metrics

## Setup

Install:
pnpm install

Add secrets:
wrangler secret put JIRA_EMAIL
wrangler secret put JIRA_API_TOKEN

Run locally:
pnpm run dev

Deploy:
pnpm run deploy

HTTP MCP endpoint:
http://127.0.0.1:8787/mcp

When deployed, use the Worker URL plus /mcp:
https://your-worker.example.com/mcp

URL-based MCP client config example:
{
  "mcpServers": {
    "jira-tracker": {
      "url": "http://127.0.0.1:8787/mcp"
    }
  }
}

## Endpoints

GET /search-user?email=user@company.com

GET /metrics?email=user@company.com

GET /compare?emails=user1@company.com,user2@company.com

GET /sprints

GET /sprint-planning?emails=user@company.com&sprintIds=123

POST /mcp
