let mcpApp: any

const mcpToolDefinitions = [
  {
    name: 'remember_associate',
    description: 'Look up an associate by email and remember their display name/first name for this MCP session.',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Associate email address.' },
        alias: { type: 'string', description: 'Optional short name to remember for this session.' }
      },
      required: ['email']
    }
  },
  {
    name: 'list_sprints',
    description: 'List Jira sprints, including active, future, and closed sprints.',
    inputSchema: {
      type: 'object',
      properties: {
        state: { type: 'string', description: 'Optional comma-separated state filter: active,future,closed.' }
      }
    }
  },
  {
    name: 'get_associate_metrics',
    description: 'Get metrics for one associate. Associate can be an email or a remembered name.',
    inputSchema: {
      type: 'object',
      properties: {
        associate: { type: 'string', description: 'Associate email or remembered name.' },
        timeRange: { type: 'string', default: '-30d' },
        customStart: { type: 'string' },
        customEnd: { type: 'string' },
        sprintIds: { type: 'array', items: { type: 'string' } }
      },
      required: ['associate']
    }
  },
  {
    name: 'compare_associates',
    description: 'Compare multiple associates using the existing compare endpoint.',
    inputSchema: {
      type: 'object',
      properties: {
        associates: { type: 'array', items: { type: 'string' } },
        timeRange: { type: 'string', default: '-30d' },
        customStart: { type: 'string' },
        customEnd: { type: 'string' },
        sprintIds: { type: 'array', items: { type: 'string' } }
      },
      required: ['associates']
    }
  },
  {
    name: 'plan_sprint',
    description: 'Plan sprint capacity using active development load and recent completed sprint history.',
    inputSchema: {
      type: 'object',
      properties: {
        associates: { type: 'array', items: { type: 'string' } },
        sprintId: { type: 'string', description: 'Sprint ID. If omitted, the next future sprint is used, then active sprint.' },
        sprintName: { type: 'string', description: 'Sprint name or substring to find when sprintId is omitted.' },
        historySprints: { type: 'number', default: 3 }
      },
      required: ['associates']
    }
  },
  {
    name: 'explain_associate_for_sprint',
    description: 'Estimate next-sprint story points for one associate and explain current not-done tickets and closeout needs.',
    inputSchema: {
      type: 'object',
      properties: {
        associate: { type: 'string', description: 'Associate email or remembered name.' },
        sprintId: { type: 'string', description: 'Sprint ID. If omitted, the next future sprint is used, then active sprint.' },
        sprintName: { type: 'string', description: 'Sprint name or substring to find when sprintId is omitted.' },
        historySprints: { type: 'number', default: 3 }
      },
      required: ['associate']
    }
  },
  {
    name: 'call_tracker_endpoint',
    description: 'Call one of the app endpoints directly.',
    inputSchema: {
      type: 'object',
      properties: {
        endpoint: {
          type: 'string',
          enum: ['search-user', 'metrics', 'compare', 'sprints', 'sprint-planning']
        },
        params: { type: 'object' }
      },
      required: ['endpoint']
    }
  }
]

const mcpSessions = new Map<string, Map<string, string>>()

function mcpJsonText(value: any) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(value, null, 2)
      }
    ]
  }
}

function mcpText(text: string) {
  return {
    content: [
      {
        type: 'text',
        text
      }
    ]
  }
}

function mcpNormalize(value: any) {
  return String(value || '').trim().toLowerCase()
}

function mcpIsEmail(value: any) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

function mcpGetSessionId(c: any, message: any) {
  const headerSessionId = c.req.header('Mcp-Session-Id') || c.req.header('mcp-session-id')
  const requestedSessionId = headerSessionId || message?.params?.sessionId
  return requestedSessionId || crypto.randomUUID()
}

function mcpGetAliases(sessionId: string) {
  let aliases = mcpSessions.get(sessionId)
  if (!aliases) {
    aliases = new Map<string, string>()
    mcpSessions.set(sessionId, aliases)
  }

  return aliases
}

