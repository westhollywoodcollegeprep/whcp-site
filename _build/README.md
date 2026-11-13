# How this site is built

The live site is generated. **Edit `_build/source.html`, not the HTML files in the repo root.**

`source.html` is the whole site in one file (the same single-file format used before
November 2026, with images embedded). The build script splits it into real pages so
Google can index every one of them.

## Update the site

1. Edit `_build/source.html` (text, prices, calendar, images: same as before).
2. From the repo root, run: `python3 _build/build.py` (needs Python 3.9+ and Pillow).
3. Commit everything the build changed, including `img/` and `assets/`.

## What the build makes

| Output | Purpose |
| --- | --- |
| `index.html`, `about.html`, `admissions.html` … | One page per route. GitHub Pages serves `/about` from `about.html` with HTTP 200 |
| `assets/site.css`, `assets/site.js`, `assets/fonts/` | Shared styles, script and self-hosted fonts (OFL licences in `assets/fonts/LICENSES.txt`) |
| `img/` | Images pulled out of the HTML, as WebP (cards also get an 800px version) |
| `404.html` | Real "page not found" page |
| `kindergarten-elementary-school.html` etc. | Redirects from old Wix and renamed URLs |
| `sitemap.xml`, `robots.txt`, `llms.txt`, `.well-known/security.txt`, `.nojekyll` | Crawl and AI files |

Page titles, descriptions, school schema and redirects are set at the top of `build.py`
(`PAGES`, `LEGACY`, `school_schema`). Adding a page means adding a
`<div class="page" id="page-NAME">` block to `source.html` **and** an entry in `PAGES`.

Not touched by the build: `board/`, `frontdesk-q7m4x2/`, `favicon.png`, `CNAME`.
