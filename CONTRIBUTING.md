# Contributing

## Development loop

```bash
npm run typecheck
npm test
```

## Product boundaries

### pet-core

Contribute here when changing:

- progression
- widget rendering
- speech behavior
- locale-aware copy
- pet lifecycle commands
- persistence and state normalization

### pet-news

Contribute here when changing:

- headline fetching
- cache behavior
- source config
- delivery timing
- footer presentation

## Adding species

Keep species definitions data-driven.

When adding a species:

1. add localized species and breed names in `src/pet/species.ts`
2. provide anchor positions in `src/pet/anchors.ts`
3. add career accessories in `src/pet/careers.ts`
4. verify widget rendering in both locales

## Adding localized copy

All user-facing copy should go through `src/i18n/pet.ts`.

Avoid hard-coded strings inside runtimes and UI components unless they are strictly technical.

## Progression changes

If you touch progression thresholds or titles:

- update `src/pet/progression.ts`
- update corresponding copy in `src/i18n/pet.ts`
- add or adjust tests in `tests/`

## News changes

Default to speech-first behavior. Footer rendering is optional, not primary.
