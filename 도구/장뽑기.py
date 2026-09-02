# -*- coding: utf-8 -*-
"""
원문에서 한 장(章)만, 또는 그 안의 한 소절만 뽑아 낸다.

  python 도구/장뽑기.py <원문.txt> <장번호> [찾을말] [글자수]

  예)  python 도구/장뽑기.py 새전문.txt 1              → 제1장 전체
       python 도구/장뽑기.py 새전문.txt 1 "제 형" 800  → 제1장의 "제 형"부터 800자

결과는 도구/장뽑기_결과.txt (UTF-8)에 남는다.
콘솔이 CP949라 한글을 찍으면 깨지므로 파일로 낸다.

개정 반영은 장마다 나눠서 하는 게 안전하다. 이 도구는 그때
필요한 부분만 꺼내 보려고 만들었다 — 14만 자를 통째로 열 이유가 없다.
"""
import io, os, re, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT  = os.path.join(BASE, '도구', '장뽑기_결과.txt')

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


def chapter_span(text, num):
    """줄머리의 '제n장 …'만 장 제목으로 인정한다
       (본문 안에서도 '제3장'을 인용하기 때문)."""
    marks = [(int(m.group(1)), m.start())
             for m in re.finditer(r'\n\s*제\s*(\d+)\s*장\s+\S', text)]
    marks.sort(key=lambda x: x[1])
    for i, (n, pos) in enumerate(marks):
        if n == num:
            end = marks[i + 1][1] if i + 1 < len(marks) else len(text)
            return pos, end
    raise SystemExit('제%d장을 찾지 못했습니다.' % num)


def main():
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    src, num = sys.argv[1], int(sys.argv[2])
    needle = sys.argv[3] if len(sys.argv) > 3 else None
    span   = int(sys.argv[4]) if len(sys.argv) > 4 else 1200

    text = load(src)
    lo, hi = chapter_span(text, num)
    seg = text[lo:hi]

    if needle:
        # 공백이 여러 개 들어간 표기("제 형")도 찾히게 한다
        pat = re.compile(r'\s*'.join(map(re.escape, needle.replace(' ', ''))))
        m = pat.search(seg)
        if not m:
            body = '"%s"을(를) 제%d장에서 찾지 못했습니다. (구간 %d자)' % (needle, num, len(seg))
        else:
            body = seg[m.start():m.start() + span]
        head = '제%d장 · "%s" 부터 %d자' % (num, needle, span)
    else:
        body = seg
        head = '제%d장 전체 (%d자)' % (num, len(seg))

    io.open(OUT, 'w', encoding='utf-8').write(
        '[%s]\n%s\n%s\n' % (head, '=' * 70, body))
    sys.stdout.write('done: %d chars -> %s\n' % (len(body), os.path.basename(OUT)))


if __name__ == '__main__':
    main()
