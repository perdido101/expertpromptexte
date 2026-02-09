// ExpertPrompt - Prompt Compiler Module
// Generates complete prompts from role definitions using the Expert Spine

import { ROLE_DATABASE } from './roles.js';

// Disclaimer templates for sensitive roles
const DISCLAIMERS = {
  medical: "\n\n⚠️ INFORMATIONAL ONLY: This does not constitute professional medical advice. Consult a qualified healthcare professional for decisions affecting your health.",
  legal: "\n\n⚠️ INFORMATIONAL ONLY: This does not constitute legal advice. Consult a qualified attorney for decisions affecting your legal standing.",
  financial: "\n\n⚠️ INFORMATIONAL ONLY: This does not constitute professional financial advice. Consult a qualified financial professional for decisions affecting your finances."
};

const SENSITIVE_KEYWORDS = ['medical', 'doctor', 'health', 'diagnos', 'prescri', 'treatment', 'legal', 'lawyer', 'attorney', 'lawsuit', 'financial', 'invest', 'tax', 'accountant', 'therapy', 'therapist', 'psycholog', 'psychiatr', 'nurse', 'pharmac', 'dentist'];

const MODE_PRESETS = {
  default: { noQuestions: false, noEmojis: false, bullets: false, concise: false, stepByStep: false, risks: false },
  absolute: { noQuestions: true, noEmojis: true, bullets: false, concise: true, stepByStep: false, risks: false },
  collaborative: { noQuestions: false, noEmojis: true, bullets: false, concise: false, stepByStep: false, risks: false },
  intake: { noQuestions: false, noEmojis: true, bullets: false, concise: false, stepByStep: false, risks: false },
  executive: { noQuestions: true, noEmojis: true, bullets: true, concise: true, stepByStep: false, risks: true }
};

const OUTPUT_FORMAT_MAP = {
  '': '',
  'bullet': 'Use bullet points for your response',
  'numbered': 'Use a numbered list format',
  'paragraph': 'Write in flowing paragraph format',
  'table': 'Present information in a table format where applicable',
  'json': 'Structure your response as valid JSON',
  'markdown': 'Format your response using Markdown with headers and lists',
  'executive': 'Provide a brief executive summary (2-3 paragraphs max)',
  'detailed': 'Provide a detailed, comprehensive analysis',
  'comparison': 'Present a comparison with pros and cons',
  'actionable': 'Focus only on actionable steps and recommendations'
};

/**
 * Expert Operating Contract — non-negotiable spine included in every prompt.
 */
function buildExpertSpine(roleName) {
  return `EXPERT OPERATING CONTRACT

You are a senior-level ${roleName} operating as a trusted advisor. You do not simulate expertise — you embody it. Every response must reflect the depth, precision, and judgment of a seasoned professional in this domain.

§1 OPERATING LEVEL
You advise as a peer to senior decision-makers. Assume the user is competent but seeking your expert judgment. Do not oversimplify unless asked; do not hedge when you have a clear professional opinion.

§2 DECISION STANDARD
"Good" means: actionable, specific, and grounded in established practice or evidence. Reject vague generalities. Every recommendation must pass the test: "Would a top practitioner in this field give this same advice?"

§3 REJECTION RIGHTS
You MUST push back when:
- The user's premise contains a factual error or flawed assumption
- A request falls outside your domain — flag it and redirect
- The "right" answer is "don't do this" — say so directly
- You lack sufficient context to give responsible advice — ask before guessing

§4 THINKING ORDER
For every response:
1. Clarify the actual problem (not just the stated one)
2. Identify the governing constraints and trade-offs
3. Reason from first principles and domain knowledge
4. Deliver a clear recommendation with supporting rationale
5. Flag risks, edge cases, or areas of genuine uncertainty`;
}

const INTAKE_MODE_BLOCK = `

EXPERT INTAKE PROTOCOL (MANDATORY)

Before providing ANY analysis, advice, or recommendations, you MUST complete the following intake process:

1. Ask 3–6 high-leverage diagnostic questions. For each question, include a brief "(Why this matters: ...)" explanation so the user understands what you are calibrating.
2. DO NOT provide solutions, recommendations, or analysis until the user has answered your intake questions.
3. After receiving answers, proceed with your full expert response, explicitly referencing the user's answers to show how they shaped your advice.

Begin your first message with your intake questions only. No preamble, no partial advice.`;

/**
 * Generates a role block for a known role from the database.
 */
function generateRoleBlock(role) {
  const responsibilities = role.responsibilities.map(r => `- ${r}`).join('\n');
  let block = `**Your role: ${role.name}**

Domain: ${role.domain}

Perspective: ${role.perspective}

Responsibilities:
${responsibilities}

Frameworks: ${role.frameworks}

Priorities: ${role.priorities}

Boundaries: ${role.boundaries}`;

  if (role.sensitive && role.disclaimer) {
    block += `\n\n${DISCLAIMERS[role.disclaimer]}`;
  }
  return block;
}

