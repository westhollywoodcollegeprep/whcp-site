#!/usr/bin/env python3
"""
WHCP site builder.

Reads _build/source.html (the single-file site, the one you edit) and writes
the deployable site into the repo root:

  index.html, about.html, admissions.html ...   one real page per route (HTTP 200)
  assets/site.css, assets/site.js, assets/fonts  shared, cacheable
  img/*.webp|png                                 images pulled out of the HTML
  404.html, robots.txt, sitemap.xml, llms.txt, .well-known/security.txt
  legacy redirect pages for old Wix URLs

Usage (from the repo root):   python3 _build/build.py
Requires: Python 3.9+, Pillow.  Fonts are read from _build/fonts/.
"""
import base64, datetime, hashlib, html, io, json, os, re, shutil, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / '_build'
SITE = 'https://www.westhollywoodschool.com'
TODAY = datetime.date.today().isoformat()

# --------------------------------------------------------------------------
# Page metadata: title (<60 chars where possible), description (<160 chars)
# --------------------------------------------------------------------------
PAGES = {
    'home': ('Private Pre-K–12 School in West Hollywood | WASC-Accredited | WHCP',
             'West Hollywood College Preparatory School is a private, nonprofit Pre-K through 12th grade school with small classes, a licensed preschool, and year-round enrollment.'),
    'about': ('About WHCP | Private School in West Hollywood, CA',
              'Learn about West Hollywood College Preparatory School: our history, WASC accreditation, licensed childcare center, and Pre-school through Grade 12 programs.'),
    'principals-message': ("Principal's Message | West Hollywood College Preparatory School",
                           'A welcome from Dr. Elina Dvorskaya, principal of West Hollywood College Preparatory School, on the values behind our small, nurturing school.'),
    'mission': ('Mission & Goals | West Hollywood College Preparatory School',
                'The mission, vision and academic goals that guide West Hollywood College Preparatory School from early childhood through Grade 12.'),
    'careers': ('Careers & Teaching Jobs | West Hollywood College Prep',
                'Join the faculty and staff at West Hollywood College Preparatory School, a private Pre-K–12 school in West Hollywood, California.'),
    'programs': ('Academic Programs, Preschool to Grade 12 | WHCP West Hollywood',
                 'Explore WHCP programs: preschool and kindergarten, elementary (Grades 1–5), middle and high school, after school, tutoring, individual and international programs.'),
    'early-childhood': ('Preschool & Kindergarten in West Hollywood (Ages 2–5) | WHCP',
                        'Play-based preschool for ages 2–4 and kindergarten at age 5 in a Licensed Childcare Center with very small groups, in West Hollywood, CA.'),
    'elementary': ('Private Elementary School, Grades 1–5 | West Hollywood | WHCP',
                   'Small-class private elementary school for Grades 1–5 in West Hollywood: reading, writing, math, science, arts and social-emotional learning.'),
    'middle-high': ('Private Middle & High School, Grades 6–12 | West Hollywood | WHCP',
                    'College-preparatory middle and high school for Grades 6–12 in West Hollywood with small classes, college counseling and SAT/ACT preparation.'),
    'after-school': ('After School Program & Childcare in West Hollywood | WHCP',
                     'Supervised study, enrichment and childcare after school until 5:00 PM at West Hollywood College Preparatory School. Summer School and Camp also available.'),
    'individual': ('One-on-One Individual Learning Programs | WHCP West Hollywood',
                   'Fully customized one-on-one learning plans built around each student’s needs and pace, year round, at West Hollywood College Preparatory School.'),
    'tutoring': ('Tutoring in West Hollywood: All Subjects & SAT/ACT Prep | WHCP',
                 'Professional tutors for math through calculus, sciences, English, history, languages and SAT/ACT prep. One-on-one or small groups, after school and weekends.'),
    'international': ('International Students, F-1 & I-20 Admissions | WHCP Los Angeles',
                      'SEVP-certified private school in West Hollywood, Los Angeles welcoming international students in Grades K–12, with ESL, I-20 support and a dedicated coordinator.'),
    'admissions': ('Admissions & Tuition | Private School West Hollywood | WHCP',
                   'Year-round admissions, 2026–2027 tuition and fees, FAQs and the online inquiry form for West Hollywood College Preparatory School, Pre-K through Grade 12.'),
    'calendar': ('2026–2027 School Calendar | West Hollywood College Prep',
                 'Holidays, breaks and important dates for the 2026–2027 school year at West Hollywood College Preparatory School.'),
    'contact': ('Contact & Visit | West Hollywood College Preparatory School',
                'Contact WHCP or schedule a tour: 1317 N. Crescent Heights Blvd., West Hollywood, CA 90046 · (323) 822-7900 · Office hours Mon–Fri, 8:00 AM–6:00 PM.'),
    'students': ('Student Life | West Hollywood College Preparatory School',
                 'Clubs, activities, community service and school-break programs for students at West Hollywood College Preparatory School.'),
    'parents': ('Parent Resources | West Hollywood College Preparatory School',
                'Calendars, policies, forms and resources for current WHCP families.'),
    'giving': ('Support WHCP | West Hollywood College Preparatory School',
               'Ways to support West Hollywood College Preparatory School, a private, nonprofit Pre-K–12 school in West Hollywood.'),
    'privacy': ('Privacy Policy | West Hollywood College Preparatory School',
                'How West Hollywood College Preparatory School collects, uses and protects information submitted through this website.'),
    'terms': ('Terms of Use | West Hollywood College Preparatory School',
              'Terms of use for the West Hollywood College Preparatory School website.'),
    'accessibility': ('Accessibility Statement | West Hollywood College Preparatory School',
                      'WHCP’s commitment to an accessible website and how to request help or information in an alternative format.'),
}
GROUPS = {  # which main-nav item is highlighted
    'about': 'about', 'principals-message': 'about', 'mission': 'about', 'careers': 'about',
    'programs': 'programs', 'early-childhood': 'programs', 'elementary': 'programs',
    'middle-high': 'programs', 'after-school': 'programs', 'individual': 'programs',
    'tutoring': 'programs', 'international': 'programs', 'admissions': 'admissions',
    'students': 'community', 'parents': 'community', 'calendar': 'calendar', 'contact': 'contact',
}
CRUMB_PARENT = {k: ('programs', 'Programs') for k, v in GROUPS.items() if v == 'programs' and k != 'programs'}
CRUMB_PARENT.update({k: ('about', 'About') for k in ('principals-message', 'mission', 'careers')})
SITEMAP_PRIORITY = {'home': '1.0', 'admissions': '0.9', 'early-childhood': '0.9', 'elementary': '0.9',
                    'middle-high': '0.9', 'programs': '0.8', 'about': '0.8', 'contact': '0.8'}
