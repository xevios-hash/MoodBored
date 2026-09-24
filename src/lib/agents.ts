// Multi-agent system for MoodBored.
// Default: single agent. Toggle in Settings to enable multiple specialized agents.
// Each agent has a role, expertise, and system prompt. The orchestrator delegates
// tasks to the right agent based on what the user is asking for.

export interface AgentRole {
  id: string
  name: string
  description: string
  expertise: string[]
  preferredKinds: string[]
  color: string
  systemPromptSuffix: string
}

export const AGENT_ROLES: AgentRole[] = [
  {
    id: 'orchestrator',
    name: 'Orchestrator',
    description: 'Coordinates the creative process and delegates to specialists',
    expertise: ['planning', 'delegation', 'synthesis'],
    preferredKinds: [],
    color: '#0d9488',
    systemPromptSuffix: 'You are the orchestrator. Analyze the user\'s request, determine which specialist agents should contribute, and coordinate their work. You can add items directly or delegate by describing what each specialist should create.',
  },
  {
    id: 'color',
    name: 'Color Theorist',
    description: 'Expert in color palettes, harmonies, and emotional impact of color',
    expertise: ['color theory', 'palettes', 'gradients', 'swatches', 'color harmony'],
    preferredKinds: ['palette', 'gradient', 'swatch'],
    color: '#f59e0b',
    systemPromptSuffix: 'You are the Color Theorist. Focus on creating cohesive color palettes, gradients, and swatches that evoke the right mood. Consider complementary, analogous, and triadic color relationships. Always explain your color choices.',
  },
  {
    id: 'typography',
    name: 'Typographer',
    description: 'Expert in font selection, type hierarchy, and readability',
    expertise: ['fonts', 'typography', 'type hierarchy', 'readability'],
    preferredKinds: ['font'],
    color: '#8b5cf6',
    systemPromptSuffix: 'You are the Typographer. Select fonts that match the creative direction. Consider serif vs sans-serif, weight variations, and how type pairs together. Always include sample text and recommended weights.',
  },
  {
    id: 'layout',
    name: 'Spatial Designer',
    description: 'Expert in composition, visual hierarchy, and spatial relationships',
    expertise: ['layout', 'composition', 'visual hierarchy', 'containers', 'grouping'],
    preferredKinds: ['container', 'sizeguide', 'connector'],
    color: '#ec4899',
    systemPromptSuffix: 'You are the Spatial Designer. Organize items into meaningful groups, create containers with appropriate layouts, and establish visual hierarchy through sizing and positioning. Think about how the eye moves across the board.',
  },
  {
    id: 'content',
    name: 'Content Strategist',
    description: 'Expert in messaging, copywriting, and content structure',
    expertise: ['notes', 'text', 'copywriting', 'messaging', 'brand voice'],
    preferredKinds: ['note', 'text'],
    color: '#06b6d4',
    systemPromptSuffix: 'You are the Content Strategist. Craft notes and text that capture the mood, direction, and key messages. Focus on clarity, brevity, and emotional resonance. Every note should serve a purpose on the board.',
  },
  {
    id: 'visual',
    name: 'Visual Researcher',
    description: 'Expert in finding and curating visual references',
    expertise: ['images', 'references', 'mood imagery', 'Unsplash'],
    preferredKinds: ['image', 'video'],
    color: '#10b981',
    systemPromptSuffix: 'You are the Visual Researcher. Find and add images that capture the mood and direction. Use real Unsplash URLs. Every image should have a clear description of why it belongs on the board and what it communicates.',
  },
]

export function getAgentById(id: string): AgentRole | undefined {
  return AGENT_ROLES.find(a => a.id === id)
}

export function getAgentsForTask(userMessage: string): AgentRole[] {
  const lower = userMessage.toLowerCase()
  const agents: AgentRole[] = []

  // Always include orchestrator
  agents.push(AGENT_ROLES[0])

  // Detect which specialists are needed
  if (lower.match(/color|palette|gradient|swatch|theme|tone|hue/)) agents.push(AGENT_ROLES[1])
  if (lower.match(/font|typography|type|text style|serif|sans/)) agents.push(AGENT_ROLES[2])
  if (lower.match(/layout|arrange|organize|group|container|hierarchy|structure/)) agents.push(AGENT_ROLES[3])
  if (lower.match(/note|text|copy|message|content|wording|tagline/)) agents.push(AGENT_ROLES[4])
  if (lower.match(/image|photo|visual|reference|mood|picture|unsplash/)) agents.push(AGENT_ROLES[5])

  // If no specific match, include all specialists
  if (agents.length === 1) return AGENT_ROLES

  return agents
}

export function buildMultiAgentSystemPrompt(
  agents: AgentRole[],
  projectSummary: string,
  boardDescription: string,
  viewportName?: string,
): string {
  const vpInfo = viewportName ? `\nYou are currently working on the "${viewportName}" board.` : ''

  const agentDescriptions = agents.map(a =>
    `**${a.name}** (${a.id}): ${a.description}\n  Expertise: ${a.expertise.join(', ')}\n  ${a.systemPromptSuffix}`
  ).join('\n\n')

  return `You are MoodBored's AI creative team — a group of specialists collaborating on visual mood boards.
${vpInfo}
TEAM ROLES:
${agentDescriptions}

RULES:
1. Each specialist should contribute items in their area of expertise.
2. Use the add_items tool to add items. Each item should include purpose and importance.
3. Use REAL Unsplash URLs for images.
4. Collaborate — the Color Theorist's palette should inform the Typographer's font choices.
5. The Orchestrator coordinates but also contributes directly when needed.
6. NEVER ask clarifying questions. Choose a strong direction and add concrete items.
7. You may write short messages explaining your team's creative decisions.

CURRENT BOARD:
${projectSummary}

${boardDescription}`
}