/**
 * Generates a role block for an unknown/custom role.
 */
function generateUnknownRoleBlock(roleName) {
  const cap = roleName.charAt(0).toUpperCase() + roleName.slice(1);
  return `**Your role: ${cap}**

Domain: ${cap} — providing expertise and guidance within this professional domain.

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
 * Main compiler: deterministic function that takes full state and returns prompt string.
 * @param {object} state - { selectedRole, mode, constraints, task, context, outputFormat, firstOutputText, guardrailsEnabled }
 * @returns {object} - { prompt, isSensitive, roleNames }
 */
export function compilePrompt(state) {
  const { selectedRole, mode = 'default', constraints = {}, task = '', context = '', outputFormat = '', firstOutputText = '', guardrailsEnabled = true } = state;
  const roleInput = selectedRole || '';
  const q = roleInput.toLowerCase().trim();

  let isSensitive = false;
  let roleNames = [];
  let roleBlock = '';

  const role = ROLE_DATABASE[q];
  if (role) {
    roleBlock = generateRoleBlock(role);
    isSensitive = role.sensitive;
    roleNames = [role.name];
  } else {
    roleBlock = generateUnknownRoleBlock(roleInput);
    roleNames = [roleInput.charAt(0).toUpperCase() + roleInput.slice(1)];
  }

  // 1) Expert Spine
  let prompt = buildExpertSpine(roleNames[0]);

  // 2) Role block
  prompt += '\n\n' + roleBlock;

  // 3) Intake mode gate
  if (mode === 'intake') {
    prompt += INTAKE_MODE_BLOCK;
  }

  // 4) Constraints
  const activeConstraints = [];
  const modePreset = MODE_PRESETS[mode] || MODE_PRESETS.default;
  const c = { ...modePreset, ...constraints };

  if (c.noQuestions) activeConstraints.push('Do not ask clarifying questions; work with what is provided');
  if (c.noEmojis) activeConstraints.push('Do not use emojis in your response');
  if (c.bullets) activeConstraints.push('Use bullet points for all lists and key points');
  if (c.concise) activeConstraints.push('Be ultra concise; one-sentence answers where possible');
  if (c.stepByStep) activeConstraints.push('Provide a step-by-step plan');
  if (c.risks) activeConstraints.push('Include potential risks and mitigations');

  activeConstraints.push('Be direct; avoid unnecessary hedging');
  activeConstraints.push('If uncertain, say so explicitly');
  activeConstraints.push('Do not fabricate sources or citations');
  if (!c.noQuestions && mode === 'collaborative') {
    activeConstraints.push('Ask clarifying questions before providing your analysis');
  }

  prompt += `\n\nConstraints:\n${activeConstraints.map(x => `- ${x}`).join('\n')}`;

  // 5) Output format
  let outputSection = 'Response format:\n';
  if (outputFormat && OUTPUT_FORMAT_MAP[outputFormat]) {
    outputSection += `- ${OUTPUT_FORMAT_MAP[outputFormat]}\n`;
  }
  if (firstOutputText) {
    outputSection += `- First output should be: ${firstOutputText}\n`;
  }
  outputSection += '- Lead with the most important insight or recommendation\n';
  if (!outputFormat || !['bullet', 'numbered', 'table', 'json'].includes(outputFormat)) {
    outputSection += '- Use structured formatting (bullets, headers) when helpful\n';
  }
  if (mode !== 'absolute') {
    outputSection += '- End with a suggested next step or follow-up question if appropriate';
  }
  prompt += '\n\n' + outputSection;

  // 6) Task and context
  if (task || context) {
    prompt += '\n\n---\n\n';
    if (task) prompt += `**Task:** ${task}\n\n`;
    if (context) prompt += `**Context:** ${context}`;
  }

  // 7) Guardrails
  if (guardrailsEnabled && isSensitive) {
    const roleStr = roleInput.toLowerCase();
    if (SENSITIVE_KEYWORDS.some(kw => roleStr.includes(kw))) {
      if (roleStr.match(/medical|doctor|health|nurse|pharmac|dentist|therap|psycholog/)) {
        prompt += DISCLAIMERS.medical;
      } else if (roleStr.match(/legal|lawyer|attorney/)) {
        prompt += DISCLAIMERS.legal;
      } else if (roleStr.match(/financial|invest|tax|accountant/)) {
        prompt += DISCLAIMERS.financial;
      }
    }
  }

  return { prompt, isSensitive, roleNames };
}

/**
 * Gets the role data for a known role.
 */
export function getRoleData(roleKey) {
  return ROLE_DATABASE[roleKey.toLowerCase()] || null;
}

/**
 * Checks if a role is in the database.
 */
export function isKnownRole(roleKey) {
  return roleKey.toLowerCase() in ROLE_DATABASE;
}

export { buildExpertSpine, INTAKE_MODE_BLOCK, MODE_PRESETS };
export default { compilePrompt, getRoleData, isKnownRole };
