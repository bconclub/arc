// Topic color mapping for feed chips
export const TOPIC_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'marketing': { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
  'ai': { bg: 'rgba(139,92,246,0.15)', text: '#a78bfa', border: 'rgba(139,92,246,0.3)' },
  'ai tools': { bg: 'rgba(139,92,246,0.15)', text: '#a78bfa', border: 'rgba(139,92,246,0.3)' },
  'ai agents': { bg: 'rgba(168,85,247,0.15)', text: '#c084fc', border: 'rgba(168,85,247,0.3)' },
  'whatsapp': { bg: 'rgba(34,197,94,0.15)', text: '#4ade80', border: 'rgba(34,197,94,0.3)' },
  'automation': { bg: 'rgba(34,197,94,0.15)', text: '#4ade80', border: 'rgba(34,197,94,0.3)' },
  'lead generation': { bg: 'rgba(249,115,22,0.15)', text: '#fb923c', border: 'rgba(249,115,22,0.3)' },
  'leads': { bg: 'rgba(249,115,22,0.15)', text: '#fb923c', border: 'rgba(249,115,22,0.3)' },
  'sales': { bg: 'rgba(239,68,68,0.15)', text: '#f87171', border: 'rgba(239,68,68,0.3)' },
  'crm': { bg: 'rgba(236,72,153,0.15)', text: '#f472b6', border: 'rgba(236,72,153,0.3)' },
  'growth': { bg: 'rgba(14,165,233,0.15)', text: '#38bdf8', border: 'rgba(14,165,233,0.3)' },
  'startup': { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
  'founder': { bg: 'rgba(99,102,241,0.15)', text: '#818cf8', border: 'rgba(99,102,241,0.3)' },
  'default': { bg: 'transparent', text: '#a1a1aa', border: 'rgba(255,255,255,0.15)' }
}

// Get color for a topic (case-insensitive)
export function getTopicColor(label: string): { bg: string; text: string; border: string } {
  const normalized = label.toLowerCase().trim()
  
  // Try exact match first
  if (TOPIC_COLORS[normalized]) {
    return TOPIC_COLORS[normalized]
  }
  
  // Try partial match
  for (const [key, colors] of Object.entries(TOPIC_COLORS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return colors
    }
  }
  
  // Generate consistent color from hash
  const hue = hashStringToHue(normalized)
  return {
    bg: `hsla(${hue}, 70%, 50%, 0.15)`,
    text: `hsla(${hue}, 70%, 65%, 1)`,
    border: `hsla(${hue}, 70%, 50%, 0.3)`
  }
}

// Generate consistent hue from string
function hashStringToHue(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash % 360)
}