function mcpRememberAlias(aliases: Map<string, string>, email: string, displayName?: string, alias?: string) {
  if (!email) return

  aliases.set(mcpNormalize(email), email)

  if (displayName) {
    aliases.set(mcpNormalize(displayName), email)
    const firstName = displayName.split(/\s+/)[0]
    if (firstName) aliases.set(mcpNormalize(firstName), email)
  }

  if (alias) {
    aliases.set(mcpNormalize(alias), email)
  }
}

function mcpResolveAssociate(aliases: Map<string, string>, associate: string) {
  if (mcpIsEmail(associate)) return associate.trim()

  const email = aliases.get(mcpNormalize(associate))
  if (email) return email

  throw new Error(`Unknown associate "${associate}". Call remember_associate with their email first, then use their name.`)
}

async function mcpCallEndpoint(c: any, endpoint: string, params: Record<string, any> = {}) {
  const url = new URL(c.req.url)
  url.pathname = `/${endpoint.replace(/^\/+/, '')}`
  url.search = ''

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value))
  }

  const res = await mcpApp.fetch(new Request(url.toString(), { method: 'GET' }), c.env)
  const data: any = await res.json()

  if (!res.ok) {
    throw new Error(data.error || `Endpoint ${endpoint} failed with ${res.status}`)
  }

  return data
}

function mcpSprintTime(sprint: any) {
  return new Date(sprint.startDate || sprint.endDate || sprint.completeDate || 0).getTime()
}

async function mcpSelectSprint(c: any, args: any) {
  if (args.sprintId) return String(args.sprintId)

  const data = await mcpCallEndpoint(c, 'sprints')
  const sprints = data.sprints || []

  if (args.sprintName) {
    const needle = mcpNormalize(args.sprintName)
    const match = sprints.find((s: any) => mcpNormalize(s.name).includes(needle))
    if (!match) throw new Error(`No sprint matched "${args.sprintName}"`)

    return String(match.id)
  }

  const future = sprints
    .filter((s: any) => s.state === 'future')
    .sort((a: any, b: any) => mcpSprintTime(a) - mcpSprintTime(b))[0]
  if (future) return String(future.id)

  const active = sprints
    .filter((s: any) => s.state === 'active')
    .sort((a: any, b: any) => mcpSprintTime(a) - mcpSprintTime(b))[0]
  if (active) return String(active.id)

  throw new Error('No future or active sprint found. Pass sprintId explicitly.')
}

function mcpFilterSprints(sprints: any[], state?: string) {
  if (!state) return sprints

  const states = new Set(state.split(',').map(s => s.trim()).filter(Boolean))
  if (states.size === 0) return sprints

  return sprints.filter((sprint: any) => states.has(sprint.state))
}

function mcpCompactPlanning(data: any) {
  return {
    sprintNames: data.sprintNames,
    dateRange: data.dateRange,
    historySprintNames: data.historySprintNames,
    summary: data.summary,
    associates: (data.associates || []).map((associate: any) => ({
      email: associate.email,
      displayName: associate.displayName,
      capacityStoryPoints: associate.capacityStoryPoints,
      activeDevelopmentStoryPoints: associate.activeDevelopmentStoryPoints,
      testingStoryPoints: associate.testingStoryPoints,
      nextSprintAvailableStoryPoints: associate.nextSprintAvailableStoryPoints,
      utilizationPercent: associate.utilizationPercent,
      recommendation: associate.recommendation,
      currentTickets: (associate.tickets || [])
        .filter((ticket: any) => ticket.type !== 'done')
        .map((ticket: any) => ({
          key: ticket.key,
          summary: ticket.summary,
          status: ticket.status,
          type: ticket.type,
          storyPoints: ticket.storyPoints,
          notClosedReason: ticket.notClosedReason,
          closeNextStep: ticket.closeNextStep,
          bandwidthImpact: ticket.bandwidthImpact
        }))
    }))
  }
}

