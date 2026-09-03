# -*- coding: utf-8 -*-
"""
데이터의 조항 문구·순서를 원문 그대로 다시 채운다.

  미리보기:  python 도구/조항동기화.py <원문.txt>
  실제 반영:  python 도구/조항동기화.py <원문.txt> --적용

결과는 도구/조항동기화_결과.txt 에 남는다.

왜 이 도구가 필요한가 —
사람이 조항을 손으로 옮겨 적으면 두 가지가 어긋난다.
  · 문구가 줄어든다. 실제로 "각각의 1일 최대분량으로 나누어 얻은"처럼
    계산 방법을 정의한 부분이 사라져 있었다.
  · 순서가 밀린다. 누락 조항을 배열 끝에 덧붙이면 그 뒤로 전부 어긋난다.
    조항별 판정과 원문 근거 표시가 자리로 조항을 가리키므로,
    이게 밀리면 엉뚱한 조항이 근거로 붙는다 (실제로 그랬다).

원문에서 그대로 읽어 넣으므로 두 문제가 함께 사라진다.
개정 때는 새 원문을 넣고 이 도구를 한 번 돌리면 된다.

★ 조항 개수가 바뀌면 조항별 판정 배열(computeChNKindsAmtsStatus)도
  같이 고쳐야 한다. 개수가 바뀐 절은 결과에 크게 표시한다.
"""
import io, os, re, json, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, 'app', '표제기_데이터.js')
OUT  = os.path.join(BASE, '도구', '조항동기화_결과.txt')

# 장마다 조항 매기는 방식이 다르다.
#   제2·3·7·9장 :  1) 2) 3)   … 소제목은 (1) (2) 또는 (가) (나)
#   제1장        : (1) (2) (3) … 소제목은 1) 2) 3)
# 그래서 "조항 표시"와 "다음 소제목 표시"를 장마다 따로 준다.
NUM   = dict(item=r'^(\d+)\)\s*(.*)$',    nexthead=r'\n\s*\((?:\d+|[가-힣])\)\s*\S')
PAREN = dict(item=r'^\((\d+)\)\s*(.*)$',  nexthead=r'\n\s*\d\)\s*[가-힣]')

CHAPTERS = [
    ('제1장_비타민미네랄', 1, PAREN),
    ('제2장_해열진통제',   2, NUM),
    ('제3장_감기약',       3, NUM),
    ('제7장_진해거담제',   7, NUM),
    ('제9장_비염용경구제', 9, NUM),
]

SECTIONS = [
    ('유효성분의 종류',   r'유효성분의\s*종류',                 '유효성분의_종류'),
    ('유효성분의 분량',   r'유효성분의\s*분량',                 '유효성분의_분량'),
    # 제1장은 이 이름으로 조항을 담는다
    ('배합성분의 종류',   r'배합성분의\s*종류\s*및\s*배합한도', '배합성분의_종류_및_배합한도'),
    ('용법·용량',         r'용법\s*·?\s*용량',                  '용법용량'),
]

NEXT_HEAD = re.compile(NUM['nexthead'])


def load(path):
    for enc in ('utf-8-sig', 'utf-8', 'cp949'):
        try:
            return io.open(path, encoding=enc).read()
        except UnicodeDecodeError:
            continue
    raise SystemExit('인코딩을 알 수 없습니다: ' + path)


def chapter_span(text, num):
    marks = [(int(m.group(1)), m.start())
             for m in re.finditer(r'\n\s*제\s*(\d+)\s*장\s+\S', text)]
    marks.sort(key=lambda x: x[1])
    for i, (n, pos) in enumerate(marks):
        if n == num:
            return pos, (marks[i + 1][1] if i + 1 < len(marks) else len(text))
    return None


def section_items(seg, title_re, fmt=None):
    """소제목 다음의 조항을 번호별로 모은다. 이어지는 줄은 앞 조항에 붙인다.

    조항에 딸린 예시("예) …")도 번호가 없으므로 앞 조항에 붙는다 —
    원문이 한 조항으로 적은 것을 둘로 쪼개지 않으려는 것이다."""
    fmt = fmt or NUM
    m = re.search(title_re, seg)
    if not m:
        return {}
    after = seg[m.end():]
    stop = re.compile(fmt['nexthead']).search(after)
    blk = after[:stop.start()] if stop else after
    out, cur, num = {}, [], None
    for ln in blk.split('\n'):
        s = ln.strip()
        if not s:
            continue
        m2 = re.match(fmt['item'], s)
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


