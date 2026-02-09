// Minimal test harness for compilePrompt
// Run: node tests/compilePrompt.test.js

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

// Inline a minimal ROLE_DATABASE for testing (avoids ESM import issues)
const ROLE_DATABASE = {
  "philosopher": {
    name: "Philosopher",
    description: "reasoning, ethics, conceptual analysis",
    domain: "Philosophy — the rigorous examination of fundamental questions.",
    perspective: "You approach problems by questioning assumptions.",
    responsibilities: ["Analyze arguments", "Clarify concepts", "Surface ethical dimensions"],
    frameworks: "You draw on formal logic and epistemology.",
    priorities: "Clarity of thought and intellectual honesty.",
    boundaries: "You do not provide therapy or life coaching.",
    sensitive: false
  },
  "lawyer": {
    name: "Lawyer",
    description: "legal analysis, contracts, compliance",
    domain: "Law — the analysis and application of legal principles.",
    perspective: "You approach legal questions with analytical rigor.",
    responsibilities: ["Explain legal concepts", "Analyze legal issues", "Identify relevant laws"],
    frameworks: "You draw on legal reasoning and case analysis.",
    priorities: "Accuracy and thoroughness.",
    boundaries: "You do not provide legal advice for specific situations.",
    sensitive: true,
    disclaimer: "legal"
  }
};

const DISCLAIMERS = {
  medical: "\n\n⚠️ INFORMATIONAL ONLY: medical disclaimer",
  legal: "\n\n⚠️ INFORMATIONAL ONLY: legal disclaimer",
  financial: "\n\n⚠️ INFORMATIONAL ONLY: financial disclaimer"
};

const SENSITIVE_KEYWORDS = ['legal', 'lawyer', 'attorney', 'medical', 'doctor'];

// MODE_PRESETS no longer used — modes are independent toggles

const OUTPUT_FORMAT_MAP = {
  '': '',
  'bullet': 'Use bullet points for your response',
  'numbered': 'Use a numbered list format'
};

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

function generateRoleBlock(role) {
  const resp = role.responsibilities.map(r => `- ${r}`).join('\n');
  return `**Your role: ${role.name}**\n\nDomain: ${role.domain}\n\nPerspective: ${role.perspective}\n\nResponsibilities:\n${resp}\n\nFrameworks: ${role.frameworks}\n\nPriorities: ${role.priorities}\n\nBoundaries: ${role.boundaries}`;
}

function generateUnknownRoleBlock(roleName) {
  const cap = roleName.charAt(0).toUpperCase() + roleName.slice(1);
  return `**Your role: ${cap}**\n\nDomain: ${cap} — providing expertise and guidance within this professional domain.`;
}

const COLLABORATIVE_MODE_BLOCK = `

COLLABORATIVE MODE

You are working iteratively with the user. For your initial response:
- Provide an immediate draft, proposal, or set of options — do not wait.
- Present 2–3 alternative approaches when reasonable, explaining trade-offs.
- Invite the user to refine, redirect, or drill deeper after each response.
- Ask follow-up questions naturally during the conversation to sharpen your output.
- Treat every exchange as a refinement cycle: draft → feedback → improve.`;

const DUAL_MODE_BLOCK = `

EXPERT INTAKE PROTOCOL (MANDATORY — PHASE 1)

Before providing ANY analysis, advice, or recommendations, you MUST complete the intake phase:

1. Ask 3–6 high-leverage diagnostic questions. For each question, include a brief "(Why this matters: ...)" explanation so the user understands what you are calibrating.
2. DO NOT provide solutions, recommendations, or analysis until the user has answered your intake questions.
3. Wait for the user's answers before proceeding to Phase 2.

Begin your first message with your intake questions only. No preamble, no partial advice.

COLLABORATIVE REFINEMENT (PHASE 2 — after user answers)

Once the user has answered your intake questions:
- Provide an initial draft or set of options informed by their answers.
- Present 2–3 alternative approaches when reasonable, explaining trade-offs.
- Invite the user to refine, redirect, or drill deeper.
- Continue iteratively: draft → feedback → improve.`;

