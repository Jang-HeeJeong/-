/* ═══════════════════════════════════════════════════════════════════
   표준제조기준 판정 로직 (rules)

   ★ 배합 규칙이 개정되면 이 파일을 고칩니다.
     성분·분량 데이터는 app/표제기_데이터.js에 있습니다.

   이 파일은 화면(DOM)을 전혀 건드리지 않습니다.
   순수 계산만 하므로 UI를 어떤 방식으로 다시 만들어도 그대로 재사용됩니다.
   고치면 tests.html을 열어 49건이 통과하는지 확인하세요.

   구성
     1) 규칙 상수 — 연령 구분, 특수 성분 제한, 염 환산계수 등
     2) 파싱·조회 보조 함수
     3) 장별 검증 함수 validateChapter1/2/3/7/9
   ═══════════════════════════════════════════════════════════════════ */

/* 표준제조기준 데이터 (app/표제기_데이터.js에서 읽어 loadData가 채운다) */
let DB = null;
let chaptersMap = {};

/* ══════════ 1) 규칙 상수 ══════════ */

const CHAPTER_ORDER = [
  '제1장_비타민미네랄',
  '제2장_해열진통제',
  '제3장_감기약',
  '제7장_진해거담제',
  '제9장_비염용경구제',
];

const MAIN_INGR = {
  '제2장_해열진통제': new Set([
    '아세트아미노펜','이부프로펜','카페인수화물','파마브롬',
    '비타민B1 및 그 유도체와 염류','비타민B2 및 그 유도체와 염류','비타민C 및 그 유도체와 염류',
    '규산마그네슘','메타규산알루민산마그네슘','산화마그네슘',
    '수산화알루미늄겔(건조수산화알루미늄겔로서)','작약','감초'
  ]),
  '제3장_감기약': new Set([
    '아세트아미노펜','이부프로펜',
    '클로르페니라민말레산염','트리프롤리딘염산염수화물','디펜히드라민염산염',
    '브롬페니라민말레산염','독실아민숙신산염','디펜히드라민탄닌산염',
    '구연산티페피딘','덱스트로메토르판브롬화수소산염수화물',
    '클로페라스틴염산염','dl-메틸에페드린염산염','노스카핀','슈도에페드린염산염',
    '구아이페네신','브롬헥신염산염','L-카르보시스테인','벨라돈나총알칼로이드',
    '카페인무수물','카페인수화물',
    '비타민B1 및 그 유도체와 염류','비타민B2 및 그 유도체와 염류','비타민C 및 그 유도체와 염류'
  ]),
  '제7장_진해거담제': new Set([
    '구연산티페피딘','덱스트로메토르판브롬화수소산염수화물','클로페라스틴염산염',
    '티페피딘히벤즈산염','△dl-메틸에페드린염산염','염산트리메토퀴놀',
    '△노스카핀','노스카핀염산염수화물',
    '△구아야콜설폰산칼륨','△구아이페네신','L-멘톨',
    'd-클로르페니라민말레산염','클로르페니라민말레산염','카르비녹사민말레산염',
    '트리프롤리딘염산염수화물','디펜히드라민염산염',
    '카페인무수물','카페인수화물'
  ]),
  '제9장_비염용경구제': new Set([
    '디펜히드라민염산염','트리프롤리딘염산염수화물','카르비녹사민말레산염',
    '클로르페니라민말레산염','d-클로르페니라민말레산염','메퀴타진',
    '페닐레프린염산염','dl-메틸에페드린염산염','슈도에페드린염산염',
    '벨라돈나(총)알카로이드','벨라돈나엑스','스코폴리아엑스',
    '글리시리진산 및 그 염류','감초(분말)','카페인무수물'
  ])
};

const SPECIAL_INGR_AGE_RULES = [
  // blocked: true = 해당 연령 미만 완전 사용 불가
  { match: '아미노에틸설폰산', minMonths: 180, ageKey: '만15세이상', blocked: true,
    note: '아미노에틸설폰산(타우린): 만 15세 미만 사용 불가' },
  // blocked: false = 사용은 가능하나 한도 다름
  { match: 'L-시스테인',               minMonths: 180, ageKey: '만15세이상', blocked: false,
    note: 'L-시스테인: 만 15세 이상 최대 160mg (미만: 120mg)' },
  { match: '폴산',                     minMonths: 228, ageKey: '만19세이상', blocked: false,
    note: '폴산: 만 19세 이상 최대 1,000μg (미만: 500μg)' },
  { match: '우르소데옥시콜산',          minMonths: 228, ageKey: '만19세이상', blocked: false,
    note: '우르소데옥시콜산: 만 19세 이상 최대 60mg (미만: 30mg)' },
  { match: '콘드로이틴설페이트나트륨',  minMonths: 228, ageKey: '만19세이상', blocked: false,
    note: '콘드로이틴설페이트나트륨: 만 19세 이상 최대 800mg (미만: 600mg)' },
];

const DYNAMIC_AGE_DISPLAY    = { '만15세이상': '만 15세 이상 (성인)', '만19세이상': '만 19세 이상 (성인)' };

const DYNAMIC_AGE_MIN_MONTHS = { '만15세이상': 180, '만19세이상': 228 };

const MINERAL_COL_DISPLAY = {
  '만6세이상_만12세미만':    '만 6세~12세',
  '만36개월이상_만6세미만':  '만 36개월~6세',
  '만12개월이상_만36개월미만':'만 12~36개월',
};

const MG_SALT_FACTORS = {
  '산화마그네슘':           0.6030,   // MgO  (MW 40.30)
  '글리세로인산마그네슘':   0.1250,   // C₃H₇MgO₆P  (MW 194.38)
  '시트르산마그네슘':       0.1617,   // Mg₃(C₆H₅O₇)₂  (MW 451.11)
  '아스파르트산마그네슘':   0.0994,   // Mg aspartate  (MW 243.5)
  // '직접입력'은 factor 없이 MgAs 값을 직접 사용
};

const ELEVATED_AGE_THRESHOLD = {
  '폴산':                   228,   // 만 19세 이상
  '우르소데옥시콜산':         228,
  '콘드로이틴설페이트나트륨': 228,
  'L-시스테인':              180,   // 만 15세 이상
  'L-시스테인염산염수화물':   180,
};

const AGE_REMAP_CHAPTERS = new Set(['제2장_해열진통제', '제3장_감기약', '제9장_비염용경구제']);

const AGE_LABEL_7_11     = '만 7세 이상 - 만 11세 미만';

const AGE_LABEL_8_11     = '만 8세 이상 - 만 11세 미만';

const ADULT_AGE_GROUPS = new Set([
  '만12세이상(성인)', '만 8세 이상',
  '만8세이상_만12세미만',   // 7단계 통합 연령
]);

const CH1_UNIFIED_AGE_GROUPS = [
  '만12세이상(성인)',
  '만8세이상_만12세미만',
  '만6세이상_만8세미만',
  '만36개월이상_만6세미만',
  '만24개월이상_만36개월미만',
  '만12개월이상_만24개월미만',
  '만3개월이상_만12개월미만',
];

const CH1_MINERAL_AGE_NOTE = '(구리, 요오드, 마그네슘, 셀레늄, 아연 함유 시)';

const CH1_AGE_DISPLAY = {
  '만12세이상(성인)':          '만 12세 이상 (성인)',
  '만8세이상_만12세미만':       `만 8세 이상~만 12세 미만  ${CH1_MINERAL_AGE_NOTE}`,
  '만6세이상_만8세미만':        `만 6세 이상~만 8세 미만  ${CH1_MINERAL_AGE_NOTE}`,
  '만36개월이상_만6세미만':     `만 36개월 이상~만 6세 미만  ${CH1_MINERAL_AGE_NOTE}`,
  '만24개월이상_만36개월미만':  `만 24개월 이상~만 36개월 미만  ${CH1_MINERAL_AGE_NOTE}`,
  '만12개월이상_만24개월미만':  '만 12개월 이상~만 24개월 미만',
  '만3개월이상_만12개월미만':   '만 3개월 이상~만 12개월 미만',
};

const CH1_AGE_TO_VIT_ROW = {
  '만12세이상(성인)':          '만 8세 이상',
  '만8세이상_만12세미만':       '만 8세 이상',
  '만6세이상_만8세미만':        '만 24개월 이상 ~ 만 8세 미만',
  '만36개월이상_만6세미만':     '만 24개월 이상 ~ 만 8세 미만',
  '만24개월이상_만36개월미만':  '만 24개월 이상 ~ 만 8세 미만',
  '만12개월이상_만24개월미만':  '만 12개월 이상 ~ 만 24개월 미만',
  '만3개월이상_만12개월미만':   '만 3개월 이상 ~ 만 12개월 미만',
};

const CH1_AGE_TO_MINERAL_COL = {
  '만12세이상(성인)':          null,
  '만8세이상_만12세미만':       '만6세이상_만12세미만',
  '만6세이상_만8세미만':        '만6세이상_만12세미만',
  '만36개월이상_만6세미만':     '만36개월이상_만6세미만',
  '만24개월이상_만36개월미만':  '만12개월이상_만36개월미만',
  '만12개월이상_만24개월미만':  '만12개월이상_만36개월미만',
  '만3개월이상_만12개월미만':   '만12개월이상_만36개월미만',
};

