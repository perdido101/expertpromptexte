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

function generateRoleBlock(role) {
  const resp = role.responsibilities.map(r => `- ${r}`).join('\n');
  return `**Your role: ${role.name}**\n\nDomain: ${role.domain}\n\nPerspective: ${role.perspective}\n\nResponsibilities:\n${resp}\n\nFrameworks: ${role.frameworks}\n\nPriorities: ${role.priorities}\n\nBoundaries: ${role.boundaries}`;
}

function generateUnknownRoleBlock(roleName) {
  const cap = roleName.charAt(0).toUpperCase() + roleName.slice(1);
  return `**Your role: ${cap}**\n\nDomain: ${cap} — providing expertise and guidance within this professional domain.`;
}

// MODE SYSTEM — mirrors popup.js

const MODE_REGISTRY = [
  { id: 'intake' }, { id: 'collaborative' }, { id: 'assume-defaults' },
  { id: 'structured-output' }, { id: 'concise' }, { id: 'deep-dive' },
  { id: 'action-plan' }, { id: 'checklist' }, { id: 'evidence-citations' },
  { id: 'risk-compliance' }, { id: 'decision-memo' }, { id: 'generate-options' },
  { id: 'templates-examples' }, { id: 'absolute' }, { id: 'executive' }
];

const MODE_BLOCKS = {
  intake: `\n\nEXPERT INTAKE PROTOCOL (MANDATORY)\n\nBefore providing ANY analysis, advice, or recommendations, you MUST complete the following intake process:\n\n1. Ask 3–6 high-leverage diagnostic questions. For each question, include a brief "(Why this matters: ...)" explanation so the user understands what you are calibrating.\n2. DO NOT provide solutions, recommendations, or analysis until the user has answered your intake questions.\n3. After receiving answers, proceed with your full expert response, explicitly referencing the user's answers to show how they shaped your advice.\n\nBegin your first message with your intake questions only. No preamble, no partial advice.`,

  collaborative: `\n\nCOLLABORATIVE MODE\n\nYou are working iteratively with the user. For your initial response:\n- Provide an immediate draft, proposal, or set of options — do not wait.\n- Present 2–3 alternative approaches when reasonable, explaining trade-offs.\n- Invite the user to refine, redirect, or drill deeper after each response.\n- Ask follow-up questions naturally during the conversation to sharpen your output.\n- Treat every exchange as a refinement cycle: draft → feedback → improve.`,

  'assume-defaults': `\n\nASSUME REASONABLE DEFAULTS\n\nDo not ask clarifying questions. Instead:\n- Proceed immediately with reasonable assumptions based on the information provided.\n- State your assumptions explicitly at the top of your response.\n- If an assumption is critical and could significantly change your advice, flag it as "Key assumption — verify this."`,

  'structured-output': `\n\nSTRUCTURED OUTPUT\n\nFormat every response with clear hierarchy:\n- Use descriptive headings (H2/H3) to organize major sections.\n- Use bullet points for lists and sub-points.\n- Use bold for key terms and emphasis.\n- Use numbered lists for sequential steps or ranked items.\n- Include a brief summary or TL;DR at the top if the response exceeds 200 words.`,

  concise: `\n\nCONCISE MODE\n\n- Keep responses short and direct.\n- Lead with the answer; add explanation only if essential.\n- One sentence per point where possible.\n- No filler, no throat-clearing, no "great question" preambles.\n- Target: under 150 words unless the question demands more.`,

  'deep-dive': `\n\nDEEP DIVE MODE\n\n- Provide thorough, comprehensive analysis.\n- Explore edge cases, exceptions, and boundary conditions.\n- Present alternative perspectives and their merits.\n- Explain underlying reasoning and first principles.\n- Include relevant context that a non-specialist might miss.\n- Address "what could go wrong" scenarios proactively.`,

  'action-plan': `\n\nACTION PLAN MODE\n\nConvert your advice into a concrete execution plan:\n1. List specific, numbered action steps in chronological order.\n2. For each step, specify: what to do, who should do it (if applicable), and any dependencies.\n3. Flag any blockers or prerequisites.\n4. Include estimated effort or priority (high/medium/low) where relevant.\n5. End with "Immediate next action:" — the single most important first step.`,

  checklist: `\n\nCHECKLIST ONLY\n\nOutput format: checklist only. No narrative, no explanation, no preamble.\n- Use a checkbox marker for each item.\n- Group items under clear headings if multiple categories exist.\n- Order items by priority or logical sequence.\n- Keep each item to one actionable line.`,

  'evidence-citations': `\n\nEVIDENCE & CITATIONS MODE\n\n- Support claims with evidence, data, or established sources when available.\n- Cite specific sources, studies, or frameworks by name when you reference them.\n- NEVER fabricate citations, URLs, DOIs, or paper titles. If you cannot verify a source, say "I believe this is the case based on general domain knowledge, but I cannot cite a specific source."\n- When no sources are available, explicitly state: "No specific sources provided — this is based on domain expertise."`,

  'risk-compliance': `\n\nRISK & COMPLIANCE LENS\n\nFor every recommendation or analysis:\n- Identify risks early (technical, legal, financial, reputational, operational).\n- Rate each risk: likelihood (high/medium/low) × impact (high/medium/low).\n- Propose specific mitigations for each significant risk.\n- Flag any regulatory, compliance, or policy constraints.\n- Note assumptions that, if wrong, would change the risk profile.`,

  'decision-memo': `\n\nDECISION MEMO FORMAT\n\nStructure your response as an internal decision brief:\n1. **Context:** What situation or question prompted this?\n2. **Options:** Present 2–4 distinct options with pros/cons for each.\n3. **Recommendation:** Your recommended option with clear rationale.\n4. **Risks:** Key risks of the recommended path.\n5. **Next Step:** The single concrete action to move forward.`,

  'generate-options': `\n\nGENERATE OPTIONS MODE\n\nProvide 3–7 distinct options (never fewer than 3):\n- Label each option clearly (Option A, Option B, etc.).\n- For each option, include: brief description, pros, cons, and best-fit scenario.\n- End with your recommended option and why.\n- If options naturally cluster, group them (e.g., conservative vs. aggressive approaches).`,

  'templates-examples': `\n\nTEMPLATES & EXAMPLES MODE\n\n- Include at least one reusable template that the user can copy and adapt.\n- Provide a filled-in example showing the template in use with realistic data.\n- Mark template placeholders clearly with [BRACKETS] or <angle brackets>.\n- Add brief annotation for non-obvious fields.`,

  absolute: `\n\nABSOLUTE MODE\n\nCommunication parameters:\n- Be direct and blunt. Zero hedging, zero filler, zero pleasantries.\n- State your professional opinion as a clear position, not a suggestion.\n- If something is wrong, say it plainly. If something will fail, say so.\n- No "it depends" without immediately following with your best judgment given available information.\n- Compress your response to maximum information density. Every sentence must earn its place.`,

  executive: `\n\nEXECUTIVE SUMMARY MODE\n\nStructure every response as an executive briefing:\n1. **Bottom Line Up Front (BLUF):** Lead with your key conclusion or recommendation in 1–2 sentences.\n2. **Key Findings:** 3–5 bullet points covering the most important points.\n3. **Recommendation:** Your specific, actionable recommendation.\n4. **Risks & Considerations:** Brief list of key risks or trade-offs.\n5. **Next Steps:** 2–3 concrete next actions.\n\nKeep total response under 300 words unless the user requests more detail.`
};

