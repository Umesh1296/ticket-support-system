const TICKET_CATEGORIES = Object.freeze([
  'billing',
  'technical',
  'network',
  'hardware',
  'software',
  'account',
  'subscription',
  'infrastructure',
])

const CATEGORY_ALIASES = Object.freeze({
  payment: 'billing',
  refund: 'billing',
  connectivity: 'network',
  installation: 'software',
  device: 'hardware',
  server: 'infrastructure',
  password: 'account',
  security: 'account',
})

function normalizeCategory(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return CATEGORY_ALIASES[normalized] || normalized
}

function normalizeSkill(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')

  if (!normalized) return ''
  return CATEGORY_ALIASES[normalized] || normalized
}

function isSupportedCategory(value) {
  return TICKET_CATEGORIES.includes(normalizeCategory(value))
}

function normalizeSkills(skills) {
  const nextSkills = []
  const seen = new Set()

  for (const skill of Array.isArray(skills) ? skills : [skills]) {
    for (const chunk of String(skill || '').split(/[,\n]+/)) {
      const normalized = normalizeSkill(chunk)
      if (!normalized || seen.has(normalized)) {
        continue
      }

      seen.add(normalized)
      nextSkills.push(normalized)
    }
  }

  return nextSkills
}

module.exports = {
  TICKET_CATEGORIES,
  normalizeCategory,
  normalizeSkill,
  normalizeSkills,
  isSupportedCategory,
}
