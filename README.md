# My portfolio website

A plain HTML, CSS and JavaScript site. No build step, no frameworks, so GitHub Pages can host it as it is.

## What is where

| File | Purpose |
| --- | --- |
| `index.html` | Home page: hero, projects, about, contact |
| `js/content.js` | **All your text, education, experience, Google Scholar link and projects.** This is the file you edit most |
| `js/main.js` | Behaviour: page content, theme toggle, project filters, project pages |
| `js/build.js` | Scroll controller for the device animation, plus the flat 2D version used as a fallback |
| `js/scene3d.bundle.js` | The 3D device scene (three.js, already bundled; the browser loads this) |
| `js/models.bundle.js` | The small 3D model of each project's device (three.js, already bundled) |
| `src/scene3d.js`, `src/models.js`, `package.json` | Source of the 3D scene and the project models. Only needed if you want to change them (see below) |
| `js/publications.js` | **Your publication list** (13 papers). Feeds `publications.html`; the BibTeX is made from it |
| `js/news.js` | **Your news and updates.** The home page shows the latest four, `news.html` shows all |
| `publications.html`, `news.html` | The Publications page and the News page |
| `scripts/sync-meta.js` | Writes page titles and share-preview tags into every page (`npm run meta`) |
| `assets/img/og/` | The 1200 x 630 preview picture shown when a page is shared (one per page) |
| `css/style.css` | Look and feel (colours are at the top) |
| `projects/*.html` | One page per project |
| `projects/_template.html` | Copy this to start a new project page |
| `assets/img/` | Your images |

## Preview on your computer

Open a terminal in this folder and run:

```
python3 -m http.server 8000
```

Then open http://localhost:8000. (Opening `index.html` by double-click also works.)

## Put it on GitHub

See the step-by-step guide in `GITHUB-GUIDE.md`.

## Update the news and publications

- News: open `js/news.js`, copy one line, put the newest at the top. Format `date: "2026-11"` (or just `"2026"`), a sentence in `text`, and an optional `link`.
- Publications: open `js/publications.js`, copy one entry, keep the newest first. Add `pdf: "https://..."` to get a PDF link.

## Add a project

1. Add an object to `window.PROJECTS` in `js/content.js` (copy an existing one).
2. Copy `projects/_template.html` to `projects/<slug>.html` and set `data-slug` in the `<body>` tag to the same slug. Also update the `<title>` and `description`.
3. Put the photo in `assets/img/projects/` and reference it as `assets/img/projects/name.jpg`. Each project shows one photo (taken from the paper) next to one 3D model of the device.
4. `model` in the project picks the 3D model: `reader`, `wifi`, `needle`, `tag`, `lens`, `testbed`, `food` or `mems`. A project without a model (or a browser without WebGL) simply shows its photo. The `mems` model is a looping, captioned animation of a generic thin-film process (oxide, metal, photoresist, mask exposure, development, etch, strip). A model can show a step caption by returning a `label(t)` function from its builder in `src/models.js`.
5. Photos taken from published papers are credited under the picture (`imageCredit`). Please check that the publisher allows reuse (or ask for permission) before you publish the site.

## Skills, contact line, footer date

All three are in `js/content.js`, near the top: `skills` (one row per group), `contactNote` (the sentence under "Contact") and `updated` (the date in the footer; change it whenever you edit the site).

## Page titles and share previews

Each page has its own title, description and preview picture (`assets/img/og/<name>.png`), so a shared link shows a card with the project's 3D model. For the cards to work in WhatsApp, LinkedIn and email, the pictures need the full web address of your site:

1. Put your site address in `url` in `js/content.js`, for example `"https://yourname.github.io/"`.
2. Run `npm run meta` once (needs Node.js; or ask Claude to do it). It rewrites the tags in all pages.

Do the same after adding a project or changing a title or summary. New projects need a preview picture named after the slug (`assets/img/og/<slug>.png`, 1200 x 630); ask Claude to make it.

## Change the look

The look is Navy and Rose, in dark (default) and light; visitors switch with the button in the header and the choice is remembered. Colours are variables at the top of `css/style.css`: `--bg`, `--ink`, `--accent` (the rose), `--glow*` (the translucent rose tints), one block for dark and one for light, and `--pcb`, `--copper`, `--chip` for the device in the animation. Fonts are self-hosted in `assets/fonts` (declared in `css/fonts.css`): Fraunces for headings and Manrope for text. Nothing is loaded from Google.

## The device animation

The device behind the story chapters is a real 3D scene (three.js) driven only by scroll position. Scrolling swings the camera round the device while it builds: signal waves come into focus, the flexible circuit drops in, electrodes and traces are drawn on, the antenna coil is drawn in the air and lowers onto the board, passive parts and the microcontroller fly in, and the coil radiates. The incoming signals are glowing lines with bright packets that flow toward the board. When the board is complete, small coloured dots (the data) run along its traces, leave as a helix, and rise to a layered cloud with a live network inside, which passes them on to a phone, a dashboard and IoT nodes. Signals, dots, the cloud network and the screens keep moving by themselves while the scene is on screen; the build-up of the device follows the scroll. All parts are solid and there are no text labels on the device.

- If a visitor's browser cannot run WebGL, the site automatically uses the flat 2D drawing in `js/build.js` instead.
- Visitors with reduced motion turned on in their system settings see the finished device without animation.
- To preview the 2D version, add `?2d` to the address (for example `http://localhost:8000/?2d`).
- The "From signal to cloud" text is the chapter with id `data` in `index.html`. Edit it freely.
- The order in which parts appear is set in the `stages` function near the top of `src/scene3d.js` (and the same function in `js/build.js`). The camera path is the `KEYS` list in `src/scene3d.js`.

To change the 3D scene, edit `src/scene3d.js`, then in this folder run `npm install` once and `npm run build`. That rewrites `js/scene3d.bundle.js`. You need Node.js for this, but not to run or publish the site.


## Devices and browsers

Tested at phone (320 to 430 px wide), tablet and landscape sizes, laptops and ultrawide screens. Portrait screens put the text below the device; landscape and desktop put it beside the device. On touch devices the mouse parallax is off, the shadow map is smaller, and the pixel count is capped so low-end phones stay smooth. If a browser has no WebGL (or loses it), the site falls back to the flat 2D drawing; `?2d` on the address forces that. Reduced-motion users get the finished device without animation.

The project models (`src/models.js`) are rebuilt the same way: `npm run build` rewrites both `js/scene3d.bundle.js` and `js/models.bundle.js`. They only draw while they are on screen, and they can be rotated by dragging on the project pages.

## BibTeX on project pages

A project with a `bibtex` field in `js/content.js` shows a "Cite this work" block with Copy and Download buttons. Leave the field out (as for the MEMS page) to hide the block.

## Project status and photo

A project can have `status: "In progress"` (shown on its page instead of a journal). To add a real photo later, put it in `assets/img/projects/` and fill `image`, `imageAlt`, `imageCaption` and `imageCredit` for that project in `js/content.js`.