LEGACY = {  # old Wix URLs still in Google's index -> new page
    'kindergarten-elementary-school': 'elementary', 'k-elementary': 'elementary',
    'middle-and-high-school': 'middle-high', 'mission-and-goals': 'mission',
    'international-students': 'international', 'individual-programs': 'individual',
    'testimonials': 'about', 'contact-us': 'contact',
}
SOCIAL = ['https://www.facebook.com/whcprep', 'https://www.instagram.com/westhollywoodcollegeprep/',
          'https://x.com/WHCollegePrep', 'https://studyinthestates.dhs.gov/certified-school/108902']

CSP = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
       "img-src 'self' data:; font-src 'self'; connect-src 'self' https://formspree.io; "
       "form-action https://formspree.io; frame-src https://maps.google.com https://www.google.com; "
       "base-uri 'self'; object-src 'none'; upgrade-insecure-requests")

FONTS = [  # (family, weight, style, file in _build/fonts)
    ('Jost', 300, 'normal', 'jost-latin-300-normal.woff2'),
    ('Jost', 400, 'normal', 'jost-latin-400-normal.woff2'),
    ('Jost', 500, 'normal', 'jost-latin-500-normal.woff2'),
    ('Jost', 600, 'normal', 'jost-latin-600-normal.woff2'),
    ('Cormorant Garamond', 500, 'normal', 'cormorant-garamond-latin-500-normal.woff2'),
    ('Cormorant Garamond', 600, 'normal', 'cormorant-garamond-latin-600-normal.woff2'),
    ('Cormorant Garamond', 700, 'normal', 'cormorant-garamond-latin-700-normal.woff2'),
    ('Cormorant Garamond', 500, 'italic', 'cormorant-garamond-latin-500-italic.woff2'),
    ('Cormorant Garamond', 600, 'italic', 'cormorant-garamond-latin-600-italic.woff2'),
    ('Chakra Petch', 500, 'normal', 'chakra-petch-latin-500-normal.woff2'),
    ('Chakra Petch', 600, 'normal', 'chakra-petch-latin-600-normal.woff2'),
    ('Chakra Petch', 700, 'normal', 'chakra-petch-latin-700-normal.woff2'),
]
PRELOAD_FONTS = ['jost-latin-300-normal.woff2', 'cormorant-garamond-latin-600-normal.woff2',
                 'chakra-petch-latin-700-normal.woff2']


