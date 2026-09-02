# -*- coding: utf-8 -*-
"""
옛 표제기 원문과 새 원문을 견주어 "바뀐 곳만" 뽑아 낸다.

  실행:  python 도구/개정대조.py 옛원문.txt 새원문.txt
  결과:  도구/개정대조_결과.txt  (UTF-8)

왜 이렇게 하나 —
원문은 13만 자쯤 된다. 통째로 읽어 가며 눈으로 견주면 시간도 오래 걸리고
빠뜨리기도 쉽다. 이 도구는 바뀐 줄만 골라 내므로, 개정 폭이 크지 않으면
결과가 몇 쪽으로 줄어든다. 그 줄어든 것만 보고 데이터를 고치면 된다.

주의 — 줄 단위로 견준다. 문장 안에서 낱말 하나만 바뀌어도 그 줄 전체가
바뀐 것으로 나온다. 반대로 줄바꿈 위치만 달라져도 바뀐 것처럼 보이니,
결과를 그대로 믿지 말고 실제 문구를 확인해야 한다.
"""
import io, os, re, sys, difflib

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT  = os.path.join(BASE, '도구', '개정대조_결과.txt')

ENTITIES = {
    '&#8554;': 'Ⅺ', '&#8555;': 'Ⅻ', '&#8556;': 'Ⅼ',
    '&#8228;': '·', '&#8231;': '·', '&middot;': '·',
    '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>',
}


def load(path):
    for enc in ('utf-8-sig', 'utf-8', 'cp949'):
        try:
            t = io.open(path, encoding=enc).read()
            break
        except UnicodeDecodeError:
            continue
    else:
        raise SystemExit('인코딩을 알 수 없습니다: ' + path)
    for k, v in ENTITIES.items():
        t = t.replace(k, v)
    return re.sub(r'&#\d+;', '', t)


# 새 항목이 시작되는 자리 — 이 모양으로 시작하는 줄만 새 덩어리로 본다
_ITEM_HEAD = re.compile(
    r'^('
    r'제\s*\d+\s*장'            # 제3장
    r'|\(\s*\d+\s*\)'           # (2)
    r'|\(\s*[가-힣]\s*\)'        # (가)
    r'|\d+\s*\)'                # 1)
    r'|[가-힣]\s*\.\s'           # 가.
    r'|[\u2460-\u2473\u3260-\u327b\u326e-\u3273]'   # ① ㉮
    r'|<\s*표'                  # <표1>
    r'|\['                      # [별표
    r')')


def norm_lines(text):
    """문단을 조항 단위로 다시 이어 붙인다.

    옛 원문은 PDF에서 뽑아 24자마다 끊겨 있고, 새 원문은 한글파일에서
    뽑아 문단 단위(53자)로 끊겨 있다. 그대로 견주면 글자가 같아도
    끊긴 자리가 달라 거의 전부 "바뀜"으로 나온다.

    조항 머리(1) (2) 제n장 <표 …)가 나올 때만 새 덩어리를 시작하고,
    그 사이 줄은 하나로 합쳐서 견준다. 이러면 줄바꿈 차이는 사라지고
    실제로 글자가 달라진 조항만 남는다."""
    items, cur = [], ''
    for ln in text.split('\n'):
        raw = ln.rstrip()
        s = re.sub(r'[ \t\u00a0\u3000]+', ' ', raw).strip()
        if not s:
            continue
        if _ITEM_HEAD.match(s) or not cur:
            if cur:
                items.append(cur)
            cur = s
        else:
            # 표의 칸(탭)으로 시작하면 칸 구분을 살려 둔다
            cur += ('\t' if raw.startswith('\t') else ' ') + s
    if cur:
        items.append(cur)
    return items


def chapter_of(lines, idx):
    """그 줄이 몇 장에 속하는지 거슬러 올라가 찾는다."""
    for i in range(idx, -1, -1):
        m = re.match(r'^제\s*(\d+)\s*장\s+(\S.*)$', lines[i])
        if m:
            return '제%s장 %s' % (m.group(1), m.group(2)[:24])
    return '(장 앞부분)'


def main():
    if len(sys.argv) < 3:
        raise SystemExit('사용법: python 도구/개정대조.py 옛원문.txt 새원문.txt')
    old_p, new_p = sys.argv[1], sys.argv[2]
    for p in (old_p, new_p):
        if not os.path.exists(p):
            raise SystemExit('파일이 없습니다: ' + p)

    old = norm_lines(load(old_p))
    new = norm_lines(load(new_p))

    sm = difflib.SequenceMatcher(None, old, new, autojunk=False)
    blocks = [op for op in sm.get_opcodes() if op[0] != 'equal']

    L = []
    w = L.append
    w('표제기 개정 대조 결과')
    w('옛: %s  (%d줄)' % (os.path.basename(old_p), len(old)))
    w('새: %s  (%d줄)' % (os.path.basename(new_p), len(new)))
    w('닮은 정도: %.1f%%' % (sm.ratio() * 100))
    w('=' * 78)

    if not blocks:
        w('')
        w('바뀐 곳이 없습니다.')
    else:
        n_add = n_del = n_mod = 0
        for kind, i1, i2, j1, j2 in blocks:
            if kind == 'insert':
                n_add += (j2 - j1)
            elif kind == 'delete':
                n_del += (i2 - i1)
            else:
                n_mod += max(i2 - i1, j2 - j1)

        w('')
        w('바뀐 자리 %d곳 — 새로 생김 %d줄 · 없어짐 %d줄 · 고쳐짐 %d줄'
          % (len(blocks), n_add, n_del, n_mod))
        w('')

        last_ch = None
        for kind, i1, i2, j1, j2 in blocks:
            ch = chapter_of(old, i1 - 1 if i1 else 0) if i1 < len(old) or old else '(끝)'
            if ch != last_ch:
                w('')
                w('─' * 78)
                w('[%s]' % ch)
                w('─' * 78)
                last_ch = ch
            w('')
            if kind == 'replace':
                w('  ▷ 고쳐짐 (옛 %d행 → 새 %d행)' % (i2 - i1, j2 - j1))
                for ln in old[i1:i2]:
                    w('     - ' + ln[:140])
                for ln in new[j1:j2]:
                    w('     + ' + ln[:140])
            elif kind == 'delete':
                w('  ▷ 없어짐 (%d행)' % (i2 - i1))
                for ln in old[i1:i2]:
                    w('     - ' + ln[:140])
            else:
                w('  ▷ 새로 생김 (%d행)' % (j2 - j1))
                for ln in new[j1:j2]:
                    w('     + ' + ln[:140])

    w('')
    w('=' * 78)
    w('- 는 옛 원문, + 는 새 원문입니다.')
    w('줄바꿈 위치만 달라져도 바뀐 것처럼 보일 수 있으니 실제 문구를 확인하세요.')

    io.open(OUT, 'w', encoding='utf-8').write('\n'.join(L))
    sys.stdout.write('done: %d changed blocks -> %s\n'
                     % (len(blocks), os.path.basename(OUT)))


if __name__ == '__main__':
    main()
