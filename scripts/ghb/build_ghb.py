"""Builds battleplan and battle tactic data from Wahapedia's General's Handbook page.

Usage (from the repo root):
    pip install -r scripts/ghb/requirements.txt
    python3 scripts/ghb/build_ghb.py            # uses the cached page if present
    python3 scripts/ghb/build_ghb.py --refresh  # re-download page and maps

Outputs src/packs/ghb2026/ghb.json and review overlays in .data-cache/ghb/overlays/.
Map pictures are only read to measure geometry; they are never copied into the repo.
The app shows them from their source URL.
"""

import hashlib
import json
import re
import sys
import urllib.request
from pathlib import Path

import numpy as np
from bs4 import BeautifulSoup
from PIL import Image, ImageDraw
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).parent))
from detect import circles  # noqa: E402
from objectives import PX_X, PX_Y, find_objectives  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.data-cache' / 'ghb'
OUT = ROOT / 'src' / 'packs' / 'ghb2026' / 'ghb.json'
LOCK = ROOT / 'data' / 'ghb.lock.json'

SITE = 'https://wahapedia.ru'
PAGE = SITE + '/aos4/the-rules/general-s-handbook-2026-27/'
LEGEND = {
    'area': ('333.png', '444.png'),
    'obscuring': ('222.png', 'ObscuringSmall1.png'),
    'placeOfPower': ('1111.png', 'PlaceOfPowerSmall1.png'),
}
CATEGORY = {
    'abOffensive': 'Offensive',
    'abDefensive': 'Defensive',
    'abMovement': 'Movement',
    'abShooting': 'Shooting',
    'abControl': 'Control',
    'abSpecial': 'Special',
    'abRampage': 'Rampage',
}


def fetch(url: str, dest: Path, refresh: bool) -> Path:
    if refresh or not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        dest.write_bytes(urllib.request.urlopen(req, timeout=60).read())
    return dest


def clean(text: str) -> str:
    return re.sub(r'\s+', ' ', text).replace(' ,', ',').replace(' .', '.').strip()


def slugify(name: str) -> str:
    return re.sub(r'^-|-$', '', re.sub(r'[^a-z0-9]+', '-', name.lower().replace("'", '').replace('’', '')))


# ---------------------------------------------------------------- rules text


def parse_ability(header, body) -> dict:
    timing = clean(header.get_text(' '))
    logo = header.find('img')
    category = None
    if logo:
        category = CATEGORY.get(Path(logo['src']).stem)
    name_tag = body.find('b')
    name = title(name_tag.get_text(' ')) if name_tag else 'Ability'
    text = clean(body.get_text(' '))
    if name_tag:
        text = clean(text[len(clean(name_tag.get_text(' '))):])
    declare = None
    m = re.match(r'Declare:\s*(.*?)\s*Effect:\s*(.*)$', text)
    if m:
        declare, effect = m.group(1), m.group(2)
    else:
        effect = re.sub(r'^Effect:\s*', '', text)
    kind = 'passive' if timing.lower().startswith('passive') else 'activated'
    ability = {'name': name, 'kind': kind}
    if category:
        ability['category'] = category
    if kind != 'passive':
        ability['timing'] = timing
    if declare:
        ability['declare'] = declare
    ability['effect'] = effect
    return ability


