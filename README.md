# ExpertPrompt Extension

A Chrome/Edge Manifest V3 extension for generating expert role prompts with advanced customization options.

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

#### 6. Multi-Role Chaining
- Add multiple roles to create a workflow chain
- Reorder roles with up/down arrows
- The AI will execute each role in sequence
- Example: Strategist → Copywriter → Editor

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
  chaining: true,
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
│   └── popup.js      # Bundled: roles database + all features
├── data/
│   ├── roles.js      # (reference) Role definitions
│   ├── searchEngine.js
│   └── promptGenerator.js
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
3. **Workflows**: Use chaining for multi-step analysis (e.g., Research → Analyze → Write)
4. **Sensitive Topics**: Keep guardrails ON for medical/legal/financial roles
5. **Presets**: Save commonly-used configurations for one-click access
