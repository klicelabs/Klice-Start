# Agent Rules

## Commit Convention

Use Conventional Commits in English only:

```
<type>(<scope>): <description>
```

### Types
- `feat` — new feature
- `fix` — bug fix
- `ui` — visual/style changes (no logic change)
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
- Always write descriptions in English
- Use present tense, imperative mood ("add" not "added")
- Keep the description concise (< 72 chars preferred)
- Do not add emojis
- Always rebuild all affected browser targets before finalizing a task.
