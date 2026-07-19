# Claude Code Rules

## Commit Convention

Use Conventional Commits in English only.

Format: `<type>(<scope>): <description>`

### Types
- `feat` — new feature
- `fix` — bug fix
- `ui` — visual/style changes
- `refactor` — code restructuring
- `i18n` — localization / language changes
- `chore` — tooling, deps, config
- `docs` — documentation only

### Examples
```
feat(dialogs): add folder creation inside add-link modal
ui(settings): reorganize sidebar sections and fix scrollbar
fix(search): handle empty query edge case
refactor(dialogs): extract shared folder tree picker
i18n: replace all PT-BR strings with English
```

### Rules
- English only
- Present tense, imperative mood
- Concise (< 72 chars preferred)
- No emojis