def tidy(t):
    """표기만 데이터 쪽에 맞춘다 — 내용은 건드리지 않는다."""
    t = re.sub(r'<\s*표\s*(\d+)\s*>', r'<표\1>', t)
    for a, b in (('“', '"'), ('”', '"'), ('‘', "'"), ('’', "'"),
                 ('㎎', 'mg'), ('㎍', 'μg'), ('㎖', 'mL')):
        t = t.replace(a, b)
    return re.sub(r'\s+', ' ', t).strip()


def same(a, b):
    return re.sub(r'\s+', '', str(a)) == re.sub(r'\s+', '', str(b))


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    apply = '--적용' in sys.argv or '--apply' in sys.argv
    orig = load([a for a in sys.argv[1:] if not a.startswith('--')][0])

    js = io.open(DATA, encoding='utf-8').read()
    i = js.index('{', js.index('__EMBEDDED_DB__'))
    j = js.rindex('}') + 1
    db = json.loads(js[i:j])

    L, n_changed, n_countdiff = [], 0, 0
    w = L.append
    w('조항 동기화 %s' % ('— 실제 반영' if apply else '— 미리보기 (파일은 그대로)'))
    w('=' * 78)

    for key, num, fmt in CHAPTERS:
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

        for label, title_re, dbkey in SECTIONS:
            src = section_items(seg, title_re, fmt)
            if not src:
                w('  %-14s 원문에서 못 읽음 — 건너뜀' % label)
                continue
            cur = list(db[key]['기준'].get(dbkey, []))
            new = [tidy(src[n]) for n in sorted(src)]
            diff = sum(1 for a, b in zip(cur, new) if not same(a, b))
            diff += abs(len(cur) - len(new))

            if len(cur) != len(new):
                n_countdiff += 1
                w('')
                w('  ※※ %s : 조항 수가 %d개 → %d개로 바뀝니다 ※※'
                  % (label, len(cur), len(new)))
                w('     조항별 판정 배열(computeCh%dKindsAmtsStatus)도 같이 고쳐야 합니다.' % num)
            elif diff:
                w('')
                w('  %s : %d개 (문구만 바뀜 %d곳)' % (label, len(new), diff))
            else:
                w('  %-14s %d개 — 이미 원문과 같음' % (label, len(new)))
                continue

            n_changed += diff
            for n in range(max(len(cur), len(new))):
                a = cur[n] if n < len(cur) else '(없음)'
                b = new[n] if n < len(new) else '(없어짐)'
                if same(a, b):
                    continue
                w('    %2d) 지금: %s' % (n + 1, str(a)[:100]))
                w('        원문: %s' % str(b)[:100])

            if apply:
                db[key]['기준'][dbkey] = new

    w('')
    w('=' * 78)
    w('바뀌는 조항 %d곳 · 조항 수가 달라지는 절 %d개' % (n_changed, n_countdiff))
    if not apply:
        w('')
        w('실제로 넣으려면 --적용 을 붙여 다시 실행하세요.')
    if n_countdiff:
        w('')
        w('★ 조항 수가 바뀐 절이 있습니다. 반영 후 반드시 회귀 시험을 돌리고,')
        w('  조항별 판정 배열의 순서를 새 조항 번호에 맞춰 고치세요.')

    if apply:
        out = js[:i] + json.dumps(db, ensure_ascii=False, separators=(',', ':')) + js[j:]
        io.open(DATA, 'w', encoding='utf-8').write(out)

    io.open(OUT, 'w', encoding='utf-8').write('\n'.join(L))
    sys.stdout.write('%s: %d clauses, %d sections change count -> %s\n'
                     % ('applied' if apply else 'preview', n_changed, n_countdiff,
                        os.path.basename(OUT)))


if __name__ == '__main__':
    main()