const DUAL_MODE_BLOCK = `\n\nEXPERT INTAKE PROTOCOL (MANDATORY — PHASE 1)\n\nBefore providing ANY analysis, advice, or recommendations, you MUST complete the intake phase:\n\n1. Ask 3–6 high-leverage diagnostic questions. For each question, include a brief "(Why this matters: ...)" explanation so the user understands what you are calibrating.\n2. DO NOT provide solutions, recommendations, or analysis until the user has answered your intake questions.\n3. Wait for the user's answers before proceeding to Phase 2.\n\nBegin your first message with your intake questions only. No preamble, no partial advice.\n\nCOLLABORATIVE REFINEMENT (PHASE 2 — after user answers)\n\nOnce the user has answered your intake questions:\n- Provide an initial draft or set of options informed by their answers.\n- Present 2–3 alternative approaches when reasonable, explaining trade-offs.\n- Invite the user to refine, redirect, or drill deeper.\n- Continue iteratively: draft → feedback → improve.`;

const CONCISE_DEEP_DIVE_BLOCK = `\n\nCONCISE SUMMARY + DEEP DIVE\n\nStructure:\n1. Start with a brief summary (2–3 sentences capturing the key takeaway).\n2. Follow with thorough analysis: reasoning, edge cases, alternatives, and risks.\n3. Use a clear "--- Detail below ---" separator between the summary and the deep analysis.`;