def esc(t):
    return html.escape(t, quote=True)


# --------------------------------------------------------------------------
# Images
# --------------------------------------------------------------------------
class Images:
    def __init__(self, outdir):
        self.out = outdir
        self.by_hash = {}
        self.dims = {}

    def save(self, data_uri, name, max_w=1600, variants=()):
        mime, b64 = re.match(r'data:(image/[a-z+]+);base64,(.+)', data_uri, re.S).groups()
        raw = base64.b64decode(b64)
        h = hashlib.sha1(raw).hexdigest()
        if h in self.by_hash:
            return self.by_hash[h]
        im = Image.open(io.BytesIO(raw))
        if mime == 'image/png' and name.startswith('icon'):
            fn = f'{name}.png'
            (self.out / fn).write_bytes(raw)          # favicons stay PNG, untouched
        else:
            has_alpha = im.mode in ('RGBA', 'LA') or 'transparency' in im.info
            im = im.convert('RGBA' if has_alpha else 'RGB')
            if im.width > max_w:
                im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
            fn = f'{name}.webp'
            im.save(self.out / fn, 'WEBP', quality=88 if has_alpha else 80, method=6)
            for vw in variants:
                if im.width > vw:
                    v = im.resize((vw, round(im.height * vw / im.width)), Image.LANCZOS)
                    v.save(self.out / f'{name}-{vw}.webp', 'WEBP', quality=80, method=6)
                    self.dims[f'{name}-{vw}.webp'] = v.size
        self.dims[fn] = Image.open(self.out / fn).size
        url = '/img/' + fn
        self.by_hash[h] = url
        return url


# --------------------------------------------------------------------------
# Split the source
# --------------------------------------------------------------------------
def load_source():
    s = (BUILD / 'source.html').read_text(encoding='utf-8')
    css = re.search(r'<style>(.*?)</style>', s, re.S).group(1)
    head = s[:s.find('<style>')]
    body = s[s.find('<body>') + 6:]
    pre_main = body[:body.find('<main id="app"')]
    main = body[body.find('<main id="app"'):body.find('</main>')]
    footer = body[body.find('</main>') + 7:body.find('<script>')]
    script = body[body.find('<script>'):body.find('</script>')]
    pages = {}
    starts = [m for m in re.finditer(r'<div class="page" id="page-([a-z-]+)">', main)]
    for i, m in enumerate(starts):
        end = starts[i + 1].start() if i + 1 < len(starts) else len(main)
        chunk = main[m.start():end]
        chunk = re.sub(r'\s*<!--[^>]*-->\s*$', '\n', chunk.rstrip()) + '\n'
        pages[m.group(1)] = chunk
    img_map = dict(re.findall(r"(\w+):\s*'(data:image/[^']+)'", script))
    return head, css, pre_main, pages, footer, img_map


