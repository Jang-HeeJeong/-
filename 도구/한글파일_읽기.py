# -*- coding: utf-8 -*-
"""
한글파일(.hwp / .hwpx)에서 글자를 뽑아 낸다.

  실행:  python 도구/한글파일_읽기.py "참고자료/개정본.hwp"
  결과:  같은 이름의 .txt 파일 (UTF-8)

PDF로 바꿨다가 글자를 다시 뽑는 과정이 필요 없다.
한글파일 안에 글자가 그대로 들어 있어서 바로 꺼내 온다.

  .hwpx  압축된 XML 묶음이다. 파이썬 기본 기능만으로 열린다.
  .hwp   예전 이진 형식이다. olefile이 필요하다.
         (없으면 python -m pip install olefile)

한글에서 [다른 이름으로 저장 → HWPX]로 저장하면 .hwpx가 되며,
이쪽이 표 구조가 더 정확하게 나온다.
"""
import io, os, re, sys, zlib, zipfile
import xml.etree.ElementTree as ET


# ══════════ HWPX (압축 XML) ══════════
def read_hwpx(path):
    """섹션 XML을 순서대로 읽어 문단·표를 글자로 편다."""
    out = []
    with zipfile.ZipFile(path) as z:
        names = [n for n in z.namelist() if re.match(r'Contents/section\d+\.xml$', n)]
        names.sort(key=lambda n: int(re.search(r'(\d+)', n).group(1)))
        if not names:
            raise SystemExit('section XML을 찾지 못했습니다. HWPX가 맞는지 확인하세요.')
        for n in names:
            root = ET.fromstring(z.read(n))
            out.append(_hwpx_walk(root))
    return '\n'.join(out)


def _tag(el):
    return el.tag.split('}')[-1]     # 이름공간(namespace) 떼기


def _hwpx_walk(el, depth=0):
    """문단(p)마다 줄바꿈, 표 칸(tc)마다 탭으로 나눈다."""
    name = _tag(el)
    if name == 't':                                   # 글자가 담긴 곳
        return el.text or ''
    parts = []
    for child in el:
        parts.append(_hwpx_walk(child, depth + 1))
    text = ''.join(parts)
    if name == 'p':                                   # 문단
        return text + '\n'
    if name == 'tc':                                  # 표의 한 칸
        return text.replace('\n', ' ').strip() + '\t'
    if name == 'tr':                                  # 표의 한 줄
        return text.rstrip('\t') + '\n'
    return text


# ══════════ HWP (이진 OLE) ══════════
def read_hwp(path):
    try:
        import olefile
    except ImportError:
        raise SystemExit(
            '.hwp를 읽으려면 olefile이 필요합니다.\n'
            '  python -m pip install olefile\n'
            '또는 한글에서 [다른 이름으로 저장 → HWPX]로 저장한 뒤 그 파일을 넣으세요.')

    ole = olefile.OleFileIO(path)
    try:
        # 본문은 BodyText/Section0, Section1 … 에 나뉘어 들어 있다
        secs = sorted(
            (e for e in ole.listdir() if len(e) == 2 and e[0] == 'BodyText'),
            key=lambda e: int(re.search(r'(\d+)', e[1]).group(1)))
        if not secs:
            raise SystemExit('BodyText를 찾지 못했습니다. 한글파일이 맞는지 확인하세요.')

        compressed = _hwp_is_compressed(ole)
        out = []
        for entry in secs:
            data = ole.openstream(entry).read()
            if compressed:
                data = zlib.decompress(data, -15)     # 헤더 없는 raw deflate
            out.append(_hwp_records_to_text(data))
        return '\n'.join(out)
    finally:
        ole.close()


def _hwp_is_compressed(ole):
    """FileHeader의 속성 비트 0번이 켜져 있으면 본문이 압축돼 있다."""
    head = ole.openstream('FileHeader').read()
    return bool(head[36] & 1) if len(head) > 36 else False


# 본문 레코드 중 글자를 담은 것의 종류 번호
_HWPTAG_PARA_TEXT = 0x43


def _hwp_records_to_text(buf):
    """레코드를 훑어 문단 글자만 모은다."""
    out, pos, n = [], 0, len(buf)
    while pos + 4 <= n:
        header = int.from_bytes(buf[pos:pos + 4], 'little')
        tag_id = header & 0x3FF
        size   = (header >> 20) & 0xFFF
        pos += 4
        if size == 0xFFF:                    # 크기가 커서 따로 적힌 경우
            if pos + 4 > n:
                break
            size = int.from_bytes(buf[pos:pos + 4], 'little')
            pos += 4
        chunk = buf[pos:pos + size]
        pos += size
        if tag_id == _HWPTAG_PARA_TEXT:
            out.append(_hwp_decode_para(chunk))
    return '\n'.join(t for t in out if t.strip())


def _hwp_decode_para(chunk):
    """UTF-16LE인데 제어문자가 섞여 있다. 글자만 남긴다."""
    chars = []
    i, n = 0, len(chunk) - 1
    while i < n:
        code = int.from_bytes(chunk[i:i + 2], 'little')
        i += 2
        if code in (10, 13):                 # 줄바꿈
            chars.append('\n')
        elif code == 9:                      # 탭 (표의 칸 구분)
            chars.append('\t')
        elif code < 32:
            # 1~31 중 일부는 뒤에 14바이트를 더 끌고 다닌다 (표·그림 등)
            if code in (1, 2, 3, 11, 12, 14, 15, 16, 17, 18, 21, 22, 23):
                i += 14
        else:
            chars.append(chr(code))
    return ''.join(chars)


# ══════════ 실행 ══════════
def main():
    if len(sys.argv) < 2:
        raise SystemExit('사용법: python 도구/한글파일_읽기.py "참고자료/개정본.hwp"')
    src = sys.argv[1]
    if not os.path.exists(src):
        raise SystemExit('파일이 없습니다: ' + src)

    ext = os.path.splitext(src)[1].lower()
    if ext == '.hwpx':
        text = read_hwpx(src)
    elif ext == '.hwp':
        text = read_hwp(src)
    else:
        raise SystemExit('.hwp 또는 .hwpx만 됩니다: ' + ext)

    # 빈 줄이 과하게 늘어나는 것만 정리한다 (내용은 손대지 않는다)
    text = re.sub(r'\n{3,}', '\n\n', text).strip() + '\n'

    dst = os.path.splitext(src)[0] + '.txt'
    io.open(dst, 'w', encoding='utf-8').write(text)

    # 콘솔이 CP949라 한글을 찍으면 깨진다 — 숫자만 알린다
    sys.stdout.write('done: %d chars -> %s\n' % (len(text), os.path.basename(dst)))


if __name__ == '__main__':
    main()
