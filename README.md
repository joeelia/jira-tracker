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

## Endpoints

GET /search-user?email=user@company.com

GET /metrics?email=user@company.com