def main():
    head, css, pre_main, pages, footer, img_map = load_source()
    missing = set(PAGES) - set(pages)
    extra = set(pages) - set(PAGES)
    if missing or extra:
        sys.exit(f'page mismatch. missing meta for {extra}, missing pages {missing}')

    # clean previous output
    for d in ('img', 'assets'):
        shutil.rmtree(ROOT / d, ignore_errors=True)
    (ROOT / 'img').mkdir()
    (ROOT / 'assets' / 'fonts').mkdir(parents=True)
    imgs = Images(ROOT / 'img')

    # ---- favicons (from <head>) -> files
    icon_links = []
    for m in re.finditer(r'<link rel="(icon|apple-touch-icon)" type="image/png" sizes="(\d+)x\d+" href="(data:[^"]+)">|'
                         r'<link rel="(apple-touch-icon)" sizes="(\d+)x\d+" href="(data:[^"]+)">', head):
        rel = m.group(1) or m.group(4)
        size = m.group(2) or m.group(5)
        uri = m.group(3) or m.group(6)
        name = 'apple-touch-icon' if rel == 'apple-touch-icon' else f'icon-{size}'
        url = imgs.save(uri, 'icon' + ('-apple-' + size if rel == 'apple-touch-icon' else '-' + size))
        icon_links.append((rel, size, url))

    # ---- CSS: images out, fonts self-hosted
    def css_img(m):
        return f"url('{imgs.save(m.group(1), 'seal', max_w=900)}')"
    css = re.sub(r"url\('(data:image/[^']+)'\)", css_img, css)
    font_css = ''
    for fam, w, st, fn in FONTS:
        shutil.copy(BUILD / 'fonts' / fn, ROOT / 'assets' / 'fonts' / fn)
        font_css += (f"@font-face{{font-family:'{fam}';font-style:{st};font-weight:{w};font-display:swap;"
                     f"src:url('/assets/fonts/{fn}') format('woff2')}}\n")
    shutil.copy(BUILD / 'fonts' / 'LICENSES.txt', ROOT / 'assets' / 'fonts' / 'LICENSES.txt')
    css = font_css + css
    css_v = hashlib.sha1(css.encode()).hexdigest()[:8]
    (ROOT / 'assets' / 'site.css').write_text(css, encoding='utf-8')

    # ---- card images referenced by key (IMG map)
    key_url = {}
    for k, uri in img_map.items():
        key_url[k] = imgs.save(uri, k, max_w=1600, variants=(800,))

    def fix_imgs(chunk, page_id):
        # <img data-img="key" ...>  -> real src + srcset + intrinsic size
        def keyed(m):
            tag, k = m.group(0), m.group(1)
            full = key_url[k]
            small = full.replace('.webp', '-800.webp')
            fn_small = small.rsplit('/', 1)[1]
            if fn_small not in imgs.dims:
                small = full
                fn_small = full.rsplit('/', 1)[1]
            w, h = imgs.dims[fn_small]
            fw = imgs.dims[full.rsplit('/', 1)[1]][0]
            srcset = f' srcset="{small} {w}w, {full} {fw}w" sizes="(max-width: 860px) 100vw, 400px"' if small != full else ''
            return tag.replace(f'data-img="{k}"', f'src="{small}"{srcset} width="{w}" height="{h}" decoding="async"')
        chunk = re.sub(r'<img data-img="(\w+)"[^>]*>', keyed, chunk)
        # data-bg="key" -> inline background-image
        chunk = re.sub(r'data-bg="(\w+)"', lambda m: f"style=\"background-image:url('{key_url[m.group(1)]}')\"", chunk)
        # inline style background images
        n = [0]

        def bg(m):
            n[0] += 1
            name = 'hero-%d' % n[0] if page_id == 'home' else f'banner-{page_id}' + ('' if n[0] == 1 else f'-{n[0]}')
            return f"url('{imgs.save(m.group(1), name)}')"
        chunk = re.sub(r"url\('(data:image/[^']+)'\)", bg, chunk)

        # <img src="data:..."> (WASC seal, principal portrait, classroom photo)
        def inline_img(m):
            alt = re.search(r'alt="([^"]*)"', m.group(0))
            slug = re.sub(r'[^a-z0-9]+', '-', (alt.group(1) if alt else page_id).lower()).strip('-')[:40]
            url = imgs.save(m.group(1), slug, max_w=1600, variants=(800,))
            fn = url.rsplit('/', 1)[1]
            small = url.replace('.webp', '-800.webp')
            if small.rsplit('/', 1)[1] in imgs.dims:
                w, h = imgs.dims[small.rsplit('/', 1)[1]]
                url_attr = f'src="{small}" srcset="{small} {w}w, {url} {imgs.dims[fn][0]}w" sizes="(max-width: 860px) 100vw, 760px"'
            else:
                w, h = imgs.dims[fn]
                url_attr = f'src="{url}"'
            tag = m.group(0).replace(f'src="{m.group(1)}"', f'{url_attr} width="{w}" height="{h}"')
            return tag
        chunk = re.sub(r'<img[^>]*src="(data:image/[^"]+)"[^>]*>', inline_img, chunk)
        # inline onclick handlers are replaced by listeners in site.js (strict CSP)
        chunk = re.sub(r'\s+onclick="goSlide\(\d\)"', '', chunk)
        return chunk

    # ---- shared JS
    js = (BUILD / 'site.js').read_text(encoding='utf-8')
    js = js.replace('__ROUTES__', json.dumps(sorted(PAGES)))
    js_v = hashlib.sha1(js.encode()).hexdigest()[:8]
    (ROOT / 'assets' / 'site.js').write_text(js, encoding='utf-8')

    # ---- OG image
    og = BUILD / 'og-image.jpg'
    if og.exists():
        shutil.copy(og, ROOT / 'img' / 'og-image.jpg')

    schema_school = school_schema(key_url)

    def page_html(pid, content, title, desc, canonical=True, robots='index,follow', extra_schema=None):
        url = SITE + ('/' if pid == 'home' else '/' + pid)
        nav = pre_main
        grp = GROUPS.get(pid)
        if grp:
            nav = nav.replace(f'<li data-group="{grp}">\n          <a href=', f'<li data-group="{grp}">\n          <a class="on" href=', 1)
            nav = nav.replace(f'<li data-group="{grp}"><a href=', f'<li data-group="{grp}"><a class="on" href=', 1)
        href = '/' if pid == 'home' else '/' + pid
        nav = re.sub(rf'(<a)( href="{re.escape(href)}">)', r'\1 aria-current="page"\2', nav)
        foot = footer
        lines = ['<!DOCTYPE html>', '<html lang="en">', '<head>', '<meta charset="UTF-8">',
                 '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
                 f'<title>{esc(title)}</title>', f'<meta name="description" content="{esc(desc)}">',
                 f'<meta name="robots" content="{robots}">']
        if canonical:
            lines.append(f'<link rel="canonical" href="{url}">')
        lines += [f'<meta http-equiv="Content-Security-Policy" content="{CSP}">',
                  '<meta name="referrer" content="strict-origin-when-cross-origin">',
                  '<meta name="theme-color" content="#10233F">',
                  '<link rel="icon" type="image/png" sizes="512x512" href="/favicon.png">']
        for rel, size, iurl in icon_links:
            lines.append(f'<link rel="{rel}" type="image/png" sizes="{size}x{size}" href="{iurl}">' if rel == 'icon'
                         else f'<link rel="apple-touch-icon" sizes="{size}x{size}" href="{iurl}">')
        if canonical:
            lines += ['<meta property="og:type" content="website">',
                      '<meta property="og:site_name" content="West Hollywood College Preparatory School">',
                      f'<meta property="og:title" content="{esc(title)}">',
                      f'<meta property="og:description" content="{esc(desc)}">',
                      f'<meta property="og:url" content="{url}">',
                      f'<meta property="og:image" content="{SITE}/img/og-image.jpg">',
                      '<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">',
                      '<meta property="og:image:alt" content="West Hollywood College Preparatory School seal">',
                      '<meta name="twitter:card" content="summary_large_image">',
                      '<meta name="twitter:site" content="@WHCollegePrep">']
        for fn in PRELOAD_FONTS:
            lines.append(f'<link rel="preload" href="/assets/fonts/{fn}" as="font" type="font/woff2" crossorigin>')
        lines.append(f'<link rel="stylesheet" href="/assets/site.css?v={css_v}">')
        graph = [schema_school, {'@type': 'WebSite', '@id': SITE + '/#website', 'url': SITE + '/',
                                 'name': 'West Hollywood College Preparatory School', 'publisher': {'@id': SITE + '/#school'}}]
        if canonical:
            wp = {'@type': 'WebPage', '@id': url + '#webpage', 'url': url, 'name': title, 'description': desc,
                  'isPartOf': {'@id': SITE + '/#website'}, 'about': {'@id': SITE + '/#school'}, 'inLanguage': 'en-US'}
            if pid != 'home':
                items = [{'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': SITE + '/'}]
                if pid in CRUMB_PARENT:
                    pp, pn = CRUMB_PARENT[pid]
                    items.append({'@type': 'ListItem', 'position': 2, 'name': pn, 'item': f'{SITE}/{pp}'})
                items.append({'@type': 'ListItem', 'position': len(items) + 1, 'name': title.split(' | ')[0], 'item': url})
                wp['breadcrumb'] = {'@type': 'BreadcrumbList', 'itemListElement': items}
            graph.append(wp)
        if extra_schema:
            graph.append(extra_schema)
        lines.append('<script type="application/ld+json">' +
                     json.dumps({'@context': 'https://schema.org', '@graph': graph}, ensure_ascii=False).replace('</', '<\\/') +
                     '</script>')
        lines += ['</head>', '<body>', nav.strip(), '<main id="app" tabindex="-1">', content.strip(), '</main>',
                  foot.strip(), f'<script src="/assets/site.js?v={js_v}" defer></script>', '</body>', '</html>', '']
        return '\n'.join(lines)

    # ---- write pages
    for pid, chunk in pages.items():
        chunk = fix_imgs(chunk, pid).replace('<div class="page"', '<div class="page active"', 1)
        if 'data:image' in chunk:
            sys.exit(f'unextracted image left in {pid}')
        title, desc = PAGES[pid]
        extra = faq_schema(chunk) if pid == 'admissions' else None
        out = ROOT / ('index.html' if pid == 'home' else f'{pid}.html')
        out.write_text(page_html(pid, chunk, title, desc, extra_schema=extra), encoding='utf-8')

    # ---- 404 page (real 404 status from GitHub Pages; noindex)
    nf = '''<div class="page active" id="page-404">
  <div class="phero">
    <div class="wrap">
      <h1>Page Not Found</h1>
      <p>Sorry, we couldn&rsquo;t find that page. It may have moved when we updated our website.</p>
    </div>
  </div>
  <section class="sec">
    <div class="wrap" style="max-width:860px">
      <p style="margin-bottom:24px">Try one of these instead:</p>
      <div class="rows">
        <div class="row" style="grid-template-columns:1fr auto"><p>Home</p><a class="tlink" href="/">Go</a></div>
        <div class="row" style="grid-template-columns:1fr auto"><p>Programs, Preschool to Grade 12</p><a class="tlink" href="/programs">Go</a></div>
        <div class="row" style="grid-template-columns:1fr auto"><p>Admissions &amp; Tuition</p><a class="tlink" href="/admissions">Go</a></div>
        <div class="row" style="grid-template-columns:1fr auto"><p>School Calendar</p><a class="tlink" href="/calendar">Go</a></div>
        <div class="row" style="grid-template-columns:1fr auto"><p>Contact Us</p><a class="tlink" href="/contact">Go</a></div>
      </div>
    </div>
  </section>
</div>'''
    (ROOT / '404.html').write_text(page_html('404', nf, 'Page Not Found | West Hollywood College Preparatory School',
                                             'The page you requested could not be found.', canonical=False,
                                             robots='noindex,follow'), encoding='utf-8')

    # ---- legacy redirects (old Wix URLs + renamed route)
    for old, new in LEGACY.items():
        target = f'{SITE}/{new}'
        (ROOT / f'{old}.html').write_text(f'''<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>Moved | West Hollywood College Preparatory School</title>
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="{target}">
<meta http-equiv="refresh" content="0; url=/{new}">
</head><body><p>This page has moved to <a href="/{new}">{target}</a>.</p></body></html>
''', encoding='utf-8')

    # ---- robots.txt, sitemap.xml, llms.txt, security.txt, .nojekyll
    (ROOT / 'robots.txt').write_text(f'''# West Hollywood College Preparatory School
User-agent: *
Allow: /
Disallow: /_build/

Sitemap: {SITE}/sitemap.xml
''')
    urls = ''.join(
        f'  <url><loc>{SITE}{"/" if p == "home" else "/" + p}</loc><lastmod>{TODAY}</lastmod>'
        f'<priority>{SITEMAP_PRIORITY.get(p, "0.6" if p not in ("privacy", "terms", "accessibility") else "0.3")}</priority></url>\n'
        for p in PAGES)
    (ROOT / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n'
                                      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '</urlset>\n')
    llms = (BUILD / 'llms.txt').read_text(encoding='utf-8')
    (ROOT / 'llms.txt').write_text(llms, encoding='utf-8')
    (ROOT / '.well-known').mkdir(exist_ok=True)
    expires = (datetime.date.today() + datetime.timedelta(days=365)).isoformat()
    (ROOT / '.well-known' / 'security.txt').write_text(
        f'Contact: mailto:info@westhollywoodschool.com\nExpires: {expires}T00:00:00.000Z\n'
        f'Preferred-Languages: en\nCanonical: {SITE}/.well-known/security.txt\n')
    (ROOT / '.nojekyll').write_text('')

    total = sum(f.stat().st_size for f in (ROOT / 'img').iterdir())
    print(f'built {len(pages)} pages, {len(LEGACY)} redirects, {len(list((ROOT / "img").iterdir()))} images ({total // 1024} KB)')


