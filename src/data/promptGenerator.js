// RolePrompt - Prompt Generator Module
// Generates complete prompts from role definitions

import { ROLE_DATABASE } from './roles.js';

// Universal operating contract - prepended to every prompt
const OPERATING_CONTRACT = `You are an expert consultant. Your purpose is to provide thoughtful, well-reasoned assistance within your domain of expertise. You draw on deep knowledge, established frameworks, and practical experience. You think before responding. You acknowledge the boundaries of your role and flag when a question exceeds your scope or requires a qualified professional.`;

// Constraints block - minimal for v1
const CONSTRAINTS_BLOCK = `Constraints:
- Be direct; avoid unnecessary hedging
- If uncertain, say so explicitly
- Do not fabricate sources or citations
- Ask clarifying questions if the request is ambiguous`;

// Output format block
const OUTPUT_FORMAT_BLOCK = `Response format:
- Lead with the most important insight or recommendation
- Use structured formatting (bullets, headers) when helpful
- End with a suggested next step or follow-up question if appropriate`;

// Disclaimer templates for sensitive roles
const DISCLAIMERS = {
  medical: "Provides informational guidance only. This does not constitute professional medical advice. Consult a qualified healthcare professional for decisions affecting your health.",
  legal: "Provides informational guidance only. This does not constitute legal advice. Consult a qualified attorney for decisions affecting your legal standing.",
  financial: "Provides informational guidance only. This does not constitute professional financial advice. Consult a qualified financial professional for decisions affecting your finances."
};

/**
 * Generates a role block for a known role from the database
 */
function generateKnownRoleBlock(role) {
  const responsibilities = role.responsibilities
    .map(r => `- ${r}`)
    .join('\n');

  let roleBlock = `**Your role: ${role.name}**

Domain: ${role.domain}

Perspective: ${role.perspective}

Responsibilities:
${responsibilities}

Frameworks: ${role.frameworks}

Priorities: ${role.priorities}

Boundaries: ${role.boundaries}`;

  // Add disclaimer for sensitive roles
  if (role.sensitive && role.disclaimer) {
    roleBlock += `\n\n${DISCLAIMERS[role.disclaimer]}`;
  }

  return roleBlock;
}

/**
 * Generates a role block for an unknown/custom role
 * Uses a generic schema filled with reasonable defaults
 */
function generateUnknownRoleBlock(roleName) {
  const capitalizedRole = roleName.charAt(0).toUpperCase() + roleName.slice(1);

  return `**Your role: ${capitalizedRole}**

Domain: ${capitalizedRole} — providing expertise and guidance within this professional domain.

Perspective: You approach problems with the mindset of an experienced ${roleName.toLowerCase()}, drawing on domain knowledge and practical experience.

Responsibilities:
- Provide expert guidance within your area of expertise
- Explain concepts clearly and accessibly
- Offer frameworks and approaches relevant to the domain
- Identify important considerations and trade-offs
- Acknowledge limitations and when to seek specialized help

Frameworks: You draw on established methodologies, best practices, and professional standards relevant to your domain.

Priorities: Accuracy, practical utility, and clear communication.

Boundaries: You provide informational guidance based on general expertise. You do not claim specific credentials or replace professional consultation when needed.`;
}

/**
 * Generates a combined role block for multi-role queries (e.g., "marketer + copywriter")
 */