const CH1_AGE_MIN_MONTHS = {
  '만12세이상(성인)':          144,
  '만8세이상_만12세미만':       96,
  '만6세이상_만8세미만':        72,
  '만36개월이상_만6세미만':     36,
  '만24개월이상_만36개월미만':  24,
  '만12개월이상_만24개월미만':  12,
  '만3개월이상_만12개월미만':   3,
};

const MINERAL_AGE_COL_MAP = {
  // 구형 호환성 유지 (다른 장에서 참조할 경우 대비)
  '만 8세 이상':                      '만6세이상_만12세미만',
  '만 24개월 이상 ~ 만 8세 미만':      '만36개월이상_만6세미만',
  '만 12개월 이상 ~ 만 24개월 미만':   '만12개월이상_만36개월미만',
  '만 3개월 이상 ~ 만 12개월 미만':    '만12개월이상_만36개월미만',
};

const MINERAL_UNDER8_BANNED = ['염소', '크롬', '망간', '몰리브덴', '칼륨', '나트륨', '황'];

const UNIT_TO_MCG = { 'μg': 1, 'mg': 1000, 'g': 1000000 };

const ASPIRIN_INGR = ['아스피린', '아스피린알루미늄', '살리실산나트륨', '히드로탈시트'];

/* ══════════ 2) 파싱·조회 보조 ══════════ */

function buildChaptersMap(db) {
  const map = {};
  for (const key of CHAPTER_ORDER) {
    const ch = db[key];
    if (!ch) continue;
    map[key] = {
      key,
      chapterNo:        ch['장번호'],
      label:            ch['장제목'],
      dosageForms:      parseDosageForms(ch['기준']?.['제형'] ?? ''),
      ageGroups:        parseAgeGroups(ch, key),
      ingredientGroups: parseIngredientGroups(key, ch),
    };
  }
  return map;
}

function parseDosageForms(str) {
  const main = str.split(/\.\s*다만/)[0];
  const result = [];
  for (const seg of outerSplit(main, ',')) {
    for (const part of outerSplitAnd(seg)) {
      const t = part.trim();
      if (t) result.push(t);
    }
  }
  return result;
}

function outerSplit(str, delim) {
  const result = [];
  let depth = 0, buf = '';
  for (const ch of str) {
    if      (ch === '(') { depth++; buf += ch; }
    else if (ch === ')') { depth--; buf += ch; }
    else if (ch === delim && depth === 0) { result.push(buf); buf = ''; }
    else                 { buf += ch; }
  }
  result.push(buf);
  return result;
}

function outerSplitAnd(str) {
  const DELIM = ' 및 ';
  const result = [];
  let depth = 0, buf = '', i = 0;
  while (i < str.length) {
    const ch = str[i];
    if      (ch === '(') { depth++; buf += ch; i++; }
    else if (ch === ')') { depth--; buf += ch; i++; }
    else if (depth === 0 && str.startsWith(DELIM, i)) {
      result.push(buf); buf = '';
      i += DELIM.length;
    } else {
      buf += ch; i++;
    }
  }
  result.push(buf);
  return result;
}

function parseAgeGroups(ch, chapterKey) {
  // 제1장: 비타민·미네랄 기준점을 모두 반영한 7단계 통합 목록 사용
  if (chapterKey === '제1장_비타민미네랄') return CH1_UNIFIED_AGE_GROUPS;
  const tables = ch['표'] ?? {};
  const key = Object.keys(tables).find(k => k.includes('연령구분계수'));
  if (!key) return [];
  const tbl = tables[key];
  if (tbl['비타민']) return tbl['비타민'].map(r => r['연령구분']);
  if (Array.isArray(tbl)) return tbl.map(r => r['연령구분']);
  return [];
}

function parseIngredientGroups(chapterKey, ch) {
  const groups  = [];
  const tables  = ch['표'] ?? {};

  if (chapterKey === '제1장_비타민미네랄') {

    // 표1_비타민: 항목별로 성분명 리스트 합산 (구분 sub-row 존재)
    const vitMap = new Map();
    for (const item of tables['표1_비타민'] ?? []) {
      const key = item['항목'];
      if (!vitMap.has(key)) vitMap.set(key, []);
      const names = Array.isArray(item['성분명']) ? item['성분명'] : [item['성분명']];
      vitMap.get(key).push(...names);
    }
    for (const [항목, names] of vitMap) {
      const displayLabel = names.length === 1 ? `${항목} (${names[0]})` : 항목;
      groups.push({ label: 항목, displayLabel, tableLabel: '비타민', ingredients: names });
    }

    // 표2_미네랄: 항목마다 미네랄 1종 (성분명 = "칼슘으로서" 형태)
    for (const item of tables['표2_미네랄'] ?? []) {
      groups.push({
        label:        `${item['항목']}(${item['성분']})`,
        displayLabel: `${item['항목']} (${item['성분']})`,
        tableLabel:   '미네랄',
        ingredients:  [item['성분명']],
      });
    }

    // 표3_기타성분: 항목별 성분명 리스트
    const etcMap = new Map();
    for (const item of tables['표3_기타성분'] ?? []) {
      const key = item['항목'];
      if (!etcMap.has(key)) etcMap.set(key, []);
      const names = Array.isArray(item['성분명']) ? item['성분명'] : [item['성분명']];
      etcMap.get(key).push(...names);
    }
    for (const [항목, names] of etcMap) {
      const displayLabel = names.length === 1 ? `${항목} (${names[0]})` : 항목;
      groups.push({ label: 항목, displayLabel, tableLabel: '기타성분', ingredients: names });
    }

    // 표4_생약: 항목별 성분명 리스트
    const herbMap = new Map();
    for (const item of tables['표4_생약'] ?? []) {
      const key = item['항목'];
      if (!herbMap.has(key)) herbMap.set(key, []);
      const names = Array.isArray(item['성분명']) ? item['성분명'] : [item['성분명']];
      herbMap.get(key).push(...names);
    }
    for (const [항목, names] of herbMap) {
      const displayLabel = names.length === 1 ? `${항목} (${names[0]})` : 항목;
      groups.push({ label: 항목, displayLabel, tableLabel: '생약', ingredients: names });
    }

  } else {
    // 2~9장: 표1_유효성분
    const compKey = Object.keys(tables).find(k => k.includes('유효성분'));
    if (compKey) {
      const byGubun = new Map();
      for (const item of tables[compKey]) {
        const g = item['구분'];
        if (!byGubun.has(g)) byGubun.set(g, []);
        byGubun.get(g).push(item['성분명']);
      }
      for (const [구분, names] of byGubun) {
        const displayLabel = names.length === 1 ? `${구분} (${names[0]})` : 구분;
        groups.push({ label: 구분, displayLabel, tableLabel: '유효성분', ingredients: names });
      }
    }

    // 생약 테이블 (표1_생약, 표2_생약, 표1_생약_및_한약처방 등)
    const herbKey = Object.keys(tables).find(k => k.includes('생약') && !k.includes('유효성분'));
    if (herbKey) {
      const byGubun = new Map();
      for (const item of tables[herbKey]) {
        const g = item['구분'];
        if (!byGubun.has(g)) byGubun.set(g, []);
        byGubun.get(g).push(item['성분명']);
      }
      for (const [구분, names] of byGubun) {
        const displayLabel = names.length === 1 ? `${구분} (${names[0]})` : 구분;
        groups.push({ label: 구분, displayLabel, tableLabel: '생약', ingredients: names });
      }
    }
  }

  return groups;
}

function parseAmountStr(str, ingrName, allIngrNames) {
  if (!str || str === '-') return null;
  const cleaned = str.replace(/\([^)]*\)/g, '').replace(/,/g, '').trim();
  const m = cleaned.match(/^([\d.]+(?:\/[\d.]+)*)\s*(IU|mg|μg|g)$/);
  if (!m) return null;
  const numPart = m[1], unit = m[2];
  if (numPart.includes('/')) {
    const parts = numPart.split('/');
    if (parts.length > 2) {
      const idx = allIngrNames ? allIngrNames.indexOf(ingrName) : -1;
      return { value: parseFloat(idx >= 0 ? parts[idx] : parts[0]), unit };
    }
    return { value: parseFloat(parts[0]) / parseFloat(parts[1]), unit };
  }
  return { value: parseFloat(numPart), unit };
}

function parseElevatedValue(str, ingrName, allIngrNames) {
  if (!str || str === '-') return null;
  const pm = str.match(/\(([^)]+)\)/);
  if (!pm) return null;
  const inner = pm[1].replace(/,/g, '').trim();
  const mv = inner.match(/^([\d.]+(?:\/[\d.]+)*)\s*(IU|mg|μg|g)?$/);
  if (!mv) return null;
  const numPart = mv[1];
  // 단위는 괄호 밖 기본 파싱에서 가져옴
  const baseUnit = parseAmountStr(str, ingrName, allIngrNames)?.unit;
  const unit = mv[2] ?? baseUnit;
  if (numPart.includes('/')) {
    const parts = numPart.split('/');
    const idx = allIngrNames ? allIngrNames.indexOf(ingrName) : -1;
    return { value: parseFloat(idx >= 0 ? parts[idx] : parts[0]), unit };
  }
  return { value: parseFloat(numPart), unit };
}

