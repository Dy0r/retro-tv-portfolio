# Project files: one per project

Each `.json` file in this folder is one project: its cartridge, its menu entry and its case study. Edit the words here; the site picks them up automatically (no code changes). Save, and the dev site reloads.

Anything that looks like `[COPY: …]` is a placeholder for you to replace.

## The fields

| Field | What it's for |
|---|---|
| `order` | Position in the menu and the cartridge row (1 = first). |
| `slug` | The project's web address name: `/#/project/<slug>`. Lowercase, dashes, no spaces. Must match the file name. |
| `title` | Project name: menu, cartridge, case study heading. |
| `year` | Year, as a number (e.g. `2025`). |
| `role` | Your role, shown in the case study header. |
| `genre` | Short tag, e.g. `Branding`, `UX/UI`. |
| `summary` | One line on the TV menu. **Max 120 characters.** |
| `cartridgeColor` | The cartridge's plastic colour, e.g. `"#d9a441"`. |
| `labelImage` | Art on the cartridge label (4:3, e.g. 400×300). |
| `thumbnail` | Picture on the TV menu (4:3, e.g. 640×480). |
| `hero` | Big image (or video) at the top of the case study. |
| `sections` | The case study, in order. Each has a `heading`, a `body` and an optional `media`. |
| `links` | Buttons at the end, e.g. live site, Behance. Each has a `label` and a `url`. |
| `featured` | `true` or `false`. |

## Writing the body text

`body` is a list of paragraphs. Each paragraph is its own quoted line, with a comma between them:

```json
"body": [
  "First paragraph.",
  "Second paragraph."
]
```

Inside a paragraph, put `\"` for a double quote, or just use ‘curly quotes’.

## Images and videos

Put files in `public/projects/<slug>/`, then point to them from the root, e.g. `"/projects/plinth/hero.jpg"`.

```json
"media": {
  "type": "image",
  "src": "/projects/plinth/process-1.jpg",
  "alt": "What the image shows, for people who can't see it",
  "caption": "Optional caption under the image"
}
```

- For a video use `"type": "video"` and an `.mp4` file.
- A section with no image: `"media": null`.
- Several images in one section: use a list, `"media": [ {…}, {…} ]`.
- Every image can be clicked to enlarge on the site.
- Keep images under ~2000px wide, as JPG or WebP, so the site stays fast.

## Adding or removing a project

- **Add:** copy a file, rename it to the new slug, change `slug`, `title`, `order` and the rest. A new cartridge appears automatically.
- **Remove:** delete its file.
