# ExpertPrompt Extension

A Chrome/Edge Manifest V3 extension for generating expert role prompts with advanced customization options.

## Links

- [Privacy Policy](https://perdido101.github.io/expertpromptexte/privacy-policy)

## Loading the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the project folder
5. The extension icon will appear in your toolbar

## Features

### Core Features

- **Role Search**: Search 200+ expert roles with fuzzy matching and synonyms
- **Instant Generation**: Select a role and get a complete, structured prompt
- **One-Click Copy**: Copy to clipboard instantly

### Pro Features (All Enabled)

#### 1. Saved Roles (Presets)
- Save your current configuration as a named preset
- Includes: role, mode, constraints, task/context settings
- Load, duplicate, delete presets with one click
- Set a default preset that loads automatically

#### 2. Custom Constraints
Toggle constraints that modify the generated prompt:
- No questions (don't ask clarifying questions)
- No emojis
- Bullet points only
- Ultra concise (one-sentence answers)
- Step-by-step plan
- Include risks & mitigations
- Specify first output (custom field)

#### 3. Modes (Style Presets)
- **Default**: Balanced, standard expert behavior
- **Absolute**: Blunt, directive, no fluff, no questions
- **Collaborative**: Asks clarifying questions first
- **Expert Intake**: Forces the expert to ask 3–6 diagnostic questions before giving advice (distinct from Collaborative)
- **Executive Summary**: Tight, structured summary with recommendations

Modes pre-fill constraint settings but you can override them.

#### 4. Task & Context
Add optional context to your prompt:
- **Task/Goal**: What you want accomplished
- **Context**: Background information
- **Output Format**: How you want the response structured

#### 5. Editable Preview
- Toggle "Edit" to modify the generated prompt directly
- Changes persist for the session until you regenerate

#### 6. Regenerate Prompt
- Changes to mode/constraints/context mark the output as "stale" (visual indicator)
- Click **Regenerate Prompt** to recompile with updated settings
- Selecting a new role auto-generates immediately
- Copy and Export always use the latest generated output

#### 7. Prompt History
- Automatically saves last 50 generated prompts
- Load any previous prompt with one click
- Copy directly from history

#### 8. Export
- Export as `.txt` or `.md` file
- Includes role info and timestamp in markdown format

#### 9. Sensitive Role Guardrails
- Auto-detects medical/legal/financial roles
- Adds "informational only" disclaimer to the prompt
- Toggle on/off in Settings (gear icon)

#### 10. Privacy
- All data stored locally in your browser
- No network calls or external services
- Uses Chrome storage API (syncs if signed in)

## Architecture

### Feature Flags
The extension uses a feature flag system for future Pro gating:

```javascript
const FEATURE_FLAGS = {
  savedRoles: true,
  modes: true,
  history: true,
  export: true,
  guardrails: true,
  editing: true,
  constraints: true,
  taskContext: true
};
```

All flags are `true` by default. To gate features behind payment later, set individual flags to `false` and check `FEATURE_FLAGS.featureName` before rendering those UI sections.

### File Structure

```
src/
├── popup/
│   ├── popup.html    # Main popup UI
│   ├── popup.css     # All styles
│   └── popup.js      # Bundled: roles database + search + prompt compiler + UI
tests/
│   └── compilePrompt.test.js  # Node test harness
public/
├── icon16.png
├── icon48.png
└── icon128.png
manifest.json
```

### Storage

Uses `chrome.storage.local` for persistence:
- `presets`: Array of saved preset configurations
- `history`: Array of last 50 generated prompts
- `defaultPresetId`: ID of the default preset (if set)
- `guardrailsEnabled`: Boolean for guardrails toggle

## Usage Tips

1. **Quick Start**: Just type a role and press Enter
2. **Power User**: Expand sections to access modes, constraints, and context
3. **Expert Intake**: Use "Expert Intake" mode to force diagnostic questions before advice
4. **Regenerate**: Change settings freely, then click Regenerate when ready
5. **Sensitive Topics**: Keep guardrails ON for medical/legal/financial roles
6. **Presets**: Save commonly-used configurations for one-click access

## What Changed (v2.0)

### Expert Spine (non-removable operating contract)
Every generated prompt now includes a structured **Expert Operating Contract** with four sections:
1. **Operating Level** — peer-to-peer advisor stance
2. **Decision Standard** — actionable, specific, practitioner-grade advice
3. **Rejection Rights** — the expert pushes back on bad premises, scope violations, or insufficient context
4. **Thinking Order** — structured reasoning: problem → constraints → first principles → recommendation → risks

This replaces the generic "You are an expert consultant" boilerplate.

### Role Chain Mode removed
Multi-role chaining has been removed. If you had a chain saved, the first role is preserved as your primary role. Single-role prompts produce higher-quality, more focused output.

### Expert Intake Mode added
A new mode: **Expert Intake (questions first)**. When enabled, the expert MUST ask 3–6 high-leverage diagnostic questions (each with a "why it matters" explanation) before providing any advice. Distinct from Collaborative mode, which simply suggests the AI ask questions.

### Regenerate Prompt button
The prompt no longer auto-updates on every toggle. Change role/mode/constraints freely — the output shows a "stale" indicator — then click **Regenerate Prompt** to recompile. Selecting a new role still auto-generates immediately.

### Tests
Run `node tests/compilePrompt.test.js` to verify the prompt compiler (41 assertions).

## 2-Minute Manual Test Checklist

1. **Load extension** → open popup → search "philosopher" → select → verify prompt starts with "EXPERT OPERATING CONTRACT" and contains §1–§4
2. **Change mode to "Expert Intake"** → see stale indicator appear → click **Regenerate** → verify prompt now contains "EXPERT INTAKE PROTOCOL (MANDATORY)" with "3–6 high-leverage diagnostic questions"
3. **Change mode to "Collaborative"** → click Regenerate → verify intake protocol is GONE, constraint says "Ask clarifying questions before providing your analysis"
4. **Toggle a constraint** (e.g., "Include risks") → see stale indicator → click Regenerate → verify "Include potential risks and mitigations" in constraints
5. **Search "lawyer"** → select → verify prompt ends with "INFORMATIONAL ONLY" disclaimer and role is marked sensitive
6. **Verify no "Role Chain" section** exists in the UI
7. **Copy button** works → copies prompt to clipboard
8. **Run tests**: `node tests/compilePrompt.test.js` → all 41 pass