function parseFraction(s) {
  if (!s) return null;
  const m = s.match(/^(\d+)\/(\d+)$/);
  if (m) return parseFloat(m[1]) / parseFloat(m[2]);
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parseCoeffStr(str) {
  if (!str || str === '-') return null;
  const m = str.match(/^([^(]+?)(?:\(([^)]+)\))?$/);
  if (!m) return null;
  const base = parseFraction(m[1].trim());
  const vitAD = m[2] ? parseFraction(m[2].trim()) : base;
  return base !== null ? { base, vitAD } : null;
}

function formToCoeffCol(form) {
  if (!form) return '기타';
  if (form.includes('추어블정')) return '추어블정';
  if (/정제|캅셀|환제/.test(form)) return '정캅셀환제';
  return '기타';
}

function isUnder8Age(ageGroup) {
  return !!ageGroup && !ADULT_AGE_GROUPS.has(ageGroup);
}

function hasVitAorD(rows) {
  return rows.some(r => r.gubun && (r.gubun.includes('비타민A') || r.gubun.includes('비타민D')));
}

function getVitaminCoeff(table5Vit, ageGroup, formCol, vitAD) {
  const lookupAge = CH1_AGE_TO_VIT_ROW[ageGroup] ?? ageGroup;
  const ageRow = (table5Vit ?? []).find(r => r['연령구분'] === lookupAge);
  if (!ageRow) return 1;
  const parsed = parseCoeffStr(ageRow[formCol]);
  if (!parsed) return null;
  return vitAD ? parsed.vitAD : parsed.base;
}

function getMineralAgeCol(ageGroup) {
  // 신규 7단계 통합 연령 우선 조회
  if (ageGroup in CH1_AGE_TO_MINERAL_COL) return CH1_AGE_TO_MINERAL_COL[ageGroup];
  return MINERAL_AGE_COL_MAP[ageGroup] ?? null;
}

function nameMatches(field, ingrName) {
  const arr = Array.isArray(field) ? field : [field];
  return arr.includes(ingrName);
}

function findVitaminRow(table1, ingrName) {
  return (table1 ?? []).find(r => nameMatches(r['성분명'], ingrName)) ?? null;
}

function findMineralRow(table2, ingrName) {
  return (table2 ?? []).find(r => nameMatches(r['성분명'], ingrName)) ?? null;
}

function findTable3Row(table3, ingrName) {
  for (const item of table3 ?? []) {
    const names = Array.isArray(item['성분명']) ? item['성분명'] : [item['성분명']];
    const idx = names.indexOf(ingrName);
    if (idx >= 0) return { item, idx };
  }
  return null;
}

function findTable4Row(table4, ingrName) {
  for (const item of table4 ?? []) {
    const names = Array.isArray(item['성분명']) ? item['성분명'] : [item['성분명']];
    const idx = names.indexOf(ingrName);
    if (idx >= 0) return { item, idx };
  }
  return null;
}

function convertToUnit(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return { value, note: '' };
  const f = UNIT_TO_MCG[fromUnit], t = UNIT_TO_MCG[toUnit];
  if (!f || !t) return null; // IU 포함 → 환산 불가
  const converted = +(value * f / t).toFixed(6);
  return { value: converted, note: `자동환산: ${value} ${fromUnit} → ${converted} ${toUnit}` };
}

function fractionStr(n) {
  const MAP = [[0.5,'1/2'],[0.25,'1/4'],[1/6,'1/6'],[2/3,'2/3'],[1/3,'1/3'],[1,'1']];
  for (const [v, s] of MAP) if (Math.abs(n - v) < 0.001) return s;
  return n.toFixed(3).replace(/\.?0+$/, '');
}

function checkVitamin(row, vitRow, coeff, dosage, ageMinMonths = 999) {
  const allNames = Array.isArray(vitRow['성분명']) ? vitRow['성분명'] : [vitRow['성분명']];
  const minAmt   = parseAmountStr(vitRow['1일최소분량'], row.ingr, allNames);
  const maxAmt   = parseAmountStr(vitRow['1일최대분량'], row.ingr, allNames);
  const elevAmt  = parseElevatedValue(vitRow['1일최대분량'], row.ingr, allNames);
  const refUnit  = maxAmt?.unit ?? minAmt?.unit;
  const base     = { ingr: row.ingr, gubun: row.gubun };

  if (coeff === null)
    return { ...base, ok: false, reason: '해당 연령/제형 조합 사용 불가 (표5)' };

  let rawDose = parseFloat(row.dose);
  let convNote = '';
  if (refUnit && row.unit !== refUnit) {
    const cv = convertToUnit(rawDose, row.unit, refUnit);
    if (!cv) return { ...base, ok: false, reason: `단위 환산 불가 (IU는 다른 단위로 환산 불가)` };
    rawDose = cv.value; convNote = ' (자동환산)';
  }
  const useUnit = refUnit ?? row.unit;

  const { freqMin, freqMax, amtMin, amtMax, unit: dosageUnit } = dosage;
  const dailyMin = +(rawDose * amtMin * freqMin).toFixed(6);
  const dailyMax = +(rawDose * amtMax * freqMax).toFixed(6);

  let critMin = minAmt?.value ?? null;
  let critMax = maxAmt?.value ?? null;
  let ageNote = '';

  // elevated limit 적용 여부
  const elevThresh = ELEVATED_AGE_THRESHOLD[row.ingr] ?? null;
  const useElevated = elevAmt && elevThresh && ageMinMonths >= elevThresh;
  if (useElevated) {
    critMax = elevAmt.value;
    ageNote += ` (만 ${Math.round(elevThresh/12)}세 이상 기준)`;
  }

  if (coeff !== 1) {
    if (critMin != null) critMin = +(critMin * coeff).toFixed(4);
    if (critMax != null) critMax = +(critMax * coeff).toFixed(4);
    ageNote += ` (×${fractionStr(coeff)})`;
  }

  const issues = [];
  if (critMin != null && dailyMin < critMin)
    issues.push(`1일 최소 미달: ${dailyMin} < ${critMin} ${useUnit}${ageNote}`);
  if (critMax != null && dailyMax > critMax)
    issues.push(`1일 최대 초과: ${dailyMax} > ${critMax} ${useUnit}${ageNote}`);

  // elevated hint: 현재 연령 기준으로 한도 초과 + elevated limit 존재 시 항상 표시
  let elevHint = null;
  if (issues.length > 0 && elevAmt && elevThresh && !useElevated) {
    elevHint = { max: elevAmt.value, unit: useUnit, threshMonths: elevThresh };
  }

  return { ...base, ok: issues.length === 0,
           perUnit: `${row.dose} ${row.unit}`, dosageUnit, convNote,
           dailyMin, dailyMax, critMin, critMax, useUnit, ageNote, elevHint,
           reason: issues.length === 0 ? '적합' : issues.join('; ') };
}

function checkMineral(row, minRow, table5Min, ageGroup, under8, dosage) {
  const mineralName = minRow['성분'];
  const base = { ingr: row.ingr, gubun: row.gubun };

  if (under8 && MINERAL_UNDER8_BANNED.some(b => mineralName.includes(b)))
    return { ...base, ok: false, reason: `만 8세 미만 배합 금지 미네랄 (${mineralName})` };

  const maxAmt = parseAmountStr(minRow['1일최대분량']);
  const refUnit = maxAmt?.unit ?? row.unit;

  let rawDose = parseFloat(row.dose);
  let convNote = '';
  if (row.unit !== refUnit) {
    const cv = convertToUnit(rawDose, row.unit, refUnit);
    if (!cv) return { ...base, ok: false, reason: `단위 환산 불가` };
    rawDose = cv.value; convNote = ' (자동환산)';
  }

  const { freqMin, freqMax, amtMin, amtMax, unit: dosageUnit } = dosage;
  const dailyMin = +(rawDose * amtMin * freqMin).toFixed(6);
  const dailyMax = +(rawDose * amtMax * freqMax).toFixed(6);

  // 기준 최대 (연령별 적용)
  let critMax = maxAmt?.value ?? null;
  let ageNote = '';
  const ageCol = getMineralAgeCol(ageGroup);
  if (ageCol) {
    const t5row = (table5Min['데이터'] ?? []).find(r2 =>
      r2['성분'].split(/,\s*/).some(p => p.trim() === mineralName)
    );
    if (t5row) {
      const val = t5row[ageCol];
      if (val && val !== '성인용량과 동일') { critMax = parseFloat(val); ageNote = ' (연령별)'; }
    }
  }
  // 미네랄은 최소 기준 없음 → 기준최대의 1/2 (미네랄은 최소 없으므로 null 유지)
  const critMin = null;

  const issues = [];
  if (critMax != null && dailyMax > critMax)
    issues.push(`1일 최대 초과: ${dailyMax} > ${critMax} ${refUnit}${ageNote}`);

  return { ...base, ok: issues.length === 0,
           perUnit: `${row.dose} ${row.unit}`, dosageUnit, convNote,
           dailyMin, dailyMax, critMin, critMax, useUnit: refUnit, ageNote,
           reason: issues.length === 0 ? '적합' : issues.join('; ') };
}

function checkTable3Ingr(row, item, idx, dosage, ageMinMonths = 999) {
  const maxArr  = item['1일최대분량'];
  const maxStr  = Array.isArray(maxArr) ? maxArr[idx] : maxArr;
  const maxAmt  = parseAmountStr(maxStr);
  const elevAmt = parseElevatedValue(maxStr ?? '');
  const base    = { ingr: row.ingr, gubun: row.gubun };
  const refUnit = maxAmt?.unit ?? row.unit;

  let rawDose = parseFloat(row.dose);
  let convNote = '';
  if (row.unit !== refUnit) {
    const cv = convertToUnit(rawDose, row.unit, refUnit);
    if (!cv) return { ...base, ok: false, reason: '단위 환산 불가' };
    rawDose = cv.value; convNote = ' (자동환산)';
  }

  const { freqMin, freqMax, amtMin, amtMax, unit: dosageUnit } = dosage;
  const dailyMin = +(rawDose * amtMin * freqMin).toFixed(6);
  const dailyMax = +(rawDose * amtMax * freqMax).toFixed(6);

  const elevThresh  = ELEVATED_AGE_THRESHOLD[row.ingr] ?? null;
  const useElevated = elevAmt && elevThresh && ageMinMonths >= elevThresh;
  let critMax = useElevated ? elevAmt.value : (maxAmt?.value ?? null);
  let ageNote = useElevated ? ` (만 ${Math.round(elevThresh/12)}세 이상 기준)` : '';

  const issues = [];
  if (critMax != null && dailyMax > critMax)
    issues.push(`1일 최대 초과: ${dailyMax} > ${critMax} ${refUnit}${ageNote}`);

  let elevHint = null;
  if (issues.length > 0 && elevAmt && elevThresh && !useElevated) {
    elevHint = { max: elevAmt.value, unit: refUnit, threshMonths: elevThresh };
  }

  return { ...base, ok: issues.length === 0,
           perUnit: `${row.dose} ${row.unit}`, dosageUnit, convNote,
           dailyMin, dailyMax, critMin: null, critMax, useUnit: refUnit, ageNote, elevHint,
           reason: issues.length === 0 ? '적합' : issues.join('; ') };
}

function checkTable4Ingr(row, item, idx, dosage) {
  const maxArr = item['1일최대분량_원생약']; // 원생약 기준
  const maxStr = Array.isArray(maxArr) ? maxArr[idx] : maxArr;
  const maxAmt = maxStr && maxStr !== '-' ? parseAmountStr(maxStr) : null;
  const base   = { ingr: row.ingr, gubun: row.gubun };
  const refUnit = maxAmt?.unit ?? row.unit;

  let rawDose = parseFloat(row.dose);
  let convNote = '';
  if (row.unit !== refUnit) {
    const cv = convertToUnit(rawDose, row.unit, refUnit);
    if (!cv) return { ...base, ok: false, reason: '단위 환산 불가' };
    rawDose = cv.value; convNote = ' (자동환산)';
  }

  const { freqMin, freqMax, amtMin, amtMax, unit: dosageUnit } = dosage;
  const dailyMin = +(rawDose * amtMin * freqMin).toFixed(6);
  const dailyMax = +(rawDose * amtMax * freqMax).toFixed(6);
  const critMax  = maxAmt?.value ?? null;
  const critMin  = null; // 생약 최소 기준 없음

  const issues = [];
  if (critMax != null && dailyMax > critMax)
    issues.push(`1일 최대 초과: ${dailyMax} > ${critMax} ${refUnit}`);

  return { ...base, ok: issues.length === 0,
           perUnit: `${row.dose} ${row.unit}`, dosageUnit, convNote,
           dailyMin, dailyMax, critMin, critMax, useUnit: refUnit, ageNote: '',
           reason: issues.length === 0 ? '적합' : issues.join('; ') };
}

function checkItemSums(rows, table1, table2, coeff, dosage) {
  const { freqMax, amtMax } = dosage;
  const itemMap = new Map();
  for (const row of rows) {
    if (!row.ingr || !row.dose) continue;
    const vitRow = findVitaminRow(table1, row.ingr);
    const minRow = findMineralRow(table2, row.ingr);
    const key = vitRow ? vitRow['항목'] : (minRow ? `_M_${minRow['항목']}` : null);
    if (!key) continue;
    if (!itemMap.has(key)) itemMap.set(key, []);
    itemMap.get(key).push({ row, vitRow, minRow });
  }

  const results = [];
  for (const [key, entries] of itemMap) {
    if (entries.length < 2) continue;
    // 기준 단위 결정 (첫 번째 참조행 기준)
    const { vitRow: rv0, minRow: rm0 } = entries[0];
    const refAmtObj = rv0 ? parseAmountStr(rv0['1일최대분량']) : (rm0 ? parseAmountStr(rm0['1일최대분량']) : null);
    const refUnit = refAmtObj?.unit;
    if (!refUnit) continue;

    // 각 행 1일 배합량 환산 후 합산
    let totalDaily = 0;
    let convErr = false;
    for (const { row } of entries) {
      let v = parseFloat(row.dose || 0);
      if (row.unit !== refUnit) {
        const cv = convertToUnit(v, row.unit, refUnit);
        if (!cv) { convErr = true; break; }
        v = cv.value;
      }
      totalDaily += v * amtMax * freqMax;
    }
    if (convErr) {
      results.push({ key, ok: null, ingredients: entries.map(e => e.row.ingr),
                     reason: '합산 불가 (단위 환산 불가)' });
      continue;
    }
    totalDaily = +totalDaily.toFixed(4);

    let maxAmt = refAmtObj;
    if (maxAmt && rv0 && coeff != null && coeff !== 1)
      maxAmt = { value: +(maxAmt.value * coeff).toFixed(4), unit: maxAmt.unit };
    if (!maxAmt) continue;

    const ok = totalDaily <= maxAmt.value;
    results.push({ key, ok, ingredients: entries.map(e => e.row.ingr),
                   reason: ok ? `합산 1일 ${totalDaily} ${refUnit} ≤ 최대 ${maxAmt.value} ${refUnit}`
                              : `합산 1일 ${totalDaily} ${refUnit} > 최대 ${maxAmt.value} ${refUnit} 초과` });
  }
  return results;
}

function getCh2Coeff(table3, ageGroup) {
  const row = (table3 ?? []).find(r => r['연령구분'] === ageGroup);
  if (!row) return 1;
  return parseFraction(row['계수']);
}

function findCh2Row(table1, ingrName) {
  return (table1 ?? []).find(r => r['성분명'] === ingrName) ?? null;
}

function parseMinBigo(bigo) {
  if (!bigo) return null;
  const m = String(bigo).match(/배합최소량\s+([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
}

function isAspirinType(ingrName) {
  return ASPIRIN_INGR.some(a => ingrName === a);
}

function getCoeffFromTable(coeffTbl, ageGroup) {
  const row = (coeffTbl ?? []).find(r => r['연령구분'] === ageGroup);
  if (!row) return 1;
  return parseFraction(row['계수']) ?? 1;
}

function toGram(value, unit) {
  if (unit === 'g')  return value;
  if (unit === 'mg') return value / 1000;
  if (unit === 'μg') return value / 1e6;
  return null;
}

function parseCh9CoeffStr(s) {
  if (!s) return null;
  s = s.replace(/\*/g,'').trim();
  const m = s.match(/^([0-9/]+)\s*≧\s*≧\s*([0-9/]+)$/);
  if (m) return { max:parseFraction(m[1].trim()), min:parseFraction(m[2].trim()) };
  const m2 = s.match(/^([0-9/]+)\s*≧$/);
  if (m2) return { max:parseFraction(m2[1].trim()), min:null };
  return null;
}

/* ══════════ 3) 장별 검증 ══════════ */

function validateChapter1(tables, form, ageGroup, rows, dosage) {
  const table1    = tables['표1_비타민'] ?? [];
  const table2    = tables['표2_미네랄'] ?? [];
  const table3    = tables['표3_기타성분'] ?? [];
  const table4    = tables['표4_생약'] ?? [];
  const table5    = tables['표5_연령구분계수'] ?? {};
  const table5Vit = table5['비타민'] ?? [];
  const table5Min = table5['미네랄'] ?? { 데이터: [] };
  const formCol   = formToCoeffCol(form);
  const under8    = isUnder8Age(ageGroup);
  const vitAD     = hasVitAorD(rows);
  const coeff        = under8 ? getVitaminCoeff(table5Vit, ageGroup, formCol, vitAD) : 1;
  const ageMinMonths = DYNAMIC_AGE_MIN_MONTHS[ageGroup] ?? CH1_AGE_MIN_MONTHS[ageGroup] ?? 999;

  const itemResults = rows.filter(r => r.ingr).map(row => {
    const vitRow = findVitaminRow(table1, row.ingr);
    if (vitRow) return checkVitamin(row, vitRow, coeff, dosage, ageMinMonths);
    const minRow = findMineralRow(table2, row.ingr);
    if (minRow) return checkMineral(row, minRow, table5Min, ageGroup, under8, dosage);
    const t3 = findTable3Row(table3, row.ingr);
    if (t3) return checkTable3Ingr(row, t3.item, t3.idx, dosage, ageMinMonths);
    const t4 = findTable4Row(table4, row.ingr);
    if (t4) return checkTable4Ingr(row, t4.item, t4.idx, dosage);
    return { ingr: row.ingr, gubun: row.gubun,
             ok: null, reason: '표1~표4에서 성분을 찾을 수 없음' };
  });

  const sumResults = checkItemSums(rows, table1, table2, coeff, dosage);
  return { itemResults, sumResults, coeff, under8, vitAD };
}

function validateChapter2(tables, form, ageGroup, rows, dosage) {
  const { amtMin = 1, amtMax = 1, freqMin = 1, freqMax = 1 } = dosage;
  const freq   = freqMax;
  const table1 = tables['표1_유효성분'] ?? [];
  const table2 = tables['표2_생약']    ?? [];
  // 버그5: 표3 연령구분계수는 5개 구간(만1세~만15세이상)을 배열로 보유.
  //        getCh2Coeff가 r['연령구분'] 정확 일치로 조회하므로 UI 드롭다운과 키가 같으면 정상.
  const table3 = tables['표3_연령구분계수'] ?? [];
  const coeff  = getCh2Coeff(table3, ageGroup);

  // 구분별 분류 (표1 기반)
  const byGubun = {};
  for (const row of rows) {
    if (!row.ingr) continue;
    const ref = findCh2Row(table1, row.ingr);
    if (!ref) continue;
    const g = ref['구분'];
    if (!byGubun[g]) byGubun[g] = [];
    byGubun[g].push({ row, ref });
  }
  const grup1 = byGubun['Ⅰ항'] ?? [];
  const grup2 = byGubun['Ⅱ항'] ?? [];
  const grup3 = byGubun['Ⅲ항'] ?? [];

  // ── 성분 선택 규칙 위반 ──
  const ruleErrors = [];
  // JSON 원문: "배합하지 않으면 안되는 유효성분은 Ⅰ항과 Ⅱ항 중 1종 이상"
  if (grup1.length === 0 && grup2.length === 0)
    ruleErrors.push({ key: '필수 성분 누락', ok: false, reason: 'Ⅰ항 또는 Ⅱ항 성분 중 1종 이상 필수' });
  // JSON 원문: "Ⅰ항의 유효성분은 3종까지 배합할 수 있다"
  if (grup1.length > 3)
    ruleErrors.push({ key: 'Ⅰ항 초과', ok: false, reason: `Ⅰ항 최대 3종 (현재 ${grup1.length}종)` });
  // JSON 원문: "Ⅲ항의 유효성분을 배합하는 경우는 Ⅲ항 중 1종만 배합한다"
  if (grup3.length > 1)
    ruleErrors.push({ key: 'Ⅲ항 초과', ok: false, reason: `Ⅲ항 1종만 배합 가능 (현재 ${grup3.length}종)` });
  // JSON 원문: "Ⅱ항의 성분인 이부프로펜은 Ⅰ항의 성분과 배합하지 않는다"
  if (grup2.length > 0 && grup1.length > 0)
    ruleErrors.push({ key: 'Ⅱ항+Ⅰ항 배합 금지', ok: false,
                      reason: '이부프로펜(Ⅱ항)은 Ⅰ항 성분과 배합 불가' });
  // 버그6: 히드로탈시트 추가
  // JSON 원문: "아스피린, 아스피린알루미늄, 살리실산나트륨이나 히드로탈시트를 함유하는
  //            제제는 만 15세 미만의 어린이를 대상으로 하는 용법은 인정되지 아니한다"
  const hasAspirin = rows.some(r => r.ingr && isAspirinType(r.ingr));
  if (hasAspirin && ageGroup !== '만 15세 이상')
    ruleErrors.push({ key: '아스피린계 연령', ok: false,
                      reason: '아스피린/아스피린알루미늄/살리실산나트륨/히드로탈시트는 만 15세 미만 사용 불가' });

  // JSON 원문: "Ⅰ항 1종 → 1회 하한 1회최대의 1/2 / Ⅰ항 2종이상 또는 Ⅲ항 포함 → 1회최대의 1/5"
  const grup1MinFrac = (grup1.length >= 2 || grup3.length >= 1) ? (1/5) : (1/2);

  // ── 개별 성분 분량 검증 ──
  const itemResults = rows.filter(r => r.ingr).map(row => {
    const dose1     = parseFloat(row.dose);
    const dose1dose = +(dose1 * amtMax).toFixed(4);   // 1회 투여 배합량
    const dose1d    = +(dose1dose * freq).toFixed(4); // 1일 배합량
    const amtTag    = amtMax > 1 ? ` ×${amtMax}${dosageUnit}` : '';

    // ── 표1 유효성분 ──
    const ref = findCh2Row(table1, row.ingr);
    if (ref) {
      const max1  = ref['1회최대분량_mg'];
      const max1d = ref['1일최대분량_mg'];
      const gubun = ref['구분'];
      const issues = [];

      // JSON 원문: "만 15세 미만의 어린이에 있어서 1회/1일 최대분량은 표1 × 표3 계수"
      const adjMax1  = max1  != null ? +(max1  * coeff).toFixed(4) : null;
      const adjMax1d = max1d != null ? +(max1d * coeff).toFixed(4) : null;

      if (adjMax1  != null && dose1dose > adjMax1)
        issues.push(`1회 최대 초과: ${dose1dose} > ${adjMax1} mg`);
      if (adjMax1d != null && dose1d > adjMax1d)
        issues.push(`1일 최대 초과: ${dose1d}(=${dose1dose}×${freq}) > ${adjMax1d} mg`);

      // JSON 원문: "Ⅰ항 1종 → 1회 하한 1/2, Ⅰ항 2종이상 또는 Ⅲ항 → 1/5"
      if (gubun === 'Ⅰ항' && adjMax1 != null) {
        const minFloor = +(adjMax1 * grup1MinFrac).toFixed(4);
        if (dose1dose < minFloor)
          issues.push(`1회 하한 미달: ${dose1dose} < ${minFloor} mg (최대의 ${fractionStr(grup1MinFrac)})`);
      }
      // 버그1 수정: Ⅱ항(이부프로펜) 1회 하한 규정 없음
      //   JSON 원문 유효성분의_분량에 Ⅱ항 하한 조건 명시 없음 → 체크 제거
      // JSON 원문: "Ⅲ항의 1회량의 하한은 1회 최대분량의 1/5"
      if (gubun === 'Ⅲ항' && adjMax1 != null) {
        const minFloor = +(adjMax1 / 5).toFixed(4);
        if (dose1dose < minFloor)
          issues.push(`1회 하한 미달: ${dose1dose} < ${minFloor} mg (최대의 1/5)`);
      }
      // 버그3: Ⅴ항은 1회최대분량_mg = null이므로 반드시 1일최대 기준으로만 하한 계산
      // JSON 원문: "Ⅴ항의 1회량의 하한은 1일 최대분량의 1/15"
      // 연령계수 적용 순서: (1일최대 × coeff) / 15 = adjMax1d / 15
      if (gubun === 'Ⅴ항' && adjMax1d != null) {
        const minFloor = +(adjMax1d / 15).toFixed(4);
        if (dose1dose < minFloor)
          issues.push(`1회 하한 미달: ${dose1dose} < ${minFloor} mg (1일 최대의 1/15)`);
      }
      // 버그2: Ⅳ항 1일 최소 배합량
      // JSON 원문 표1 비고: "배합최소량 N" → 1일 배합량(1회함량 × amtMax × freq) ≥ N mg
      if (gubun === 'Ⅳ항') {
        const minBigo = parseMinBigo(ref['비고']);
        if (minBigo != null && dose1d < minBigo)
          issues.push(`1일 배합 최소 미달: ${dose1d} < ${minBigo} mg`);
      }

      // 표제기 기준 (허용 범위)
      const min1dose_alw = gubun === 'Ⅰ항' && adjMax1  != null ? +(adjMax1  * grup1MinFrac).toFixed(4) :
                           gubun === 'Ⅲ항' && adjMax1  != null ? +(adjMax1  / 5).toFixed(4) :
                           gubun === 'Ⅴ항' && adjMax1d != null ? +(adjMax1d / 15).toFixed(4) : null;
      const min1d_alw = gubun === 'Ⅳ항' ? parseMinBigo(ref['비고']) : null;
      return {
        ingr: row.ingr, gubun: row.gubun,
        allowed: { min1dose: min1dose_alw, max1dose: adjMax1,  min1d: min1d_alw, max1d: adjMax1d },
        actual:  { min1dose: +(dose1 * amtMin).toFixed(4), max1dose: dose1dose,
                   min1d: +(dose1 * amtMin * freqMin).toFixed(4), max1d: dose1d },
        ok: issues.length === 0,
        reason: issues.length === 0 ? '적합' : issues.join('; '),
      };
    }

    // ── 버그4: 표2 생약 처리 ──
    // JSON 원문: "표2 Ⅰ란의 유효성분의 1일량의 하한은 1일 최대분량의 1/10"
    // 단위 주의: 표2는 g 단위 → mg으로 변환 (* 1000)
    // 성분명에 "엑스" 포함 시 엑스 기준, 그 외 분말 기준
    const herbRef = table2.find(r => r['성분명'] === row.ingr) ?? null;
    if (herbRef) {
      const issues  = [];
      const isExt   = row.ingr.includes('엑스');
      const max1d_g = isExt ? herbRef['1일최대분량_엑스_g'] : herbRef['1일최대분량_분말_g'];
      const max1d_mg = max1d_g != null ? +(max1d_g * 1000).toFixed(4) : null;
      const min1d_mg = max1d_mg != null ? +(max1d_mg / 10).toFixed(4) : null;

      if (max1d_mg != null && dose1d > max1d_mg)
        issues.push(`1일 최대 초과: ${dose1d} > ${max1d_mg} mg (표2 ${isExt ? '엑스' : '분말'} 기준)`);
      if (min1d_mg != null && dose1d < min1d_mg)
        issues.push(`1일 최소 미달: ${dose1d} < ${min1d_mg} mg (1일 최대의 1/10)`);

      return {
        ingr: row.ingr, gubun: '표2 Ⅰ항',
        allowed: { min1dose: null, max1dose: null, min1d: min1d_mg, max1d: max1d_mg },
        actual:  { min1dose: null, max1dose: null,
                   min1d: +(dose1 * amtMin * freqMin).toFixed(4), max1d: dose1d },
        ok: issues.length === 0,
        reason: issues.length === 0 ? '적합' : issues.join('; '),
      };
    }

    return { ingr: row.ingr, gubun: row.gubun,
             allowed: {}, actual: {},
             ok: null, reason: '표1·표2에서 성분을 찾을 수 없음' };
  });

  // ── 비례배합 검증 (Ⅰ항 2종 이상) ──
  // JSON 원문: "Ⅰ항 2종이상 배합 시 각 성분의 (1회배합량/1회최대) 합이 1/2이상 3/2이하"
  let propResult = null;
  if (grup1.length >= 2) {
    let ratioSum = 0;
    const ratioDetails = [];
    for (const { row, ref } of grup1) {
      const max1 = ref['1회최대분량_mg'];
      if (!max1) continue;
      const doseDose = +(parseFloat(row.dose) * amtMax).toFixed(4);
      const r = doseDose / max1;
      ratioSum += r;
      ratioDetails.push(`${row.ingr} ${doseDose}/${max1}=${r.toFixed(3)}`);
    }
    const adj = +(ratioSum).toFixed(4);
    const ok  = adj >= 0.5 && adj <= 1.5;
    propResult = {
      key: 'Ⅰ항 비례배합',
      ok,
      reason: `합산비 ${adj} (${ok ? '1/2~3/2 범위 내' : '범위 벗어남: 1/2 이상 3/2 이하 조건 위반'})  [${ratioDetails.join(', ')}]`,
    };
  }

  return { itemResults, ruleErrors, propResult, coeff, freq, amtMin, amtMax, freqMin, freqMax };
}

function validateChapter3(tables, form, ageGroup, rows, dosage) {
  const { amtMax=1, freqMax=1, freqMin=1, amtMin=1 } = dosage;
  const table1e  = tables['표1_유효성분']           ?? [];
  const table1h  = tables['표1_생약_및_한약처방']    ?? [];
  const table2   = tables['표2_한방처방_구성']        ?? {};
  const coeffTbl = tables['표3_연령구분계수']         ?? [];
  const coeff    = getCoeffFromTable(coeffTbl, ageGroup);

  const 마황처방 = new Set(
    (table2['처방'] ?? []).filter(p => p['구성'] && '마황' in p['구성']).map(p => p['처방명'])
  );

  const hasV1항    = rows.some(r => { const e=table1e.find(t=>t['성분명']===r.ingr); return e&&e['구분'].startsWith('Ⅴ-1'); });
  const has마황직접 = rows.some(r => !!table1h.find(t=>t['성분명']===r.ingr&&t['구분']==='가란'));
  const has마황처방 = rows.some(r => { const e=table1h.find(t=>t['성분명']===r.ingr&&t['구분']==='라란'); return e&&마황처방.has(r.ingr); });

  // 아세트아미노펜 단독 배합 여부 (Ⅰ항 1종만, Ⅲ항 없음)
  const grupI   = rows.filter(r=>r.ingr && table1e.find(t=>t['성분명']===r.ingr && (t['구분']??'').startsWith('Ⅰ항')));
  const grupIII = rows.filter(r=>r.ingr && table1e.find(t=>t['성분명']===r.ingr && (t['구분']??'').startsWith('Ⅲ항')));
  const isAcetoAlone = grupI.length===1 && grupIII.length===0 && grupI[0]?.ingr==='아세트아미노펜';

  const ruleErrors = [];
  if (hasV1항 && (has마황직접 || has마황처방))
    ruleErrors.push({ key:'마황×Ⅴ-1항 배합금지', ok:false,
      reason:'마황 또는 마황함유 처방(갈근탕·소청룡탕·마황탕)과 Ⅴ-1항(기관지확장제)은 배합 불가' });

  const itemResults = rows.filter(r=>r.ingr).map(row => {
    const base = { ingr:row.ingr, gubun:row.gubun };

    const eRef = table1e.find(t=>t['성분명']===row.ingr);
    if (eRef) {
      let raw=parseFloat(row.dose), conv='';
      if (row.unit!=='mg') {
        const cv=convertToUnit(raw,row.unit,'mg');
        if(!cv) return {...base, dose1:null, dailyMin:null, dailyMax:null, critMin:null, critMax:null, unit:'mg', ok:false, reason:'단위 환산 불가'};
        raw=cv.value; conv='(환산)';
      }
      const dailyMin = +(raw*amtMin*freqMin).toFixed(4);
      const dailyMax = +(raw*amtMax*freqMax).toFixed(4);
      const critMax  = eRef['1일최대분량_mg']!=null ? +(eRef['1일최대분량_mg']*coeff).toFixed(4) : null;
      const gubunStr = eRef['구분'] ?? '';
      const critMinFrac = (gubunStr.includes('Ⅻ') || gubunStr.includes('ⅩⅣ')) ? 1/5 : 1/2;
      let critMin = critMax!=null ? +(critMax * critMinFrac).toFixed(4) : null;
      if (isAcetoAlone && row.ingr==='아세트아미노펜' && critMax!=null)
        critMin = Math.max(critMin ?? 0, +(600 * coeff).toFixed(4));
      const unit = conv ? `mg ${conv}` : 'mg';
      const issues = [];
      if (critMax!=null && dailyMax>critMax) issues.push(`1일 최대 초과: ${dailyMax}>${critMax}`);
      if (critMin!=null && dailyMin<critMin) issues.push(`배합 최소 미달: ${dailyMin}<${critMin}`);
      return { ...base, dose1:+raw.toFixed(4), dailyMin, dailyMax, critMin, critMax, unit,
               ok:issues.length===0, reason:issues.length===0?'적합':issues.join('; ') };
    }

    const hRef = table1h.find(t=>t['성분명']===row.ingr);
    if (hRef) {
      const rawG = toGram(parseFloat(row.dose), row.unit);
      if (rawG===null) return {...base, dose1:null, dailyMin:null, dailyMax:null, critMin:null, critMax:null, unit:'g', ok:false, reason:'IU 단위는 생약에 사용 불가'};
      const dailyMin = +(rawG*amtMin*freqMin).toFixed(4);
      const dailyMax = +(rawG*amtMax*freqMax).toFixed(4);
      const maxG     = hRef['1일최대분량_원생약_g'] ?? hRef['1일최대분량_분말_g'];
      if (maxG==null) return {...base, dose1:+rawG.toFixed(4), dailyMin, dailyMax, critMin:null, critMax:null, unit:'g', ok:null, reason:'최대분량 없음'};
      const isLa = hRef['구분']==='라란';
      if (isLa) {
        const critMin=+(maxG/5).toFixed(4), critMax=+(maxG/2).toFixed(4);
        const issues = [];
        if (dailyMin<critMin) issues.push(`라란 최소 미달: ${dailyMin}<${critMin}g (1/5)`);
        if (dailyMax>critMax) issues.push(`라란 최대 초과: ${dailyMax}>${critMax}g (1/2)`);
        return { ...base, dose1:+rawG.toFixed(4), dailyMin, dailyMax, critMin, critMax, unit:'g',
                 ok:issues.length===0, reason:issues.length===0?'적합':issues.join('; ') };
      } else {
        const critMax=+(maxG*coeff).toFixed(4);
        const issue = dailyMax>critMax ? [`1일 최대 초과: ${dailyMax}>${critMax}g`] : [];
        return { ...base, dose1:+rawG.toFixed(4), dailyMin, dailyMax, critMin:null, critMax, unit:'g',
                 ok:issue.length===0, reason:issue.length===0?'적합':issue[0] };
      }
    }

    return { ...base, dose1:null, dailyMin:null, dailyMax:null, critMin:null, critMax:null, unit:'', ok:null, reason:'표에서 성분을 찾을 수 없음' };
  });

  return { itemResults, ruleErrors, coeff, freqMin, freqMax, amtMax };
}

function validateChapter7(tables, form, ageGroup, rows, dosage) {
  const { amtMax=1, freqMax=1, freqMin=1, amtMin=1 } = dosage;
  const table1e  = tables['표1_유효성분']      ?? [];
  const table1h  = tables['표1_생약']          ?? [];
  const coeffTbl = tables['표2_연령구분계수']   ?? [];
  const coeff    = getCoeffFromTable(coeffTbl, ageGroup);
  const isTroki  = form.includes('트로키');

  const has가란  = rows.some(r=>!!table1h.find(t=>t['성분명']===r.ingr&&t['구분']==='가란'));
  const has2항   = rows.some(r=>{ const e=table1e.find(t=>t['성분명']===r.ingr); return e&&e['구분'].startsWith('2항'); });
  const has4항   = rows.some(r=>{ const e=table1e.find(t=>t['성분명']===r.ingr); return e&&e['구분'].startsWith('4항'); });

  const ruleErrors = [];
  if (has가란 && (has2항||has4항))
    ruleErrors.push({ key:'가란(마황)×2항/4항 배합금지', ok:false,
      reason:'가란(마황)은 2항(기관지확장제) 및 4항(크산틴류)과 배합 불가' });

  const itemResults = rows.filter(r=>r.ingr).map(row => {
    const base = { ingr:row.ingr, gubun:row.gubun };

    const eRef = table1e.find(t=>t['성분명']===row.ingr);
    if (eRef) {
      if (eRef['구분'].startsWith('9항') && !isTroki)
        return { ...base, dose1:null, dailyMin:null, dailyMax:null, critMin:null, critMax:null, unit:'mg',
                 ok:false, reason:'9항 성분은 트로키제에만 배합 가능' };
      let raw=parseFloat(row.dose), conv='';
      if (row.unit!=='mg') {
        const cv=convertToUnit(raw,row.unit,'mg');
        if(!cv) return {...base, dose1:null, dailyMin:null, dailyMax:null, critMin:null, critMax:null, unit:'mg', ok:false, reason:'단위 환산 불가'};
        raw=cv.value; conv='(환산)';
      }
      const dose1dose = +(raw*amtMax).toFixed(4);
      const dailyMin  = +(dose1dose*freqMin).toFixed(4);
      const dailyMax  = +(dose1dose*freqMax).toFixed(4);
      const adj1      = eRef['1회최대분량_mg']!=null ? +(eRef['1회최대분량_mg']*coeff).toFixed(4) : null;
      const adj1d     = eRef['1일최대분량_mg']!=null ? +(eRef['1일최대분량_mg']*coeff).toFixed(4) : null;
      const gubunStr  = eRef['구분'] ?? '';
      const critMinFrac = (gubunStr.startsWith('8항') || gubunStr.startsWith('10항')) ? 1/5 : 1/2;
      const critMin   = adj1d!=null ? +(adj1d * critMinFrac).toFixed(4) : null;
      const critMax   = adj1d;
      const unit      = conv ? `mg ${conv}` : 'mg';
      const issues    = [];
      if (adj1 !=null && dose1dose>adj1)  issues.push(`1회 최대 초과: ${dose1dose}>${adj1}`);
      if (critMax!=null && dailyMax>critMax) issues.push(`1일 최대 초과: ${dailyMax}>${critMax}`);
      if (critMin!=null && dailyMin<critMin) issues.push(`배합 최소 미달: ${dailyMin}<${critMin}`);
      return { ...base, dose1:+raw.toFixed(4), dailyMin, dailyMax, critMin, critMax, unit,
               ok:issues.length===0, reason:issues.length===0?'적합':issues.join('; ') };
    }

    const hRef = table1h.find(t=>t['성분명']===row.ingr);
    if (hRef) {
      const rawG=toGram(parseFloat(row.dose),row.unit);
      if (rawG===null) return {...base, dose1:null, dailyMin:null, dailyMax:null, critMin:null, critMax:null, unit:'g', ok:false, reason:'IU 단위는 생약에 사용 불가'};
      const dailyMin = +(rawG*amtMin*freqMin).toFixed(4);
      const dailyMax = +(rawG*amtMax*freqMax).toFixed(4);
      const maxG     = hRef['1일최대분량_원생약_g'] ?? hRef['1일최대분량_분말_g'];
      const critMax  = maxG!=null ? +(maxG*coeff).toFixed(4) : null;
      const critMin  = critMax!=null ? +(critMax/10).toFixed(4) : null;
      const issues   = [];
      if (critMax!=null && dailyMax>critMax) issues.push(`1일 최대 초과: ${dailyMax}>${critMax}g`);
      if (critMin!=null && dailyMin<critMin) issues.push(`배합 최소 미달: ${dailyMin}<${critMin}g`);
      return { ...base, dose1:+rawG.toFixed(4), dailyMin, dailyMax, critMin, critMax, unit:'g',
               ok:issues.length===0, reason:issues.length===0?'적합':issues.join('; ') };
    }

    return { ...base, dose1:null, dailyMin:null, dailyMax:null, critMin:null, critMax:null, unit:'', ok:null, reason:'표에서 성분을 찾을 수 없음' };
  });

  return { itemResults, ruleErrors, coeff, freqMin, freqMax, amtMax };
}

function validateChapter9(tables, form, ageGroup, rows, dosage) {
  const { amtMax=1, freqMax=1, freqMin=1, amtMin=1 } = dosage;
  const table1e  = tables['표1_유효성분']          ?? [];
  const table1h  = tables['표1_생약']               ?? [];
  const table2   = tables['표2_배합법_배합계수']     ?? [];
  const coeffTbl = tables['표3_연령구분계수']        ?? [];
  const coeff    = getCoeffFromTable(coeffTbl, ageGroup);

  /* 란별 분류 (괄호 제거한 구분 키) */
  const byLan = {};
  for (const row of rows) {
    if (!row.ingr) continue;
    const eRef = table1e.find(t=>t['성분명']===row.ingr);
    const hRef = table1h.find(t=>t['성분명']===row.ingr);
    const raw  = eRef ? eRef['구분'] : (hRef ? hRef['구분'] : null);
    if (!raw) continue;
    const key  = raw.replace(/\([^)]*\)/g,'').trim();
    if (!byLan[key]) byLan[key] = [];
    byLan[key].push(row);
  }

  const 총1란수    = Object.entries(byLan).filter(([k])=>k.startsWith('Ⅰ란')).reduce((s,[,v])=>s+v.length,0);
  const rows2란1항 = byLan['Ⅱ란 1항'] ?? [];
  const has메퀴타진 = (byLan['Ⅰ란 2항']??[]).some(r=>r.ingr==='메퀴타진');
  const hasⅥ란     = rows.some(r=>!!table1h.find(t=>t['성분명']===r.ingr&&t['구분']==='Ⅵ란'));
  const hasⅤ란     = (byLan['Ⅴ란']??[]).length>0;
  const Ⅴ란감소    = hasⅤ란 && rows2란1항.length>0;

  const isLiquid9      = /내용액|시럽/.test(form || '');
  const dose1MaxFactor = isLiquid9 ? 6 : 3;

  const ruleErrors = [];
  if (총1란수===0)
    ruleErrors.push({ key:'Ⅰ란 필수', ok:false, reason:'Ⅰ란(항히스타민제) 1종을 반드시 배합해야 함' });
  if (총1란수>1)
    ruleErrors.push({ key:'Ⅰ란 1종 초과', ok:false, reason:`Ⅰ란은 1종만 배합 가능 (현재 ${총1란수}종)` });
  if (has메퀴타진 && hasⅥ란)
    ruleErrors.push({ key:'Ⅰ란2항×Ⅵ란 배합금지', ok:false, reason:'메퀴타진(Ⅰ란 2항)은 Ⅵ란 생약과 배합 불가' });
  const hasDl메틸  = (byLan['Ⅱ란 1항']??[]).some(r => r.ingr === 'dl-메틸에페드린염산염');
  const has슈도에페 = (byLan['Ⅱ란 1항']??[]).some(r => r.ingr === '슈도에페드린염산염');
  if (hasDl메틸 && has슈도에페)
    ruleErrors.push({ key:'Ⅱ란 1항 배합금지', ok:false, reason:'dl-메틸에페드린염산염과 슈도에페드린염산염은 동시 배합 인정되지 않음 (유효성분의 종류 기준 5항)' });

  /* (가)4) Ⅲ란 동일란 1종 제한 */
  const rows3란 = byLan['Ⅲ란'] ?? [];
  if (rows3란.length > 1)
    ruleErrors.push({ key:'Ⅲ란 1종 초과', ok:false, reason:`Ⅲ란(소염효소)은 1종만 배합 가능 (현재 ${rows3란.length}종) — 유효성분의 종류 기준 4항` });

  /* (가)4) Ⅳ란 동일란 1종 제한 (1항·2항 합산) */
  const rows4란 = [...(byLan['Ⅳ란 1항'] ?? []), ...(byLan['Ⅳ란 2항'] ?? [])];
  if (rows4란.length > 1)
    ruleErrors.push({ key:'Ⅳ란 1종 초과', ok:false, reason:`Ⅳ란(항염증)은 1종만 배합 가능 (현재 ${rows4란.length}종) — 유효성분의 종류 기준 4항` });

  /* (가)4) Ⅴ란 동일란 1종 제한 */
  const rows5란 = byLan['Ⅴ란'] ?? [];
  if (rows5란.length > 1)
    ruleErrors.push({ key:'Ⅴ란 1종 초과', ok:false, reason:`Ⅴ란(카페인)은 1종만 배합 가능 (현재 ${rows5란.length}종) — 유효성분의 종류 기준 4항` });

  /* (가)5) Ⅱ란 2항 1종 제한 */
  const rows2란2항 = byLan['Ⅱ란 2항'] ?? [];
  if (rows2란2항.length > 1)
    ruleErrors.push({ key:'Ⅱ란 2항 1종 초과', ok:false, reason:`Ⅱ란 2항(부교감신경차단제)은 1종만 배합 가능 (현재 ${rows2란2항.length}종) — 유효성분의 종류 기준 5항` });

  /* (가)7) 메퀴타진(Ⅰ란 2항) + 경구용 액제 금지 */
  if (has메퀴타진 && isLiquid9)
    ruleErrors.push({ key:'Ⅰ란2항 액제 금지', ok:false, reason:'메퀴타진(Ⅰ란 2항)은 경구용 액제 이외의 제제에만 배합 가능 — 유효성분의 종류 기준 7항' });

  const itemResults = rows.filter(r=>r.ingr).map(row => {
    const base = { ingr:row.ingr, gubun:row.gubun };

    const eRef = table1e.find(t=>t['성분명']===row.ingr);
    if (eRef) {
      const rawMaxMg = eRef['1일최대분량_mg'];
      const rawMaxG  = eRef['1일최대분량_g'];
      const useG     = rawMaxG!=null;
      const refUnit  = useG ? 'g' : 'mg';
      const rawMax   = useG ? rawMaxG : rawMaxMg;
      // 문자열 "알카로이드로서 0.6" / "글리시리진산으로서 200" 등에서 숫자 추출
      const maxNum = typeof rawMax==='number' ? rawMax
                   : typeof rawMax==='string'
                     ? (isNaN(parseFloat(rawMax))
                        ? parseFloat((rawMax.match(/(\d+(?:\.\d+)?)\s*$/) || [])[1])
                        : parseFloat(rawMax))
                   : NaN;
      if (isNaN(maxNum))
        return { ...base, dose1:null, dailyMin:null, dailyMax:null, critMin:null, critMax:null, unit:refUnit,
                 ok:null, reason:`비표준 단위(${rawMax}) — 수동 확인` };

      let raw=parseFloat(row.dose), conv='';
      if (row.unit!==refUnit) {
        if (!useG) { const cv=convertToUnit(raw,row.unit,refUnit); if(!cv) return {...base, dose1:null, dailyMin:null, dailyMax:null, critMin:null, critMax:null, unit:refUnit, ok:false, reason:'단위 환산 불가'}; raw=cv.value; conv='(환산)'; }
        else { const g=toGram(raw,row.unit); if(g===null) return {...base, dose1:null, dailyMin:null, dailyMax:null, critMin:null, critMax:null, unit:'g', ok:false, reason:'단위 환산 불가'}; raw=g; conv='(환산)'; }
      }
      const dailyMin = +(raw*amtMin*freqMin).toFixed(4);
      const dailyMax = +(raw*amtMax*freqMax).toFixed(4);
      const lanKey   = eRef['구분'].replace(/\([^)]*\)/g,'').trim();
      const t2row    = table2.find(t=>t['성분구분']&&lanKey.startsWith(t['성분구분']));
      const cp       = parseCh9CoeffStr(t2row?.['1종배합_계수']);
      const baseMax  = (Ⅴ란감소 && lanKey.startsWith('Ⅴ란')) ? maxNum/2 : maxNum;
      const critMax  = +(baseMax*coeff).toFixed(4);
      const critMin  = cp?.min!=null ? +(baseMax*coeff*cp.min).toFixed(4) : null;
      const dose1Max = +(critMax/dose1MaxFactor).toFixed(4);
      const unit     = conv ? `${refUnit} ${conv}` : refUnit;
      const issues   = [];
      if (+raw.toFixed(4) > dose1Max) issues.push(`1회 최대 초과: ${+raw.toFixed(4)}>${dose1Max}${refUnit}`);
      if (dailyMax>critMax) issues.push(`1일 최대 초과: ${dailyMax}>${critMax}${refUnit}`);
      if (critMin!=null&&dailyMin<critMin) issues.push(`배합 최소 미달: ${dailyMin}<${critMin}${refUnit}`);
      return { ...base, dose1:+raw.toFixed(4), dailyMin, dailyMax, dose1Max, critMin, critMax, unit,
               ok:issues.length===0, reason:issues.length===0?'적합':issues.join('; ') };
    }

    const hRef = table1h.find(t=>t['성분명']===row.ingr);
    if (hRef) {
      const rawG = toGram(parseFloat(row.dose), row.unit);
      if (rawG===null) return {...base, dose1:null, dailyMin:null, dailyMax:null, dose1Max:null, critMin:null, critMax:null, unit:'g', ok:false, reason:'IU 단위는 생약에 사용 불가'};
      const dailyMin = +(rawG*amtMin*freqMin).toFixed(4);
      const dailyMax = +(rawG*amtMax*freqMax).toFixed(4);
      const maxG     = hRef['1일최대분량_원생약_g'] ?? hRef['1일최대분량_분말_g'];
      const t2row    = table2.find(t=>t['성분구분']==='Ⅵ란');
      const cp       = parseCh9CoeffStr(t2row?.['1종배합_계수']);
      const critMax  = maxG!=null ? +(maxG*coeff).toFixed(4) : null;
      const critMin  = (cp?.min!=null&&maxG!=null) ? +(maxG*coeff*cp.min).toFixed(4) : null;
      const dose1Max = critMax!=null ? +(critMax/dose1MaxFactor).toFixed(4) : null;
      const issues   = [];
      if (dose1Max!=null && +rawG.toFixed(4) > dose1Max) issues.push(`1회 최대 초과: ${+rawG.toFixed(4)}>${dose1Max}g`);
      if (critMax!=null&&dailyMax>critMax) issues.push(`1일 최대 초과: ${dailyMax}>${critMax}g`);
      if (critMin!=null&&dailyMin<critMin) issues.push(`배합 최소 미달: ${dailyMin}<${critMin}g`);
      return { ...base, dose1:+rawG.toFixed(4), dailyMin, dailyMax, dose1Max, critMin, critMax, unit:'g',
               ok:issues.length===0, reason:issues.length===0?'적합':issues.join('; ') };
    }

    return { ...base, dose1:null, dailyMin:null, dailyMax:null, dose1Max:null, critMin:null, critMax:null, unit:'', ok:null, reason:'표에서 성분을 찾을 수 없음' };
  });

  /* Ⅱ란 1항 비례배합 합산 (2종 이상 시 합산비 ≦2) */
  let prop2Result = null;
  if (rows2란1항.length>=2) {
    let ratioSum=0;
    const details=[];
    for (const row of rows2란1항) {
      const eRef=table1e.find(t=>t['성분명']===row.ingr);
      const maxMg=typeof eRef?.['1일최대분량_mg']==='number' ? eRef['1일최대분량_mg'] : null;
      if (!maxMg) continue;
      let raw=parseFloat(row.dose);
      if (row.unit!=='mg') { const cv=convertToUnit(raw,row.unit,'mg'); if(!cv) continue; raw=cv.value; }
      const daily=+(raw*amtMax*freqMax).toFixed(4);
      const adjMax=+(maxMg*coeff).toFixed(4);
      const r=+(daily/adjMax).toFixed(4);
      ratioSum+=r;
      details.push(`${row.ingr}: ${daily}/${adjMax}=${r}`);
    }
    const adj=+ratioSum.toFixed(4);
    prop2Result = { key:'Ⅱ란 1항 비례배합 합산', ok:adj<=2,
      reason:`합산비 ${adj} (≦2 ${adj<=2?'충족':'초과'})  [${details.join(', ')}]` };
  }

  return { itemResults, ruleErrors, prop2Result, coeff, freqMin, freqMax, amtMax, Ⅴ란감소, dose1MaxFactor };
}