function generateCombinedRoleBlock(roleNames, roles) {
  const names = roles.map(r => r.name).join(' + ');
  const domains = roles.map(r => r.domain.split(' — ')[0]).join(' and ');

  // Combine perspectives
  const perspectives = roles.map(r => r.perspective.replace('You approach', 'approaching'));
  const combinedPerspective = `You bring a hybrid perspective, ${perspectives.join(', and ')}.`;

  // Merge responsibilities (deduplicated)
  const allResponsibilities = new Set();
  roles.forEach(role => {
    role.responsibilities.forEach(r => allResponsibilities.add(r));
  });
  const responsibilities = Array.from(allResponsibilities).slice(0, 8)
    .map(r => `- ${r}`)
    .join('\n');

  // Combine frameworks
  const frameworks = roles.map(r => r.frameworks.replace('You draw on ', '')).join('; also ');

  // Combine priorities
  const priorities = roles.map(r => r.priorities.toLowerCase()).join(', ');

  // Combine boundaries
  const boundaries = roles.map(r => r.boundaries).join(' ');

  // Check if any role is sensitive
  const isSensitive = roles.some(r => r.sensitive);
  const disclaimers = roles
    .filter(r => r.sensitive && r.disclaimer)
    .map(r => r.disclaimer);

  let roleBlock = `**Your role: ${names}**

Domain: Combined expertise in ${domains}.

Perspective: ${combinedPerspective}

Responsibilities:
${responsibilities}

Frameworks: You draw on ${frameworks}.

Priorities: ${priorities.charAt(0).toUpperCase() + priorities.slice(1)}.

Boundaries: ${boundaries}`;

  // Add disclaimers for any sensitive roles
  if (disclaimers.length > 0) {
    const uniqueDisclaimers = [...new Set(disclaimers)];
    uniqueDisclaimers.forEach(d => {
      roleBlock += `\n\n${DISCLAIMERS[d]}`;
    });
  }

  return roleBlock;
}

/**
 * Main function: generates a complete prompt from a role selection
 * @param {string} roleInput - The role string (e.g., "philosopher", "marketer + copywriter")
 * @returns {object} - { prompt: string, isSensitive: boolean, roleNames: string[] }
 */
export function generatePrompt(roleInput) {
  const normalizedInput = roleInput.toLowerCase().trim();

  // Check for multi-role query (contains + or &)
  const isMultiRole = /\s*[+&]\s*/.test(normalizedInput) || /\s+and\s+/i.test(normalizedInput);

  let roleBlock;
  let isSensitive = false;
  let roleNames = [];

  if (isMultiRole) {
    // Split by + or & or "and"
    const parts = normalizedInput.split(/\s*[+&]\s*|\s+and\s+/i).map(p => p.trim()).filter(p => p);
    const foundRoles = [];
    const notFoundParts = [];

    parts.forEach(part => {
      if (ROLE_DATABASE[part]) {
        foundRoles.push(ROLE_DATABASE[part]);
        roleNames.push(ROLE_DATABASE[part].name);
      } else {
        notFoundParts.push(part);
      }
    });

    if (foundRoles.length >= 2) {
      roleBlock = generateCombinedRoleBlock(parts, foundRoles);
      isSensitive = foundRoles.some(r => r.sensitive);
    } else if (foundRoles.length === 1) {
      // Only one role found, use it
      roleBlock = generateKnownRoleBlock(foundRoles[0]);
      roleNames = [foundRoles[0].name];
      isSensitive = foundRoles[0].sensitive;
    } else {
      // No roles found, generate unknown
      roleBlock = generateUnknownRoleBlock(roleInput);
      roleNames = [roleInput];
    }
  } else {
    // Single role query
    if (ROLE_DATABASE[normalizedInput]) {
      const role = ROLE_DATABASE[normalizedInput];
      roleBlock = generateKnownRoleBlock(role);
      isSensitive = role.sensitive;
      roleNames = [role.name];
    } else {
      roleBlock = generateUnknownRoleBlock(roleInput);
      roleNames = [roleInput.charAt(0).toUpperCase() + roleInput.slice(1)];
    }
  }

  // Assemble the complete prompt
  const fullPrompt = `${OPERATING_CONTRACT}

${roleBlock}

${CONSTRAINTS_BLOCK}

${OUTPUT_FORMAT_BLOCK}`;

  return {
    prompt: fullPrompt,
    isSensitive,
    roleNames
  };
}

/**
 * Gets the role data for a known role
 * @param {string} roleKey - The role key
 * @returns {object|null} - The role data or null if not found
 */
export function getRoleData(roleKey) {
  return ROLE_DATABASE[roleKey.toLowerCase()] || null;
}

/**
 * Checks if a role is in the database
 * @param {string} roleKey - The role key
 * @returns {boolean}
 */
export function isKnownRole(roleKey) {
  return roleKey.toLowerCase() in ROLE_DATABASE;
}

export default { generatePrompt, getRoleData, isKnownRole };
