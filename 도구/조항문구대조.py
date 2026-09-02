# -*- coding: utf-8 -*-
"""
데이터에 담긴 조항 문구가 원문과 같은지 하나씩 견준다.

  python 도구/조항문구대조.py <원문.txt>
  결과: 도구/조항문구대조_결과.txt (UTF-8)

원문대조.py는 조항 "개수"만 세지만, 이건 조항 "내용"을 견준다.
개수가 맞아도 문장이 잘려 있을 수 있다 —
실제로 제3장 분량 조항 여러 개가 계산 방법을 정의한 부분을
통째로 잃은 채 들어 있었다. 그 문구가 워드 검토서에 그대로
실리므로, 받는 쪽이 무슨 기준인지 알 수 없게 된다.
"""
import io, os, re, json, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, 'app', '표제기_데이터.js')
OUT  = os.path.join(BASE, '도구', '조항문구대조_결과.txt')

CHAPTERS = [
    ('제1장_비타민미네랄', 1),
    ('제2장_해열진통제',   2),
    ('제3장_감기약',       3),
    ('제7장_진해거담제',   7),
    ('제9장_비염용경구제', 9),
]

SECTIONS = [
    ('유효성분의 종류', r'유효성분의\s*종류',                 '유효성분의_종류'),
    ('유효성분의 분량', r'유효성분의\s*분량',                 '유효성분의_분량'),
    ('배합성분의 종류', r'배합성분의\s*종류\s*및\s*배합한도', '배합성분의_종류_및_배합한도'),
    ('용법·용량',       r'용법\s*·?\s*용량',                  '용법용량'),
]

ENTITIES = {'&#8554;':'Ⅺ','&#8555;':'Ⅻ','&#8556;':'Ⅼ','&#8228;':'·','&#8231;':'·',
            '&middot;':'·','&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>'}

NEXT_HEAD = re.compile(r'\n\s*\((?:\d+|[가-힣])\)\s*\S')


def unescape(t):
    for k, v in ENTITIES.items():
        t = t.replace(k, v)
    return re.sub(r'&#\d+;', '', t)


def load(path):
    for enc in ('utf-8-sig', 'utf-8', 'cp949'):
        try:
            return unescape(io.open(path, encoding=enc).read())
        except UnicodeDecodeError:
            continue
    raise SystemExit('인코딩을 알 수 없습니다: ' + path)


def load_db():
    js = io.open(DATA, encoding='utf-8').read()
    return json.loads(js[js.index('{', js.index('__EMBEDDED_DB__')):js.rindex('}') + 1])


def chapter_span(text, num):
    marks = [(int(m.group(1)), m.start())
             for m in re.finditer(r'\n\s*제\s*(\d+)\s*장\s+\S', text)]
    marks.sort(key=lambda x: x[1])
    for i, (n, pos) in enumerate(marks):
        if n == num:
            return pos, (marks[i + 1][1] if i + 1 < len(marks) else len(text))
    return None


def section_items(seg, title_re):
    """소제목 다음의 'n)' 항목을 번호별로 모은다. 이어지는 줄은 붙인다."""
    m = re.search(title_re, seg)
    if not m:
        return {}
    after = seg[m.end():]
    stop = NEXT_HEAD.search(after)
    blk = after[:stop.start()] if stop else after
    out, cur, num = {}, [], None
    for ln in blk.split('\n'):
        s = ln.strip()
        if not s:
            continue
        m2 = re.match(r'^(\d+)\)\s*(.*)$', s)
        if m2:
            if num is not None:
                out[num] = ' '.join(cur).strip()
            num = int(m2.group(1))
            cur = [m2.group(2)]
        elif num is not None:
            cur.append(s)
    if num is not None:
        out[num] = ' '.join(cur).strip()
    return out


def norm(t):
    """견줄 때만 쓰는 정규화 — 표기 차이로 다르다고 하지 않게."""
    t = unescape(str(t))
    t = re.sub(r'<\s*표\s*(\d+)\s*>', r'<표\1>', t)
    for a, b in (('“', '"'), ('”', '"'), ('‘', "'"), ('’', "'"),
                 ('ㆍ', '·'), ('・', '·'), ('，', ','), ('㎎', 'mg'), ('㎍', 'μg'), ('㎖', 'mL')):
        t = t.replace(a, b)
    return re.sub(r'\s+', '', t)


def main():
    if len(sys.argv) < 2:
        raise SystemExit('사용법: python 도구/조항문구대조.py <원문.txt>')
    orig = load(sys.argv[1])
    db = load_db()

    L, gaps = [], 0
    w = L.append
    w('조항 문구 대조 — 데이터 ↔ 원문')
    w('원문: %s' % os.path.basename(sys.argv[1]))
    w('=' * 78)

    for key, num in CHAPTERS:
        span = chapter_span(orig, num)
        if not span:
            w('')
            w('[%s] 원문에서 장을 찾지 못함' % key)
            continue
        seg = orig[span[0]:span[1]]
        w('')
        w('─' * 78)
        w('[%s]' % key)
        w('─' * 78)
        found_any = False

        for label, title_re, dbkey in SECTIONS:
            items = section_items(seg, title_re)
            arr = db.get(key, {}).get('기준', {}).get(dbkey)
            if not items or not isinstance(arr, list):
                continue
            for n in sorted(items):
                if n > len(arr):
                    continue
                o, d = items[n], str(arr[n - 1])
                no, nd = norm(o), norm(d)
                if no == nd:
                    continue
                found_any = True
                gaps += 1
                # 데이터가 원문의 앞부분만 담고 있으면 "잘림"으로 본다
                kind = '잘림' if no.startswith(nd) else ('덧붙음' if nd.startswith(no) else '다름')
                w('')
                w('  %s %d)  [%s]  원문 %d자 / 데이터 %d자' % (label, n, kind, len(o), len(d)))
                w('    원문  : %s' % o[:230])
                w('    데이터: %s' % d[:230])
        if not found_any:
            w('  (문구가 모두 같음)')

    w('')
    w('=' * 78)
    w('문구가 다른 조항: %d개' % gaps)
    w('')
    w('※ "잘림"은 데이터가 원문의 앞부분만 담고 있다는 뜻입니다.')
    w('   계산 방법을 정의한 뒷부분이 사라진 경우가 있으니 특히 살펴보세요.')

    io.open(OUT, 'w', encoding='utf-8').write('\n'.join(L))
    sys.stdout.write('done: %d differing clauses -> %s\n' % (gaps, os.path.basename(OUT)))


if __name__ == '__main__':
    main()