function mcpExplainAssociatePlanning(data: any, aliases: Map<string, string>) {
  const associate = (data.associates || [])[0]
  if (!associate) return 'No associate data returned.'

  mcpRememberAlias(aliases, associate.email, associate.displayName)

  const lines = [
    `${associate.displayName || associate.email} can take about ${associate.nextSprintAvailableStoryPoints} story points next sprint based on recent capacity.`,
    `Capacity: ${associate.capacityStoryPoints} SP. Active development load: ${associate.activeDevelopmentStoryPoints} SP across ${associate.inProgressTickets} in-progress ticket(s). Testing/review load: ${associate.testingStoryPoints} SP across ${associate.testingTickets} ticket(s).`,
    `Recommendation: ${associate.recommendation}.`
  ]

  const currentTickets = (associate.tickets || []).filter((ticket: any) => ticket.type !== 'done')
  if (currentTickets.length === 0) {
    lines.push('No not-done tickets are assigned in the selected sprint.')
  } else {
    lines.push('Current not-done tickets:')
    for (const ticket of currentTickets) {
      lines.push(`- ${ticket.key} (${ticket.status}, ${ticket.storyPoints ?? 'unestimated'} SP): ${ticket.notClosedReason} Next step: ${ticket.closeNextStep}`)
    }
  }

  return lines.join('\n')
}

async function mcpCallTool(c: any, sessionId: string, name: string, args: any = {}) {
  const aliases = mcpGetAliases(sessionId)

  if (name === 'remember_associate') {
    const data = await mcpCallEndpoint(c, 'search-user', { email: args.email })
    mcpRememberAlias(aliases, args.email, data.displayName, args.alias)

    return mcpJsonText({
      rememberedEmail: args.email,
      displayName: data.displayName,
      aliases: [args.alias, data.displayName, data.displayName?.split(/\s+/)[0]].filter(Boolean)
    })
  }

  if (name === 'list_sprints') {
    const data = await mcpCallEndpoint(c, 'sprints')
    return mcpJsonText({ sprints: mcpFilterSprints(data.sprints || [], args.state || 'active,future') })
  }

  if (name === 'get_associate_metrics') {
    const email = mcpResolveAssociate(aliases, args.associate)
    const data = await mcpCallEndpoint(c, 'metrics', {
      email,
      timeRange: args.timeRange || '-30d',
      customStart: args.customStart,
      customEnd: args.customEnd,
      sprintIds: args.sprintIds
    })
    mcpRememberAlias(aliases, email, data.user?.displayName)
    return mcpJsonText(data)
  }

  if (name === 'compare_associates') {
    const emails = (args.associates || []).map((associate: string) => mcpResolveAssociate(aliases, associate))
    const data = await mcpCallEndpoint(c, 'compare', {
      emails,
      timeRange: args.timeRange || '-30d',
      customStart: args.customStart,
      customEnd: args.customEnd,
      sprintIds: args.sprintIds
    })
    for (const rank of data.rankings || []) {
      mcpRememberAlias(aliases, rank.email, rank.displayName)
    }
    return mcpJsonText(data)
  }

  if (name === 'plan_sprint') {
    const emails = (args.associates || []).map((associate: string) => mcpResolveAssociate(aliases, associate))
    const sprintId = await mcpSelectSprint(c, args)
    const data = await mcpCallEndpoint(c, 'sprint-planning', {
      emails,
      sprintIds: [sprintId],
      historySprints: args.historySprints
    })
    for (const associate of data.associates || []) {
      mcpRememberAlias(aliases, associate.email, associate.displayName)
    }
    return mcpJsonText(mcpCompactPlanning(data))
  }

  if (name === 'explain_associate_for_sprint') {
    const email = mcpResolveAssociate(aliases, args.associate)
    const sprintId = await mcpSelectSprint(c, args)
    const data = await mcpCallEndpoint(c, 'sprint-planning', {
      emails: [email],
      sprintIds: [sprintId],
      historySprints: args.historySprints
    })
    return mcpText(mcpExplainAssociatePlanning(data, aliases))
  }

  if (name === 'call_tracker_endpoint') {
    const data = await mcpCallEndpoint(c, args.endpoint, args.params || {})
    return mcpJsonText(data)
  }

  throw new Error(`Unknown tool: ${name}`)
}