SMALL_WORDS = {'a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'is', 'of', 'on', 'the', 'to'}


def title(text: str) -> str:
    """'CLAIM WHAT’S YOURS' -> 'Claim What’s Yours'."""
    words = clean(text).lower().split(' ')
    out = []
    for i, w in enumerate(words):
        small = 0 < i < len(words) - 1 and w in SMALL_WORDS
        out.append(w if small else '-'.join(p[:1].upper() + p[1:] for p in w.split('-')))
    return ' '.join(out)


def slices(html: str, ids):
    """Raw HTML from each heading id to the next one (or the TO pack)."""
    pos = [(html.find(f'id="{i}"'), i) for i in ids]
    pos = sorted(p for p in pos if p[0] >= 0)
    end = html.find('Tournament Organiser Pack 2026-27', pos[-1][0])
    out = {}
    for k, (at, i) in enumerate(pos):
        stop = pos[k + 1][0] if k + 1 < len(pos) else end
        out[i] = html[at:stop]
    return out


def parse_battleplans(soup, html: str):
    text = clean(soup.get_text(' '))
    table = re.search(r'BATTLEPLAN TABLE 1 BATTLEPLAN TABLE 2 D6 BATTLEPLAN D6 BATTLEPLAN (.*?) 3\. Set Up', text)
    order = {}
    for a, n1, _b, n2 in re.findall(r'(\d) (.+?) (\d) (.+?)(?= \d |$)', table.group(1)):
        order[slugify(n1)] = (1, int(a))
        order[slugify(n2)] = (2, int(a))

    maps_at = html.find('>Battleplan Maps<')
    heads = {}
    for m in re.finditer(r'<h3 id="([^"]+)"[^>]*>(.*?)</h3>', html[maps_at:]):
        name = clean(BeautifulSoup(m.group(2), 'html.parser').get_text())
        if slugify(name) in order and slugify(name) not in heads:
            heads[slugify(name)] = (m.group(1), name)
    sections = slices(html, [h[0] for h in heads.values()])

    plans = []
    for pid, (anchor, name) in heads.items():
        raw = sections[anchor]
        frag = BeautifulSoup(raw, 'html.parser')
        table_no, d6 = order[pid]

        # Twist: from "TWIST:" up to the first ability card or the scoring rules.
        cut = [i for i in (raw.find('class="abHeader"'), raw.find('scores victory points')) if i > 0]
        twist_html = raw[raw.find('TWIST:') + len('TWIST:'): min(cut)] if 'TWIST:' in raw else ''
        twist_html = twist_html[: twist_html.rfind('<table')] if '<table' in twist_html else twist_html
        twist = clean(BeautifulSoup(twist_html, 'html.parser').get_text(' ')).lstrip('</b> ').strip()

        abilities = []
        for header in frag.select('td.abHeader'):
            body = header.find_next('div', class_='abBody')
            if body is not None:
                abilities.append(parse_ability(header, body))

        scoring = []
        lead = frag.find(string=re.compile('scores victory points'))
        if lead is not None:
            ul = lead.find_next('ul')
            if ul is not None:
                scoring = [clean(li.get_text(' ')) for li in ul.find_all('li', recursive=False)]

        full = clean(frag.get_text(' '))
        notes = []
        m = re.search(r'(?:FAQ / Errata|FAQ) Show (.*?)(?= Battleplan \d+ \(Table \d\)|$)', full)
        if m:
            notes.append(m.group(1))

        img = frag.find('img', src=re.compile(r'/img/battleplans/'))
        plans.append({
            'id': pid,
            'name': name,
            'number': d6 + (6 if table_no == 2 else 0),
            'table': table_no,
            'imageUrl': SITE + img['src'] if img else None,
            'sourceUrl': PAGE + '#' + anchor,
            'twist': twist,
            'abilities': abilities,
            'scoring': scoring,
            'notes': notes,
        })
    return sorted(plans, key=lambda p: p['number'])


def parse_tactics(html: str):
    cards = []
    marks = list(re.finditer(r'BATTLE TACTICS CARD (\d+)</div>', html))
    end = html.find('>Battleplan Maps<')
    for k, m in enumerate(marks):
        raw = html[m.end(): marks[k + 1].start() if k + 1 < len(marks) else end]
        raw = raw.split('FAQ / Errata')[0].split('>FAQ<')[0]
        frag = BeautifulSoup(raw, 'html.parser')
        name = clean(frag.find('h3').get_text())
        fluff = frag.find('p', class_='ShowFluff')
        flavour = clean(fluff.get_text(' ')) if fluff else ''
        first_tactic = re.search(r'(AFFRAY|STRIKE|DOMINATION):', raw)
        setup_html = raw[raw.find('</p>') + 4 if fluff else 0: first_tactic.start() if first_tactic else len(raw)]
        setup = clean(BeautifulSoup(setup_html, 'html.parser').get_text(' '))
        tactics = []
        # Each tactic starts at its red AFFRAY/STRIKE/DOMINATION label and runs to the next one.
        chunks = re.split(r'(?=<span class="redfont">)', raw)[1:]
        for chunk in chunks:
            part = BeautifulSoup(chunk, 'html.parser')
            label = clean(part.find('span', class_='redfont').get_text()).rstrip(':')
            tname = part.find('b')
            tfluff = part.find('p', class_='ShowFluff')
            body = clean(part.get_text(' '))
            cond = body[body.find('You complete'):] if 'You complete' in body else body
            vp = re.search(r'(\d+) VICTORY POINTS', cond)
            tactics.append({
                'type': title(label),
                'name': title(tname.get_text()) if tname else '',
                'flavour': clean(tfluff.get_text(' ')) if tfluff else '',
                'condition': clean(cond[: vp.start()] if vp else cond),
                'victoryPoints': int(vp.group(1)) if vp else 0,
            })
        card = {'number': int(m.group(1)), 'name': name, 'flavour': flavour, 'tactics': tactics}
        if setup:
            card['setup'] = setup
        cards.append(card)
    return cards


# ---------------------------------------------------------------- map geometry


def classify_terrain(rgb, x, y, r, legend_dir: Path):
    def disc(img, size=64):
        g = np.array(img.convert('L').resize((size, size)), dtype=float)
        yy, xx = np.mgrid[:size, :size]
        v = g[np.hypot(xx - size / 2, yy - size / 2) < size * 0.38]
        return (v - v.mean()) / (v.std() + 1e-6)

    c = disc(rgb.crop((x - r, y - r, x + r, y + r)))
    best = (-1.0, None)
    for kind, files in LEGEND.items():
        for f in files:
            t = Image.open(legend_dir / f).convert('RGBA')
            bg = Image.new('RGBA', t.size, (255, 255, 255, 255))
            bg.alpha_composite(t)
            score = float((c * disc(bg.convert('RGB'))).mean())
            best = max(best, (score, kind))
    return best


def territory_cells(im, icons):
    """Attacker/defender cells on the 7.5" x 5.5" grid that every map's territories follow."""
    h, w, _ = im.shape
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    cls = np.zeros((h, w), dtype=int)
    cls[(np.abs(r - b) < 25) & (np.abs(r - g) < 20) & (r > 120) & (r < 200)] = 3
    cls[(r - b > 35) & (r > g + 30) & (r < 200)] = 1
    cls[(b - r > 30) & (g > r) & (b < 170)] = 2
    yy, xx = np.mgrid[:h, :w]
    for cx, cy, rad in icons:
        cls[np.hypot(xx - cx, yy - cy) < rad + 8] = 0
    cw, ch = w / 8, h / 8
    grid = np.zeros((8, 8), dtype=int)
    for j in range(8):
        for i in range(8):
            cell = cls[int(j * ch): int((j + 1) * ch), int(i * cw): int((i + 1) * cw)]
            counts = [np.sum(cell == k) for k in (1, 2, 3)]
            grid[j, i] = 1 + int(np.argmax(counts)) if max(counts) else 0
    if (grid == 0).any():
        idx = ndimage.distance_transform_edt(grid == 0, return_distances=False, return_indices=True)
        grid = grid[tuple(idx)]
    return grid


def polygons(grid, value):
    """Rectangles (as point lists, inches) covering the grid cells with `value`."""
    rects = []
    for j in range(grid.shape[0]):
        i = 0
        while i < grid.shape[1]:
            if grid[j, i] != value:
                i += 1
                continue
            k = i
            while k < grid.shape[1] and grid[j, k] == value:
                k += 1
            rects.append([i, j, k, j + 1])
            i = k
    merged = []
    for x0, y0, x1, y1 in rects:  # stack identical runs vertically
        for m in merged:
            if m[0] == x0 and m[2] == x1 and m[3] == y0:
                m[3] = y1
                break
        else:
            merged.append([x0, y0, x1, y1])
    out = []
    for x0, y0, x1, y1 in merged:
        a, b, c, d = x0 * 7.5, y0 * 5.5, x1 * 7.5, y1 * 5.5
        out.append([{'x': a, 'y': b}, {'x': c, 'y': b}, {'x': c, 'y': d}, {'x': a, 'y': d}])
    return out


def snap(v, step):
    return round(round(v / step) * step, 2)


def geometry(path: Path, legend_dir: Path, overlay_to: Path):
    rgb = Image.open(path).convert('RGB')
    im = np.array(rgb).astype(float)
    objs = find_objectives(im)
    objectives, warnings = [], []
    for o in objs:
        x, y = snap(o['x'], 3.75), snap(o['y'], 2.75)
        if abs(x - o['x']) > 0.8 or abs(y - o['y']) > 0.8:
            warnings.append(f"objective {o['kind']} at ({o['x']:.1f}, {o['y']:.1f}) is off-grid")
            x, y = snap(o['x'], 0.5), snap(o['y'], 0.5)
        objectives.append({'id': f"o{len(objectives) + 1}", 'kind': o['kind'], 'x': x, 'y': y})
    terrain = []
    found = circles(im, range(36, 76, 2), 0.6)
    for _, x, y, rad in found:
        if any(np.hypot(x - o['px'][0], y - o['px'][1]) < o['r'] + 10 for o in objs):
            continue
        score, kind = classify_terrain(rgb, x, y, rad, legend_dir)
        if score < 0.4:
            continue
        terrain.append({'kind': kind, 'size': 'medium' if rad >= 58 else 'small',
                        'x': snap(x / PX_X, 0.5), 'y': snap(y / PX_Y, 0.5)})
    icons = [(o['px'][0], o['px'][1], o['r'] + 6) for o in objs] + [(x, y, rad) for _, x, y, rad in found]
    grid = territory_cells(im, icons)
    geo = {
        'board': {'width': 60, 'height': 44},
        'deployment': {'attacker': polygons(grid, 1), 'defender': polygons(grid, 2)},
        'objectives': sorted(objectives, key=lambda o: (o['y'], o['x'])),
        'terrain': sorted(terrain, key=lambda t: (t['y'], t['x'])),
    }
    # Review overlay: extracted geometry drawn over the source map.
    vis = rgb.resize((600, 440))
    d = ImageDraw.Draw(vis)
    s = 10
    for side, col in (('attacker', (255, 60, 60)), ('defender', (60, 160, 255))):
        for poly in geo['deployment'][side]:
            d.rectangle([poly[0]['x'] * s, poly[0]['y'] * s, poly[2]['x'] * s - 2, poly[2]['y'] * s - 2], outline=col, width=3)
    for o in geo['objectives']:
        d.ellipse([o['x'] * s - 33, o['y'] * s - 33, o['x'] * s + 33, o['y'] * s + 33], outline=(0, 255, 0), width=3)
    for t in geo['terrain']:
        rr = 37 if t['size'] == 'medium' else 23
        d.ellipse([t['x'] * s - rr, t['y'] * s - rr, t['x'] * s + rr, t['y'] * s + rr], outline=(255, 0, 255), width=3)
        d.text((t['x'] * s - 20, t['y'] * s - 5), t['kind'][:5], fill=(255, 0, 255))
    overlay_to.parent.mkdir(parents=True, exist_ok=True)
    vis.save(overlay_to)
    return geo, warnings


def main():
    refresh = '--refresh' in sys.argv
    page = fetch(PAGE, CACHE / 'page.html', refresh)
    html = page.read_text(encoding='utf-8')
    soup = BeautifulSoup(html, 'html.parser')
    legend_dir = CACHE / 'legend'
    for files in LEGEND.values():
        for f in files:
            fetch(f'{SITE}/aos4/img/{f}', legend_dir / f, refresh)

    plans = parse_battleplans(soup, html)
    hashes = {}
    for p in plans:
        img = fetch(p['imageUrl'], CACHE / 'maps' / Path(p['imageUrl']).name, refresh)
        hashes[p['id']] = hashlib.sha256(img.read_bytes()).hexdigest()
        geo, warnings = geometry(img, legend_dir, CACHE / 'overlays' / f"{p['id']}.png")
        p.update(geo)
        for w in warnings:
            print(f"WARNING {p['name']}: {w}")
        print(f"{p['number']:2d} {p['name']}: {len(p['objectives'])} objectives, {len(p['terrain'])} terrain, "
              f"{len(p['abilities'])} abilities, {len(p['scoring'])} scoring rules")

    tactics = parse_tactics(html)
    for c in tactics:
        print(f"tactics card {c['number']} {c['name']}: {[t['name'] for t in c['tactics']]}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    data = {'source': {'name': "Wahapedia: General's Handbook 2026-27", 'url': PAGE},
            'battleplans': plans, 'battleTactics': tactics}
    OUT.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    LOCK.write_text(json.dumps({'url': PAGE, 'mapSha256': hashes}, indent=2) + '\n')
    print(f'wrote {OUT.relative_to(ROOT)}; review overlays in {CACHE.relative_to(ROOT)}/overlays/')


if __name__ == '__main__':
    main()
