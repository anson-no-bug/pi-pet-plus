# @anson-no-bug/pi-pet-plus

English | [中文文档](./README.zh.md)

A persistent pet companion for [pi](https://shittycodingagent.ai/) with:

- compact ASCII widget rendering
- long-term progression
- zh/en localization
- optional `pet-news` headline delivery
- global persistence across projects and sessions

## Install

### From npm

```bash
pi install npm:@anson-no-bug/pi-pet-plus
```

### Local development

```bash
pi -e ./src/index.ts
```

## What you get

### Companion modules

- **pet-core**
  - pet widget
  - progression
  - speech bubble layer
  - commands and settings
- **pet-news**
  - headline fetching
  - feed rotation
  - speech-first delivery
  - optional footer mode

### Current roster

- Cat
- Dog
- Cow
- Horse
- Spark Mouse
- Seedling
- Drakelet

### Progression

Visible phases before branching:

1. Baby
2. School
3. High School
4. University

Career tracks after graduation:

- **Academia**: Master's → PhD → Professor → Academician
- **Engineering**: Intern → Engineer → Senior Engineer → Domain Expert

## Interactive usage

### Main pet menu

Open the menu:

```text
/pet
```

From there you can:

- view status
- switch pets
- create pets
- delete pets
- open `pet-news`
- choose a branch after graduation
- open settings
- show/hide the widget

### News menu

Open directly:

```text
/news
```

Or from the pet menu:

```text
/pet news
```

In the news overlay, use **Open ↗** to open the full article link.

## Slash commands

### Pet commands

```text
/pet
/pet status
/pet new
/pet rename <name>
/pet switch
/pet switch <name>
/pet delete <name>
/pet news
/pet branch
/pet preview <state>
/pet demo
/pet config
/pet toggle
```

### News commands

```text
/news
/news open
/news toggle
/news on
/news off
/news next
/news prev
/news refresh
/news config
/news add-rss <url> [label]
/news remove <sourceId>
/news status
```

## Settings and defaults

Current defaults:

- pet animation speed: **0.5 FPS**
- news rotation speed: **100ms**
- locale: **zh**
- news presentation: **speech**

Configure through:

```text
/pet config
/news config
```

## Development / QA commands

Useful when testing visuals locally:

```text
/pet dev xp <totalXp>
/pet dev stage <baby|kindergarten|elementary|middle-school|high-school|university>
/pet dev branch <none|academia|engineering> [rank]
/pet dev reset
```

Examples:

```text
/pet dev stage baby
/pet dev stage university
/pet dev branch academia 4
/pet dev branch engineering 4
```

## Storage

Global files live in:

- `~/.pi/agent/pet/config.json`
- `~/.pi/agent/pet/state.json`
- `~/.pi/agent/pet/news-cache.json`

## Development

```bash
npm run typecheck
npm test
```

## Docs

- [Chinese README](./README.zh.md)
- [pet-core architecture](docs/architecture/pet-core.md)
- [pet-news architecture](docs/architecture/pet-news.md)
- [locale + progression examples](docs/examples/locale-and-progression.md)
- [publishing to GitHub and npm](docs/publishing.md)

## License

MIT