function compilePrompt(state) {
  const { selectedRole, enabledModes = [], constraints = {}, task = '', context = '', outputFormat = '', firstOutputText = '', guardrailsEnabled = true } = state;
  const modes = new Set(enabledModes);
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

  // Mode blocks — deterministic order with special interactions
  const hasIntake = modes.has('intake');
  const hasCollaborative = modes.has('collaborative');
  const hasAssumeDefaults = modes.has('assume-defaults');
  const hasConcise = modes.has('concise');
  const hasDeepDive = modes.has('deep-dive');

  // Intake + Collaborative → special dual-phase block
  if (hasIntake && hasCollaborative) {
    prompt += DUAL_MODE_BLOCK;
  } else if (hasIntake) {
    prompt += MODE_BLOCKS['intake'];
  } else if (hasCollaborative) {
    prompt += MODE_BLOCKS['collaborative'];
  }

  // Assume Defaults — suppressed when Intake is active
  if (hasAssumeDefaults && !hasIntake) {
    prompt += MODE_BLOCKS['assume-defaults'];
  }

  // Structured Output (additive)
  if (modes.has('structured-output')) {
    prompt += MODE_BLOCKS['structured-output'];
  }

  // Concise + Deep Dive → combined block; otherwise individual
  if (hasConcise && hasDeepDive) {
    prompt += CONCISE_DEEP_DIVE_BLOCK;
  } else if (hasConcise) {
    prompt += MODE_BLOCKS['concise'];
  } else if (hasDeepDive) {
    prompt += MODE_BLOCKS['deep-dive'];
  }

  // Remaining additive modes in registry order
  const handledModes = new Set(['intake', 'collaborative', 'assume-defaults', 'structured-output', 'concise', 'deep-dive']);
  for (const modeEntry of MODE_REGISTRY) {
    if (modes.has(modeEntry.id) && !handledModes.has(modeEntry.id)) {
      prompt += MODE_BLOCKS[modeEntry.id];
    }
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
  const result = compilePrompt({ selectedRole: 'philosopher', enabledModes: ['intake'] });
  assert(result.prompt.includes('EXPERT INTAKE PROTOCOL (MANDATORY)'), 'intake protocol block present');
  assert(result.prompt.includes('3–6 high-leverage diagnostic questions'), 'intake specifies question count');
  assert(result.prompt.includes('Why this matters'), 'intake requires justification');
  assert(result.prompt.includes('DO NOT provide solutions'), 'intake gates advice');
}

// Test 5: Collaborative mode adds iterative block
console.log('\nCollaborative mode:');
{
  const result = compilePrompt({ selectedRole: 'philosopher', enabledModes: ['collaborative'] });
  assert(result.prompt.includes('COLLABORATIVE MODE'), 'collaborative block present');
  assert(result.prompt.includes('immediate draft'), 'collaborative allows immediate output');
  assert(result.prompt.includes('refinement cycle'), 'collaborative is iterative');
  assert(!result.prompt.includes('EXPERT INTAKE PROTOCOL'), 'no intake in collaborative-only mode');
}

// Test 6: Dual mode (intake + collaborative) — intake first, then collaborative
console.log('\nDual mode (intake + collaborative):');
{
  const result = compilePrompt({ selectedRole: 'philosopher', enabledModes: ['intake', 'collaborative'] });
  assert(result.prompt.includes('PHASE 1'), 'dual mode has Phase 1');
  assert(result.prompt.includes('PHASE 2'), 'dual mode has Phase 2');
  assert(result.prompt.includes('intake questions only'), 'Phase 1 gates advice');
  assert(result.prompt.includes('COLLABORATIVE REFINEMENT'), 'Phase 2 is collaborative');
  const phase1Pos = result.prompt.indexOf('PHASE 1');
  const phase2Pos = result.prompt.indexOf('PHASE 2');
  assert(phase1Pos < phase2Pos, 'Phase 1 comes before Phase 2');
}

// Test 7: No modes enabled — clean baseline
console.log('\nNo modes enabled:');
{
  const result = compilePrompt({ selectedRole: 'philosopher' });
  assert(!result.prompt.includes('EXPERT INTAKE PROTOCOL'), 'no intake when modes off');
  assert(!result.prompt.includes('COLLABORATIVE MODE'), 'no collaborative when modes off');
  assert(!result.prompt.includes('PHASE 1'), 'no dual mode when modes off');
  assert(!result.prompt.includes('ABSOLUTE MODE'), 'no absolute when modes off');
  assert(!result.prompt.includes('EXECUTIVE SUMMARY MODE'), 'no executive when modes off');
  assert(!result.prompt.includes('ASSUME REASONABLE DEFAULTS'), 'no assume-defaults when modes off');
  assert(!result.prompt.includes('CONCISE MODE'), 'no concise when modes off');
  assert(!result.prompt.includes('DEEP DIVE MODE'), 'no deep-dive when modes off');
  assert(!result.prompt.includes('ACTION PLAN MODE'), 'no action-plan when modes off');
  assert(!result.prompt.includes('CHECKLIST ONLY'), 'no checklist when modes off');
}

// Test 8: Assume Reasonable Defaults
console.log('\nAssume Reasonable Defaults:');
{
  const result = compilePrompt({ selectedRole: 'philosopher', enabledModes: ['assume-defaults'] });
  assert(result.prompt.includes('ASSUME REASONABLE DEFAULTS'), 'assume-defaults block present');
  assert(result.prompt.includes('State your assumptions explicitly'), 'instructs to state assumptions');
  assert(result.prompt.includes('Do not ask clarifying questions'), 'forbids questions');
}

// Test 9: Assume Defaults suppressed when Intake is active
console.log('\nIntake overrides Assume Defaults:');
{
  const result = compilePrompt({ selectedRole: 'philosopher', enabledModes: ['intake', 'assume-defaults'] });
  assert(result.prompt.includes('EXPERT INTAKE PROTOCOL'), 'intake present');
  assert(!result.prompt.includes('ASSUME REASONABLE DEFAULTS'), 'assume-defaults suppressed by intake');
}

// Test 10: Structured Output
console.log('\nStructured Output:');
{
  const result = compilePrompt({ selectedRole: 'philosopher', enabledModes: ['structured-output'] });
  assert(result.prompt.includes('STRUCTURED OUTPUT'), 'structured-output block present');
  assert(result.prompt.includes('headings (H2/H3)'), 'specifies heading hierarchy');
}

// Test 11: Concise mode
console.log('\nConcise mode:');
{
  const result = compilePrompt({ selectedRole: 'philosopher', enabledModes: ['concise'] });
  assert(result.prompt.includes('CONCISE MODE'), 'concise block present');
  assert(result.prompt.includes('under 150 words'), 'concise targets word count');
  assert(!result.prompt.includes('DEEP DIVE'), 'no deep-dive in concise-only');
}

// Test 12: Deep Dive mode
console.log('\nDeep Dive mode:');
{
  const result = compilePrompt({ selectedRole: 'philosopher', enabledModes: ['deep-dive'] });
  assert(result.prompt.includes('DEEP DIVE MODE'), 'deep-dive block present');
  assert(result.prompt.includes('edge cases'), 'deep-dive covers edge cases');
  assert(!result.prompt.includes('CONCISE MODE'), 'no concise in deep-dive-only');
}

// Test 13: Concise + Deep Dive → combined block
console.log('\nConcise + Deep Dive combined:');
{
  const result = compilePrompt({ selectedRole: 'philosopher', enabledModes: ['concise', 'deep-dive'] });
  assert(result.prompt.includes('CONCISE SUMMARY + DEEP DIVE'), 'combined block present');
  assert(!result.prompt.includes('CONCISE MODE'), 'no standalone concise');
  assert(!result.prompt.includes('DEEP DIVE MODE'), 'no standalone deep-dive');
  assert(result.prompt.includes('brief summary'), 'combined has summary');
  assert(result.prompt.includes('thorough analysis'), 'combined has deep analysis');
}

// Test 14: Action Plan mode
console.log('\nAction Plan mode:');
{
  const result = compilePrompt({ selectedRole: 'philosopher', enabledModes: ['action-plan'] });
  assert(result.prompt.includes('ACTION PLAN MODE'), 'action-plan block present');
  assert(result.prompt.includes('Immediate next action'), 'action-plan has next action');
}

// Test 15: Checklist Only mode
console.log('\nChecklist Only mode:');
{
  const result = compilePrompt({ selectedRole: 'philosopher', enabledModes: ['checklist'] });
  assert(result.prompt.includes('CHECKLIST ONLY'), 'checklist block present');
  assert(result.prompt.includes('No narrative'), 'checklist forbids narrative');
}

// Test 16: Evidence & Citations mode
console.log('\nEvidence & Citations mode:');
{
  const result = compilePrompt({ selectedRole: 'philosopher', enabledModes: ['evidence-citations'] });
  assert(result.prompt.includes('EVIDENCE & CITATIONS MODE'), 'evidence-citations block present');
  assert(result.prompt.includes('NEVER fabricate citations'), 'forbids fabrication');
  assert(result.prompt.includes('domain expertise'), 'fallback to domain expertise');
}

// Test 17: Risk & Compliance Lens
console.log('\nRisk & Compliance Lens:');
{
  const result = compilePrompt({ selectedRole: 'philosopher', enabledModes: ['risk-compliance'] });
  assert(result.prompt.includes('RISK & COMPLIANCE LENS'), 'risk-compliance block present');
  assert(result.prompt.includes('likelihood'), 'has risk rating');
  assert(result.prompt.includes('mitigations'), 'has mitigations');
}

// Test 18: Decision Memo mode
console.log('\nDecision Memo mode:');
{
  const result = compilePrompt({ selectedRole: 'philosopher', enabledModes: ['decision-memo'] });
  assert(result.prompt.includes('DECISION MEMO FORMAT'), 'decision-memo block present');
  assert(result.prompt.includes('Context:'), 'memo has context section');
  assert(result.prompt.includes('Options:'), 'memo has options section');
  assert(result.prompt.includes('Recommendation:'), 'memo has recommendation');
  assert(result.prompt.includes('Risks:'), 'memo has risks');
  assert(result.prompt.includes('Next Step:'), 'memo has next step');
}

// Test 19: Generate Options mode
console.log('\nGenerate Options mode:');
{
  const result = compilePrompt({ selectedRole: 'philosopher', enabledModes: ['generate-options'] });
  assert(result.prompt.includes('GENERATE OPTIONS MODE'), 'generate-options block present');
  assert(result.prompt.includes('3–7 distinct options'), 'requires 3-7 options');
  assert(result.prompt.includes('pros, cons'), 'requires pros/cons');
}

// Test 20: Templates & Examples mode
console.log('\nTemplates & Examples mode:');
{
  const result = compilePrompt({ selectedRole: 'philosopher', enabledModes: ['templates-examples'] });
  assert(result.prompt.includes('TEMPLATES & EXAMPLES MODE'), 'templates-examples block present');
  assert(result.prompt.includes('reusable template'), 'includes template');
  assert(result.prompt.includes('filled-in example'), 'includes filled example');
}

// Test 21: Absolute mode
console.log('\nAbsolute mode:');
{
  const result = compilePrompt({ selectedRole: 'philosopher', enabledModes: ['absolute'] });
  assert(result.prompt.includes('ABSOLUTE MODE'), 'absolute mode block present');
  assert(result.prompt.includes('Zero hedging, zero filler'), 'absolute enforces bluntness');
  assert(result.prompt.includes('information density'), 'absolute enforces density');
}

// Test 22: Executive Summary mode
console.log('\nExecutive Summary mode:');
{
  const result = compilePrompt({ selectedRole: 'philosopher', enabledModes: ['executive'] });
  assert(result.prompt.includes('EXECUTIVE SUMMARY MODE'), 'executive mode block present');
  assert(result.prompt.includes('Bottom Line Up Front'), 'executive has BLUF');
  assert(result.prompt.includes('Key Findings'), 'executive has key findings');
  assert(result.prompt.includes('Next Steps'), 'executive has next steps');
}

// Test 23: Multiple additive modes combine
console.log('\nMultiple additive modes:');
{
  const result = compilePrompt({ selectedRole: 'philosopher', enabledModes: ['absolute', 'executive', 'evidence-citations', 'risk-compliance'] });
  assert(result.prompt.includes('ABSOLUTE MODE'), 'absolute present');
  assert(result.prompt.includes('EXECUTIVE SUMMARY MODE'), 'executive present');
  assert(result.prompt.includes('EVIDENCE & CITATIONS MODE'), 'evidence-citations present');
  assert(result.prompt.includes('RISK & COMPLIANCE LENS'), 'risk-compliance present');
}

// Test 24: All modes enabled
console.log('\nAll modes enabled:');
{
  const allModes = MODE_REGISTRY.map(m => m.id);
  const result = compilePrompt({ selectedRole: 'philosopher', enabledModes: allModes });
  // intake + collaborative → dual block
  assert(result.prompt.includes('PHASE 1'), 'dual mode from intake+collaborative');
  // assume-defaults suppressed by intake
  assert(!result.prompt.includes('ASSUME REASONABLE DEFAULTS'), 'assume-defaults suppressed');
  // concise + deep-dive → combined
  assert(result.prompt.includes('CONCISE SUMMARY + DEEP DIVE'), 'concise+deep-dive combined');
  // remaining modes present
  assert(result.prompt.includes('ACTION PLAN MODE'), 'action-plan present');
  assert(result.prompt.includes('CHECKLIST ONLY'), 'checklist present');
  assert(result.prompt.includes('EVIDENCE & CITATIONS MODE'), 'evidence-citations present');
  assert(result.prompt.includes('RISK & COMPLIANCE LENS'), 'risk-compliance present');
  assert(result.prompt.includes('DECISION MEMO FORMAT'), 'decision-memo present');
  assert(result.prompt.includes('GENERATE OPTIONS MODE'), 'generate-options present');
  assert(result.prompt.includes('TEMPLATES & EXAMPLES MODE'), 'templates-examples present');
  assert(result.prompt.includes('ABSOLUTE MODE'), 'absolute present');
  assert(result.prompt.includes('EXECUTIVE SUMMARY MODE'), 'executive present');
  assert(result.prompt.includes('STRUCTURED OUTPUT'), 'structured-output present');
}

// Test 25: Intake + Absolute (no special dual block)
console.log('\nIntake + Absolute:');
{
  const result = compilePrompt({ selectedRole: 'philosopher', enabledModes: ['intake', 'absolute'] });
  assert(result.prompt.includes('EXPERT INTAKE PROTOCOL (MANDATORY)'), 'intake present');
  assert(result.prompt.includes('ABSOLUTE MODE'), 'absolute present alongside intake');
  assert(!result.prompt.includes('PHASE 1'), 'no dual mode without collaborative');
}

// Test 26: Task and context included
console.log('\nTask & context:');
{
  const result = compilePrompt({ selectedRole: 'philosopher', task: 'Evaluate my argument', context: 'Ethics class' });
  assert(result.prompt.includes('**Task:** Evaluate my argument'), 'task included');
  assert(result.prompt.includes('**Context:** Ethics class'), 'context included');
}

// Test 27: Sensitive role gets guardrail
console.log('\nSensitive role guardrails:');
{
  const result = compilePrompt({ selectedRole: 'lawyer', guardrailsEnabled: true });
  assert(result.isSensitive === true, 'lawyer marked sensitive');
  assert(result.prompt.includes('INFORMATIONAL ONLY'), 'disclaimer included');
}

// Test 28: Guardrails can be disabled
console.log('\nGuardrails disabled:');
{
  const result = compilePrompt({ selectedRole: 'lawyer', guardrailsEnabled: false });
  assert(!result.prompt.includes('INFORMATIONAL ONLY'), 'no disclaimer when guardrails disabled');
}

// Test 29: Output format applied
console.log('\nOutput format:');
{
  const result = compilePrompt({ selectedRole: 'philosopher', outputFormat: 'bullet' });
  assert(result.prompt.includes('Use bullet points for your response'), 'bullet format instruction present');
}

// Test 30: First output text
console.log('\nFirst output text:');
{
  const result = compilePrompt({ selectedRole: 'philosopher', firstOutputText: 'Start with a summary' });
  assert(result.prompt.includes('First output should be: Start with a summary'), 'first output instruction present');
}

// Test 31: Custom constraints applied
console.log('\nCustom constraints:');
{
  const result = compilePrompt({ selectedRole: 'philosopher', constraints: { risks: true, stepByStep: true } });
  assert(result.prompt.includes('Include potential risks'), 'custom risk constraint applied');
  assert(result.prompt.includes('step-by-step plan'), 'custom step-by-step constraint applied');
}

// Test 32: Spine cannot be removed (always present regardless of modes)
console.log('\nSpine immutability across all mode combinations:');
{
  const configs = [
    { label: 'no modes', opts: {} },
    { label: 'intake only', opts: { enabledModes: ['intake'] } },
    { label: 'collaborative only', opts: { enabledModes: ['collaborative'] } },
    { label: 'intake + collaborative', opts: { enabledModes: ['intake', 'collaborative'] } },
    { label: 'absolute', opts: { enabledModes: ['absolute'] } },
    { label: 'executive', opts: { enabledModes: ['executive'] } },
    { label: 'all modes', opts: { enabledModes: MODE_REGISTRY.map(m => m.id) } },
    { label: 'checklist only', opts: { enabledModes: ['checklist'] } },
    { label: 'decision-memo', opts: { enabledModes: ['decision-memo'] } }
  ];
  configs.forEach(({ label, opts }) => {
    const result = compilePrompt({ selectedRole: 'philosopher', ...opts });
    assert(result.prompt.includes('EXPERT OPERATING CONTRACT'), `spine present with ${label}`);
    assert(result.prompt.includes('§3 REJECTION RIGHTS'), `rejection rights present with ${label}`);
  });
}

// Test 33: Mode determinism — order is consistent
console.log('\nMode determinism:');
{
  const result = compilePrompt({ selectedRole: 'philosopher', enabledModes: ['absolute', 'evidence-citations', 'structured-output'] });
  const structuredPos = result.prompt.indexOf('STRUCTURED OUTPUT');
  const evidencePos = result.prompt.indexOf('EVIDENCE & CITATIONS');
  const absolutePos = result.prompt.indexOf('ABSOLUTE MODE');
  assert(structuredPos < evidencePos, 'structured-output before evidence-citations (registry order)');
  assert(evidencePos < absolutePos, 'evidence-citations before absolute (registry order)');
}

// Summary
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