async function mcpHandleMessage(c: any, sessionId: string, message: any) {
  const { id, method, params } = message

  try {
    if (method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: params?.protocolVersion || '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: 'jira-tracker', version: '1.0.0' }
        }
      }
    }

    if (method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: mcpToolDefinitions }
      }
    }

    if (method === 'tools/call') {
      return {
        jsonrpc: '2.0',
        id,
        result: await mcpCallTool(c, sessionId, params?.name, params?.arguments || {})
      }
    }

    if (method === 'ping') {
      return { jsonrpc: '2.0', id, result: {} }
    }

    if (method?.startsWith('notifications/') || id === undefined) {
      return null
    }

    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not found: ${method}` }
    }
  } catch (err: any) {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32000, message: err.message || String(err) }
    }
  }
}

export function registerMcpRoutes(app: any) {
  mcpApp = app
  app.options('/mcp', (c: any) => {
    c.header('Access-Control-Allow-Origin', '*')
    c.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
    c.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id')
    c.header('Access-Control-Expose-Headers', 'Mcp-Session-Id')
    return c.body(null, 204)
  })
  
  app.get('/mcp', (c: any) => {
    c.header('Access-Control-Allow-Origin', '*')
    c.header('Access-Control-Expose-Headers', 'Mcp-Session-Id')
  
    const accept = c.req.header('accept') || ''
    if (accept.includes('text/event-stream')) {
      return c.json({
        error: 'SSE GET is not implemented. Use Streamable HTTP JSON-RPC POST to /mcp.'
      }, 405)
    }
  
    return c.json({
      name: 'jira-tracker MCP',
      transport: 'streamable-http',
      endpoint: '/mcp',
      methods: ['initialize', 'tools/list', 'tools/call', 'ping'],
      tools: mcpToolDefinitions.map(tool => ({
        name: tool.name,
        description: tool.description
      }))
    })
  })
  
  app.delete('/mcp', (c: any) => {
    const sessionId = c.req.header('Mcp-Session-Id') || c.req.header('mcp-session-id')
    if (sessionId) {
      mcpSessions.delete(sessionId)
    }
  
    c.header('Access-Control-Allow-Origin', '*')
    return c.body(null, 204)
  })
  
  app.post('/mcp', async (c: any) => {
    c.header('Access-Control-Allow-Origin', '*')
    c.header('Access-Control-Expose-Headers', 'Mcp-Session-Id')
  
    let message: any
    try {
      message = await c.req.json()
    } catch (err: any) {
      return c.json({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: err.message || 'Invalid JSON' }
      }, 400)
    }
  
    const isBatch = Array.isArray(message)
    const messages = isBatch ? message : [message]
    const sessionId = mcpGetSessionId(c, messages[0])
    c.header('Mcp-Session-Id', sessionId)
  
    const responses = []
    for (const item of messages) {
      if (!item || item.jsonrpc !== '2.0') {
        responses.push({
          jsonrpc: '2.0',
          id: item?.id ?? null,
          error: { code: -32600, message: 'Invalid JSON-RPC request' }
        })
        continue
      }
  
      const response = await mcpHandleMessage(c, sessionId, item)
      if (response) responses.push(response)
    }
  
    if (responses.length === 0) {
      return c.body(null, 202)
    }
  
    return c.json(isBatch ? responses : responses[0])
  })
}
