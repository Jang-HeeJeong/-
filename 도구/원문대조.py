# -*- coding: utf-8 -*-
"""
표제기 원문과 app/표제기_데이터.js 를 대조해 빠진 항목을 찾는다.

  실행:  python 도구/원문대조.py
  결과:  도구/원문대조_결과.txt  (UTF-8)

원문 파일은 CP949로 저장돼 있어 그냥 열면 글자가 깨진다.
콘솔도 CP949라 한글 출력이 깨지므로 결과는 파일로 남긴다.
"""
import io, os, re, json, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIG = os.path.join(BASE, '참고자료',
                    '[별표 1] 의약품의 표준제조기준(제3조 관련)(의약품 표준제조기준).txt')
DATA = os.path.join(BASE, 'app', '표제기_데이터.js')
OUT  = os.path.join(BASE, '도구', '원문대조_결과.txt')

# 화면에서 쓰는 5개 장만 본다 (CHAPTER_ORDER 와 같음)
CHAPTERS = [
    ('제1장_비타민미네랄', 1),
    ('제2장_해열진통제',   2),
    ('제3장_감기약',       3),
    ('제7장_진해거담제',   7),
    ('제9장_비염용경구제', 9),
]

# 원문 소제목 → 데이터 키.
# 원문은 "용법·용량"처럼 가운뎃점이 섞여 있어 정규식으로 찾는다.
SECTIONS = [
    ('유효성분의 종류',        r'유효성분의\s*종류',                 '유효성분의_종류'),
    ('유효성분의 분량',        r'유효성분의\s*분량',                 '유효성분의_분량'),
    ('배합성분의 종류·한도',   r'배합성분의\s*종류\s*및\s*배합한도', '배합성분의_종류_및_배합한도'),
    ('용법·용량',              r'용법\s*·?\s*용량',                  '용법용량'),
]

# 원문에는 로마숫자·가운뎃점이 HTML 기호로 들어 있다. 그대로 비교하면
# 데이터의 "Ⅻ항"과 원문의 "&#8555;항"이 다른 글자로 보여 오탐이 난다.
ENTITIES = {
    '&#8554;': 'Ⅺ', '&#8555;': 'Ⅻ', '&#8556;': 'Ⅼ',
    '&#8228;': '·', '&#8231;': '·', '&middot;': '·',
    '&nbsp;': ' ', '&amp;': '&',
}


def unescape(t):
    for k, v in ENTITIES.items():
        t = t.replace(k, v)
    return re.sub(r'&#\d+;', '', t)


def load_orig():
    for enc in ('cp949', 'utf-8-sig', 'utf-8'):
        try:
            return io.open(ORIG, encoding=enc).read()
        except UnicodeDecodeError:
            continue
    raise SystemExit('원문 파일 인코딩을 알 수 없습니다: ' + ORIG)


def load_db():
    js = io.open(DATA, encoding='utf-8').read()
    i = js.index('{', js.index('__EMBEDDED_DB__'))
    return json.loads(js[i:js.rindex('}') + 1])


def chapter_bounds(orig):
    """줄머리의 '제n장 …' 제목 위치로 장 경계를 잡는다.
       (본문 안에서도 '제3장'이 인용되므로 줄머리만 인정한다)"""
    marks = []
    for m in re.finditer(r'\n\s*제\s*(\d+)\s*장\s+\S', orig):
        marks.append((int(m.group(1)), m.start()))
    marks.sort(key=lambda x: x[1])
    out = {}
    for i, (num, pos) in enumerate(marks):
        end = marks[i + 1][1] if i + 1 < len(marks) else len(orig)
        # 같은 장 번호가 여러 번 나오면 가장 긴 구간을 본문으로 본다
        if num not in out or (end - pos) > (out[num][1] - out[num][0]):
            out[num] = (pos, end)
    return out


# 다음 소제목의 모양 — 장마다 다르다.
#   제1~3·7장:  (1) (2) …
#   제9장:       (가) (나) (다) …
NEXT_HEAD = re.compile(r'\n\s*\((?:\d+|[가-힣])\)\s*\S')


def section_items(seg, title_re):
    """소제목 다음부터 다음 소제목 전까지에서 'n)' 항목을 센다."""
    m = re.search(title_re, seg)
    if not m:
        return None
    after = seg[m.end():]
    stop = NEXT_HEAD.search(after)
    blk = after[:stop.start()] if stop else after
    # 줄머리의 "1)" "  2)" 만 항목으로 본다 (문장 중간의 "1)" 제외)
    return re.findall(r'\n\s{0,4}(\d+)\)\s*([^\n]*)', blk)


def main():
    orig = unescape(load_orig())
    db = load_db()
    bounds = chapter_bounds(orig)
    lines = []
    w = lines.append

    w('표제기 원문 ↔ 데이터 대조 결과')
    w('원문: %s (%d자)' % (os.path.basename(ORIG), len(orig)))
    w('=' * 78)

    total_gap = 0
    for key, num in CHAPTERS:
        if num not in bounds:
            w('')
            w('[%s]  원문에서 장을 찾지 못함' % key)
            continue
        lo, hi = bounds[num]
        seg = orig[lo:hi]
        w('')
        w('[%s]  원문 구간 %d자' % (key, len(seg)))
        for label, title_re, dbkey in SECTIONS:
            items = section_items(seg, title_re)
            dbv = db.get(key, {}).get('기준', {}).get(dbkey)
            if items is None and dbv is None:
                continue
            on = len(items) if items else 0
            dn = len(dbv) if isinstance(dbv, list) else (0 if dbv is None else 1)
            flag = ''
            if items and isinstance(dbv, list) and on != dn:
                flag = '   ← 차이 %+d' % (dn - on)
                total_gap += abs(dn - on)
            w('  %-22s 원문 %2d / 데이터 %2d%s' % (label, on, dn, flag))

            # 개수가 다르면 어느 항목이 없는지 보여준다
            if flag and items:
                dbtxt = [re.sub(r'\s+', '', unescape(str(x))) for x in dbv]
                for n2, text in items:
                    key40 = re.sub(r'\s+', '', unescape(text))[:28]
                    if key40 and not any(key40[:14] in t for t in dbtxt):
                        w('      빠짐  %s) %s' % (n2, text.strip()[:88]))

    w('')
    w('=' * 78)
    w('개수가 어긋난 항목 합계: %d' % total_gap)
    w('')
    w('※ 이 대조는 개수와 앞 글자만 봅니다. 표(<표1> 등)와 세부 수치는')
    w('   포함하지 않으므로, 차이가 0이어도 표 내용까지 같다는 뜻은 아닙니다.')

    io.open(OUT, 'w', encoding='utf-8').write('\n'.join(lines))
    sys.stdout.write('done -> %s\n' % OUT)


if __name__ == '__main__':
    main()