def school_schema(key_url):
    addr = {'@type': 'PostalAddress', 'streetAddress': '1317 N. Crescent Heights Blvd.', 'addressLocality': 'West Hollywood',
            'addressRegion': 'CA', 'postalCode': '90046', 'addressCountry': 'US'}
    geo = {'@type': 'GeoCoordinates', 'latitude': 34.09481, 'longitude': -118.36644}

    def dept(t, name, path, extra=None):
        d = {'@type': t, '@id': f'{SITE}/{path}#org', 'name': f'West Hollywood College Preparatory School – {name}',
             'url': f'{SITE}/{path}', 'address': addr, 'telephone': '+1-323-822-7900', 'parentOrganization': {'@id': SITE + '/#school'}}
        if extra:
            d.update(extra)
        return d
    return {
        '@type': ['School', 'LocalBusiness'], '@id': SITE + '/#school',
        'name': 'West Hollywood College Preparatory School',
        'alternateName': ['WHCP', 'West Hollywood College Prep', 'W. Hollywood College Preparatory School', 'Dvorsky College Preparatory School'],
        'description': 'A private, nonprofit Pre-K through 12th grade school in West Hollywood, California, with small classes, a licensed preschool (ages 2–4), WASC accreditation and year-round enrollment.',
        'url': SITE + '/', 'logo': SITE + '/favicon.png', 'image': SITE + '/img/og-image.jpg',
        'telephone': '+1-323-822-7900', 'faxNumber': '+1-323-822-7999', 'email': 'info@westhollywoodschool.com',
        'address': addr, 'geo': geo, 'hasMap': 'https://www.google.com/maps/search/?api=1&query=West+Hollywood+College+Preparatory+School',
        'openingHoursSpecification': [{'@type': 'OpeningHoursSpecification', 'dayOfWeek': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                                       'opens': '08:00', 'closes': '18:00'}],
        'founder': {'@type': 'Person', 'name': 'Dr. Elina Dvorskaya'},
        'areaServed': ['West Hollywood', 'Los Angeles', 'Beverly Hills', 'Hollywood'],
        'priceRange': '$$$',
        'hasCredential': [{'@type': 'EducationalOccupationalCredential', 'credentialCategory': 'accreditation',
                           'name': 'Accredited by the Accrediting Commission for Schools, Western Association of Schools and Colleges (ACS WASC)'},
                          {'@type': 'EducationalOccupationalCredential', 'credentialCategory': 'license',
                           'name': 'Licensed Childcare Center, California Department of Social Services, Community Care Licensing Division'},
                          {'@type': 'EducationalOccupationalCredential', 'credentialCategory': 'certification',
                           'name': 'SEVP-certified to enroll F-1 international students'}],
        'sameAs': SOCIAL,
        'department': [
            dept('Preschool', 'Early Childhood (Pre-school & Kindergarten)', 'early-childhood'),
            dept('ElementarySchool', 'Elementary School (Grades 1–5)', 'elementary'),
            dept('MiddleSchool', 'Middle School (Grades 6–8)', 'middle-high'),
            dept('HighSchool', 'High School (Grades 9–12)', 'middle-high'),
        ],
    }


def faq_schema(chunk):
    qa = re.findall(r'<details class="faq"><summary>(.*?)</summary><p>(.*?)</p></details>', chunk, re.S)
    if not qa:
        return None
    clean = lambda t: html.unescape(re.sub(r'<[^>]+>', '', t)).strip()
    return {'@type': 'FAQPage', '@id': SITE + '/admissions#faq',
            'mainEntity': [{'@type': 'Question', 'name': clean(q), 'acceptedAnswer': {'@type': 'Answer', 'text': clean(a)}} for q, a in qa]}


if __name__ == '__main__':
    main()
