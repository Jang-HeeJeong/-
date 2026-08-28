# ============================================================
# 의약품 사용상주의사항 - 쉬운 용어 변환기
# 식품의약품안전처 고시 제2025-31호 [별표1] 기반
#
# [사용법]
# 1. CSV_PATH 에 별표1_쉬운용어목록_802개.csv 경로를 입력하세요.
# 2. 변환할 텍스트를 INPUT_TEXT 에 붙여 넣으세요.
# 3. VS Code 터미널에서: python easy_term_converter.py
# ============================================================

import csv
import re

# ────────────────────────────────────────────
# ★ 설정 영역 (여기만 수정하세요)
# ────────────────────────────────────────────

CSV_PATH = "별표1_쉬운용어목록_802개.csv"   # CSV 파일 경로

INPUT_TEXT = """
여기에 사용상주의사항 원문을 붙여 넣으세요.
예시: 이 약을 투여하지 말 것. 췌장염 환자, 부신기능 저하 환자에게 주의.
직사광선을 피하고 서늘한 곳에 보관할 것.
우발적으로 과량복용 한 경우 즉시 의사와 상담할 것.
"""

# ────────────────────────────────────────────
# 핵심 규칙 1: 변환 금지 복합어 패턴
# (이 안에 포함된 현행 용어는 변환하지 않음)
# ────────────────────────────────────────────

EXCLUDE_PATTERNS = [
    # 문법 형태소: '하지', '피하', '발적' 등이 문장 성분으로 쓰이는 경우
    r"투여하지\s*(않|말|못)",      # 투여하지 않다/말다/못하다
    r"사용하지\s*(않|말|못)",
    r"복용하지\s*(않|말|못)",
    r"피하고",                      # 피하고 → "피하(避)" 동사
    r"피하여",
    r"피해야",
    r"피한다",
    r"우발적",                      # 우발적(偶發的) 안의 '발적' 오매칭 방지
    r"두부신경",                    # 두부신경 안의 '부신' 오매칭 방지
    r"하지\s*말\s*것",             # "하지 말 것"
    r"하지\s*않",
]

# ────────────────────────────────────────────
# CSV 로드 및 용어 사전 구축
# ────────────────────────────────────────────

def load_terms(csv_path):
    """
    CSV에서 {현행용어: 쉬운용어} 딕셔너리 구축.
    - 슬래시(/) 또는 쉼표로 구분된 복수 현행 용어 모두 등록
    - 긴 용어를 먼저 처리(longest match 원칙)
    """
    term_map = {}
    with open(csv_path, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            raw_terms = row["현행 용어"].strip()
            easy = row["쉬운 용어"].strip()
            if not easy:
                continue
            # 슬래시 또는 쉼표 구분 복수 용어 처리
            for term in re.split(r"[/,]", raw_terms):
                term = term.strip()
                if term:
                    term_map[term] = easy
    # 긴 용어 우선 적용 (longest match)
    sorted_terms = dict(
        sorted(term_map.items(), key=lambda x: len(x[0]), reverse=True)
    )
    return sorted_terms


# ────────────────────────────────────────────
# 핵심 규칙 2: 안전한 단어 경계 매칭
# ────────────────────────────────────────────

def is_inside_exclude_pattern(text, start, end):
    """변환 위치가 금지 패턴 안에 포함되는지 확인"""
    for pattern in EXCLUDE_PATTERNS:
        for m in re.finditer(pattern, text):
            if m.start() <= start and end <= m.end():
                return True
    return False


def is_part_of_longer_word(text, start, end):
    """
    매칭된 용어가 더 긴 한국어 단어의 일부인지 확인.
    앞뒤 글자가 한글이면 복합어 내부로 판단 → 변환 금지.
    """
    # 앞 글자 확인
    if start > 0 and re.match(r"[가-힣]", text[start - 1]):
        return True
    # 뒤 글자 확인
    if end < len(text) and re.match(r"[가-힣]", text[end]):
        return True
    return False


def convert_terms(text, term_map):
    """
    텍스트에서 전문 용어를 찾아 쉬운 용어를 괄호 병기.
    규칙:
      1. Longest match 우선 (긴 용어부터 탐색)
      2. 복합어 내부 오매칭 방지 (앞뒤 한글 경계 확인)
      3. 금지 패턴 안의 용어는 변환 건너뜀
      4. 동일 위치 중복 변환 방지 (이미 처리된 구간 skip)
    """
    # 처리된 구간을 추적 (겹침 방지)
    processed = set()
    replacements = []  # (start, end, replacement) 목록

    for term, easy in term_map.items():
        pattern = re.escape(term)
        for m in re.finditer(pattern, text):
            s, e = m.start(), m.end()

            # 규칙 A: 이미 처리된 구간과 겹치면 skip
            if any(s < pe and e > ps for ps, pe in processed):
                continue

            # 규칙 B: 복합어 내부 오매칭 방지
            if is_part_of_longer_word(text, s, e):
                continue

            # 규칙 C: 금지 패턴 안이면 skip
            if is_inside_exclude_pattern(text, s, e):
                continue

            # 규칙 D: 쉬운 용어가 이미 동일하면 skip (자기 자신 치환 방지)
            if term == easy:
                continue

            replacements.append((s, e, f"{term}({easy})"))
            processed.add((s, e))

    # 뒤에서부터 치환 (인덱스 밀림 방지)
    replacements.sort(key=lambda x: x[0], reverse=True)
    result = list(text)
    for s, e, rep in replacements:
        result[s:e] = list(rep)

    return "".join(result)


# ────────────────────────────────────────────
# 실행
# ────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("  의약품 쉬운 용어 변환기 (식약처 고시 제2025-31호)")
    print("=" * 60)

    term_map = load_terms(CSV_PATH)
    print(f"✔ 용어 사전 로드 완료: {len(term_map)}개 용어\n")

    result = convert_terms(INPUT_TEXT, term_map)

    print("【변환 결과】")
    print("-" * 60)
    print(result)
    print("-" * 60)

    # 결과를 텍스트 파일로도 저장
    output_path = "변환결과.txt"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(result)
    print(f"\n✔ 결과 저장 완료 → {output_path}")