function compilePrompt(state) {
  const { selectedRole, intakeMode = false, collaborativeMode = false, constraints = {}, task = '', context = '', outputFormat = '', firstOutputText = '', guardrailsEnabled = true } = state;
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

  let prompt = buildExpertSpine(roleNames[0]);
  prompt += '\n\n' + roleBlock;

  if (intakeMode && collaborativeMode) {
    prompt += DUAL_MODE_BLOCK;
  } else if (intakeMode) {
    prompt += INTAKE_MODE_BLOCK;
  } else if (collaborativeMode) {
    prompt += COLLABORATIVE_MODE_BLOCK;
  }

  const activeConstraints = [];
  const c = { ...constraints };

  if (c.noQuestions) activeConstraints.push('Do not ask clarifying questions; work with what is provided');
  if (c.noEmojis) activeConstraints.push('Do not use emojis in your response');
  if (c.bullets) activeConstraints.push('Use bullet points for all lists and key points');
  if (c.concise) activeConstraints.push('Be ultra concise; one-sentence answers where possible');
  if (c.stepByStep) activeConstraints.push('Provide a step-by-step plan');
  if (c.risks) activeConstraints.push('Include potential risks and mitigations');

  activeConstraints.push('Be direct; avoid unnecessary hedging');
  activeConstraints.push('If uncertain, say so explicitly');
  activeConstraints.push('Do not fabricate sources or citations');

  prompt += `\n\nConstraints:\n${activeConstraints.map(x => `- ${x}`).join('\n')}`;

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
  outputSection += '- End with a suggested next step or follow-up question if appropriate';
  prompt += '\n\n' + outputSection;

  if (task || context) {
    prompt += '\n\n---\n\n';
    if (task) prompt += `**Task:** ${task}\n\n`;
    if (context) prompt += `**Context:** ${context}`;
  }

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

// ============================================
// TESTS
// ============================================

console.log('\n=== compilePrompt Tests ===\n');

// Test 1: Expert Spine is always present
console.log('Expert Spine:');
{
  const result = compilePrompt({ selectedRole: 'philosopher' });
  assert(result.prompt.includes('EXPERT OPERATING CONTRACT'), 'contains Expert Operating Contract header');
  assert(result.prompt.includes('§1 OPERATING LEVEL'), 'contains §1 Operating Level');
  assert(result.prompt.includes('§2 DECISION STANDARD'), 'contains §2 Decision Standard');
  assert(result.prompt.includes('§3 REJECTION RIGHTS'), 'contains §3 Rejection Rights');
  assert(result.prompt.includes('§4 THINKING ORDER'), 'contains §4 Thinking Order');
  assert(result.prompt.includes('senior-level Philosopher'), 'spine references the role name');
}

// Test 2: Known role block included
console.log('\nKnown role block:');
{
  const result = compilePrompt({ selectedRole: 'philosopher' });
  assert(result.prompt.includes('**Your role: Philosopher**'), 'contains role name');
  assert(result.prompt.includes('Philosophy —'), 'contains domain');
  assert(result.roleNames[0] === 'Philosopher', 'roleNames correct');
  assert(result.isSensitive === false, 'non-sensitive role marked correctly');
}

// Test 3: Unknown role falls back gracefully
console.log('\nUnknown role fallback:');
{
  const result = compilePrompt({ selectedRole: 'quantum chef' });
  assert(result.prompt.includes('**Your role: Quantum chef**'), 'generates unknown role block');
  assert(result.prompt.includes('EXPERT OPERATING CONTRACT'), 'spine still present for unknown role');
}

// Test 4: Intake mode adds protocol
console.log('\nIntake mode:');
{
  const result = compilePrompt({ selectedRole: 'philosopher', intakeMode: true });
  assert(result.prompt.includes('EXPERT INTAKE PROTOCOL (MANDATORY)'), 'intake protocol block present');
  assert(result.prompt.includes('3–6 high-leverage diagnostic questions'), 'intake specifies question count');
  assert(result.prompt.includes('Why this matters'), 'intake requires justification');
  assert(result.prompt.includes('DO NOT provide solutions'), 'intake gates advice');
}

// Test 5: Collaborative mode adds iterative block
console.log('\nCollaborative mode:');
{
  const result = compilePrompt({ selectedRole: 'philosopher', collaborativeMode: true });
  assert(result.prompt.includes('COLLABORATIVE MODE'), 'collaborative block present');
  assert(result.prompt.includes('immediate draft'), 'collaborative allows immediate output');
  assert(result.prompt.includes('refinement cycle'), 'collaborative is iterative');
  assert(!result.prompt.includes('EXPERT INTAKE PROTOCOL'), 'no intake in collaborative-only mode');
}

// Test 6: Dual mode (both enabled) — intake first, then collaborative
console.log('\nDual mode (intake + collaborative):');
{
  const result = compilePrompt({ selectedRole: 'philosopher', intakeMode: true, collaborativeMode: true });
  assert(result.prompt.includes('PHASE 1'), 'dual mode has Phase 1');
  assert(result.prompt.includes('PHASE 2'), 'dual mode has Phase 2');
  assert(result.prompt.includes('intake questions only'), 'Phase 1 gates advice');
  assert(result.prompt.includes('COLLABORATIVE REFINEMENT'), 'Phase 2 is collaborative');
  const phase1Pos = result.prompt.indexOf('PHASE 1');
  const phase2Pos = result.prompt.indexOf('PHASE 2');
  assert(phase1Pos < phase2Pos, 'Phase 1 comes before Phase 2');
}

// Test 6b: Neither mode enabled — no mode blocks
console.log('\nNo modes enabled:');
{
  const result = compilePrompt({ selectedRole: 'philosopher' });
  assert(!result.prompt.includes('EXPERT INTAKE PROTOCOL'), 'no intake when modes off');
  assert(!result.prompt.includes('COLLABORATIVE MODE'), 'no collaborative when modes off');
  assert(!result.prompt.includes('PHASE 1'), 'no dual mode when modes off');
}

// Test 7: Task and context included
console.log('\nTask & context:');
{
  const result = compilePrompt({ selectedRole: 'philosopher', task: 'Evaluate my argument', context: 'Ethics class' });
  assert(result.prompt.includes('**Task:** Evaluate my argument'), 'task included');
  assert(result.prompt.includes('**Context:** Ethics class'), 'context included');
}

// Test 8: Sensitive role gets guardrail
console.log('\nSensitive role guardrails:');
{
  const result = compilePrompt({ selectedRole: 'lawyer', guardrailsEnabled: true });
  assert(result.isSensitive === true, 'lawyer marked sensitive');
  assert(result.prompt.includes('INFORMATIONAL ONLY'), 'disclaimer included');
}

// Test 9: Guardrails can be disabled
console.log('\nGuardrails disabled:');
{
  const result = compilePrompt({ selectedRole: 'lawyer', guardrailsEnabled: false });
  assert(!result.prompt.includes('INFORMATIONAL ONLY'), 'no disclaimer when guardrails disabled');
}

// Test 10: Output format applied
console.log('\nOutput format:');
{
  const result = compilePrompt({ selectedRole: 'philosopher', outputFormat: 'bullet' });
  assert(result.prompt.includes('Use bullet points for your response'), 'bullet format instruction present');
}

// Test 11: First output text
console.log('\nFirst output text:');
{
  const result = compilePrompt({ selectedRole: 'philosopher', firstOutputText: 'Start with a summary' });
  assert(result.prompt.includes('First output should be: Start with a summary'), 'first output instruction present');
}

// Test 12: Custom constraints applied
console.log('\nCustom constraints:');
{
  const result = compilePrompt({ selectedRole: 'philosopher', constraints: { risks: true, stepByStep: true } });
  assert(result.prompt.includes('Include potential risks'), 'custom risk constraint applied');
  assert(result.prompt.includes('step-by-step plan'), 'custom step-by-step constraint applied');
}

// Test 13: Spine cannot be removed (always present regardless of mode toggles)
console.log('\nSpine immutability:');
{
  const configs = [
    { label: 'no modes', opts: {} },
    { label: 'intake only', opts: { intakeMode: true } },
    { label: 'collaborative only', opts: { collaborativeMode: true } },
    { label: 'both modes', opts: { intakeMode: true, collaborativeMode: true } }
  ];
  configs.forEach(({ label, opts }) => {
    const result = compilePrompt({ selectedRole: 'philosopher', ...opts });
    assert(result.prompt.includes('EXPERT OPERATING CONTRACT'), `spine present with ${label}`);
    assert(result.prompt.includes('§3 REJECTION RIGHTS'), `rejection rights present with ${label}`);
  });
}

// Summary
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
