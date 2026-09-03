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

/* 화면이 채워 주는 값 — 생성기가 참조한다.
   index.html과 new.html이 각자 자기 상태를 여기에 넣는다. */
let dosageUnit = '캡슐';
let selectedExcipients = [];

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

/* 그 연령의 연령구분계수를 원문 표기 그대로 돌려준다 ("1", "2/3" 등).
   제2·3·7·9장은 표3에 연령별로 계수가 하나씩만 있어 그대로 쓸 수 있다.
   제1장은 성분군(비타민/미네랄/생약)과 제형마다 계수가 달라 한 값으로
   말할 수 없으므로 여기서는 다루지 않는다(빈 문자열). */
function _ageCoefLabel(chapterKey, age) {
  if (chapterKey === '제1장_비타민미네랄') return '';
  const tbl = DB[chapterKey]?.['표']?.['표3_연령구분계수'];
  if (!Array.isArray(tbl)) return '';
  const norm = s => String(s || '').replace(/\s+/g, '');
  const hit = tbl.find(r => norm(r['연령구분']) === norm(age));
  return hit ? String(hit['계수'] ?? '') : '';
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
    issues.push(_reasonUnder('1일', dailyMin, critMin, useUnit, ageNote));
  if (critMax != null && dailyMax > critMax)
    issues.push(_reasonOver('1일', dailyMax, critMax, useUnit, ageNote));

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
    issues.push(_reasonOver('1일', dailyMax, critMax, refUnit, ageNote));

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
    issues.push(_reasonOver('1일', dailyMax, critMax, refUnit, ageNote));

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
    issues.push(_reasonOver('1일', dailyMax, critMax, refUnit));

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

/* 배합량이 숫자가 아니면(빈칸·오타·문자) 판정하지 않는다.
   화면에는 이런 값을 막는 차단막이 있지만, 검증 함수 자체가
   "적합"을 돌려주면 그 막을 우회하는 경로가 생겼을 때
   허가 서류에 근거 없는 적합이 실린다. 여기서 한 번 더 막는다. */
function _doseUnusable(row) {
  const v = row.dose;
  if (v === '' || v == null) return true;
  const n = +v;
  return !Number.isFinite(n) || n < 0;
}
function _unusableResult(base, unit) {
  return { ...base, dose1: null, dailyMin: null, dailyMax: null,
           critMin: null, critMax: null, unit: unit || 'mg',
           ok: null, reason: '배합량이 숫자가 아니어서 판정할 수 없음' };
}

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
    if (_doseUnusable(row)) return _unusableResult({ ingr: row.ingr, gubun: row.gubun }, row.unit);
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
    if (_doseUnusable(row)) return _unusableResult({ ingr: row.ingr, gubun: row.gubun }, row.unit);
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
        issues.push(_reasonOver('1회', dose1dose, adjMax1, 'mg'));
      if (adjMax1d != null && dose1d > adjMax1d)
        issues.push(_reasonOver('1일', dose1d, adjMax1d, 'mg', ` (1회 ${_num(dose1dose)} × ${freq}회)`));

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
          issues.push(_reasonUnder('1일', dose1d, minBigo, 'mg'));
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
        issues.push(_reasonOver('1일', dose1d, max1d_mg, 'mg', ` (표2 ${isExt ? '엑스' : '분말'} 기준)`));
      if (min1d_mg != null && dose1d < min1d_mg)
        issues.push(_reasonUnder('1일', dose1d, min1d_mg, 'mg', ' (1일 최대의 1/10)'));

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
    const uncountable = [];        // 최대분량을 알 수 없어 셀 수 없는 성분
    for (const { row, ref } of grup1) {
      const max1 = typeof ref['1회최대분량_mg'] === 'number' ? ref['1회최대분량_mg'] : null;
      const dose = parseFloat(row.dose);
      if (!max1 || !Number.isFinite(dose)) { uncountable.push(row.ingr); continue; }
      const doseDose = +(dose * amtMax).toFixed(4);
      const r = doseDose / max1;
      ratioSum += r;
      ratioDetails.push(`${row.ingr} ${doseDose}/${max1}=${r.toFixed(3)}`);
    }
    /* 하나라도 못 세면 합이 실제보다 작아진다. 그 상태로 "적합"이라고 하면
       기준을 넘은 제품이 통과한다. 판정하지 않고 사람에게 넘긴다. */
    if (uncountable.length) {
      propResult = {
        key: 'Ⅰ항 비례배합',
        ok: null,
        reason: `합산비를 계산할 수 없습니다 — ${uncountable.join(', ')}의 1회 최대분량을 알 수 없습니다. 직접 확인해 주세요.`,
      };
    } else {
      const adj = +(ratioSum).toFixed(4);
      const ok  = adj >= 0.5 && adj <= 1.5;
      propResult = {
        key: 'Ⅰ항 비례배합',
        ok,
        reason: `합산비 ${adj} (${ok ? '1/2~3/2 범위 내' : '범위 벗어남: 1/2 이상 3/2 이하 조건 위반'})  [${ratioDetails.join(', ')}]`,
      };
    }
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

  /* 분량 6) "<표1> 중 Ⅰ항의 유효성분 중 아세트아미노펜만 배합하는 경우"
     — "Ⅰ항 중에서" 아세트아미노펜뿐이라는 뜻이다. 다른 항(항히스타민제 등)이
     함께 있는지는 이 조항과 무관하다.
     예전에는 Ⅲ항이 없을 때만으로 좁혀 놓아, 항히스타민제를 함께 쓰는
     보통의 감기약에서 600mg 하한이 적용되지 않았다. */
  const grupI   = rows.filter(r=>r.ingr && table1e.find(t=>t['성분명']===r.ingr && (t['구분']??'').startsWith('Ⅰ항')));
  const isAcetoAlone = grupI.length===1 && grupI[0]?.ingr==='아세트아미노펜';

  const ruleErrors = [];
  if (hasV1항 && (has마황직접 || has마황처방))
    ruleErrors.push({ key:'마황×Ⅴ-1항 배합금지', ok:false,
      reason:'마황 또는 마황함유 처방(갈근탕·소청룡탕·마황탕)과 Ⅴ-1항(기관지확장제)은 배합 불가' });

  const itemResults = rows.filter(r=>r.ingr).map(row => {
    const base = { ingr:row.ingr, gubun:row.gubun };
    if (_doseUnusable(row)) return _unusableResult(base, row.unit);

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
      /* 배합량의 하한 — 원문 분량 5)가 기본 1/2이고, 그 아래 조항들이
         "별도로 정하는 경우"로 이를 대신한다.
           7) Ⅻ항·ⅩⅣ항          1/5
           8) ⅩⅢ항               표1 괄호 안의 양 (비율이 아니라 고정값)
           9) ⅩⅤ항 글리시리진산  1/10  ← 2026-57호로 들어옴
           6) 아세트아미노펜 단독  600 mg (고정값) */
      let critMin;
      const _isX13 = gubunStr.includes('ⅩⅢ');
      const _paren = _isX13 ? String(eRef['비고'] ?? '').match(/배합\s*최소량\s*([\d.]+)/) : null;
      if (_paren) {
        // 표1에 "25(1)"처럼 적힌 괄호 안 값. 어린이는 연령계수를 곱한다.
        critMin = +(parseFloat(_paren[1]) * coeff).toFixed(4);
      } else {
        const critMinFrac =
            (gubunStr.includes('Ⅻ') || gubunStr.includes('ⅩⅣ')) ? 1/5
          : (gubunStr.includes('ⅩⅤ'))                            ? 1/10
          // 분량 6) 뒷부분 — Ⅰ항을 2종 이상 배합하면 각 성분의 하한이 1/5
          : (gubunStr.startsWith('Ⅰ항') && grupI.length >= 2)     ? 1/5
          : 1/2;
        critMin = critMax != null ? +(critMax * critMinFrac).toFixed(4) : null;
      }
      /* 분량 6) — 아세트아미노펜만 배합하면 하한이 600 mg이다.
         분량 5)의 "별도로 정하는 경우"가 바로 이것이므로 1/2(750)을
         쓰지 않고 600으로 갈음한다. 예전에는 둘 중 큰 값을 써서
         600~750 사이 제품이 부적합으로 잘못 나왔다. */
      if (isAcetoAlone && row.ingr === '아세트아미노펜' && critMax != null)
        critMin = +(600 * coeff).toFixed(4);
      const unit = conv ? `mg ${conv}` : 'mg';
      const issues = [];
      if (critMax!=null && dailyMax>critMax) issues.push(_reasonOver('1일', dailyMax, critMax, unit));
      if (critMin!=null && dailyMin<critMin) issues.push(_reasonUnder('1일', dailyMin, critMin, unit));
      return { ...base, dose1:+raw.toFixed(4), dailyMin, dailyMax, critMin, critMax, unit,
               ok:issues.length===0, reason:issues.length===0?'적합':issues.join('; ') };
    }

    const hRef = table1h.find(t=>t['성분명']===row.ingr);
    if (hRef) {
      const rawG = toGram(parseFloat(row.dose), row.unit);
      if (rawG===null) return {...base, dose1:null, dailyMin:null, dailyMax:null, critMin:null, critMax:null, unit:'g', ok:false, reason:'IU 단위는 생약에 사용 불가'};
      const dailyMin = +(rawG*amtMin*freqMin).toFixed(4);
      const dailyMax = +(rawG*amtMax*freqMax).toFixed(4);
      /* 생약은 원생약(처방환산량)으로 넣을 때와 분말로 넣을 때
         1일 최대분량이 다르다. 어느 쪽인지는 작업자가 행마다 고르며,
         고르지 않았으면 흔한 쪽인 원생약·처방환산량으로 본다.
         (분말 값이 아예 없는 생약은 분말 배합이 인정되지 않는 것이므로
          그 경우에도 원생약 값을 쓴다) */
      const _basis   = row.herbBasis === '분말' ? '분말' : '원생약';
      const _powder  = hRef['1일최대분량_분말_g'];
      const maxG     = (_basis === '분말' && _powder != null)
                     ? _powder
                     : (hRef['1일최대분량_원생약_g'] ?? _powder);
      if (maxG==null) return {...base, dose1:+rawG.toFixed(4), dailyMin, dailyMax, critMin:null, critMax:null, unit:'g', ok:null, reason:'최대분량 없음'};
      const isLa = hRef['구분']==='라란';
      if (isLa) {
        const critMin=+(maxG/5).toFixed(4), critMax=+(maxG/2).toFixed(4);
        const issues = [];
        if (dailyMin<critMin) issues.push(_reasonUnder('1일', dailyMin, critMin, 'g', ' (1일 최대의 1/5)'));
        if (dailyMax>critMax) issues.push(_reasonOver('1일', dailyMax, critMax, 'g', ' (1일 최대의 1/2)'));
        return { ...base, dose1:+rawG.toFixed(4), dailyMin, dailyMax, critMin, critMax, unit:'g',
                 ok:issues.length===0, reason:issues.length===0?'적합':issues.join('; ') };
      } else {
        const critMax = +(maxG*coeff).toFixed(4);
        /* 분량 9) 가란·나란·다란 생약의 하한은 1일 최대분량의 1/10.
           예전에는 하한을 아예 두지 않아(critMin:null) 아무리 적게 넣어도
           통과했고, 워드 검토서의 1일최소 칸도 "—"로 비어 있었다.
           (분량 10)의 1/2·1/5 예외는 "효능의 근거가 생약에만 의할 경우"라
            프로그램이 단정할 수 없어 조항별 판정에서 따로 보류로 둔다) */
        const critMin = +(critMax/10).toFixed(4);
        const issues = [];
        if (dailyMax > critMax) issues.push(_reasonOver('1일', dailyMax, critMax, 'g'));
        if (dailyMin < critMin) issues.push(_reasonUnder('1일', dailyMin, critMin, 'g', ' (1일 최대의 1/10)'));
        return { ...base, dose1:+rawG.toFixed(4), dailyMin, dailyMax, critMin, critMax, unit:'g',
                 ok:issues.length===0, reason:issues.length===0?'적합':issues.join('; ') };
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
    if (_doseUnusable(row)) return _unusableResult(base, row.unit);

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
      if (adj1 !=null && dose1dose>adj1)  issues.push(_reasonOver('1회', dose1dose, adj1, unit));
      if (critMax!=null && dailyMax>critMax) issues.push(_reasonOver('1일', dailyMax, critMax, unit));
      if (critMin!=null && dailyMin<critMin) issues.push(_reasonUnder('1일', dailyMin, critMin, unit));
      return { ...base, dose1:+raw.toFixed(4), dailyMin, dailyMax, critMin, critMax, unit,
               ok:issues.length===0, reason:issues.length===0?'적합':issues.join('; ') };
    }

    const hRef = table1h.find(t=>t['성분명']===row.ingr);
    if (hRef) {
      const rawG=toGram(parseFloat(row.dose),row.unit);
      if (rawG===null) return {...base, dose1:null, dailyMin:null, dailyMax:null, critMin:null, critMax:null, unit:'g', ok:false, reason:'IU 단위는 생약에 사용 불가'};
      const dailyMin = +(rawG*amtMin*freqMin).toFixed(4);
      const dailyMax = +(rawG*amtMax*freqMax).toFixed(4);
      /* 생약은 원생약(처방환산량)으로 넣을 때와 분말로 넣을 때
         1일 최대분량이 다르다. 어느 쪽인지는 작업자가 행마다 고르며,
         고르지 않았으면 흔한 쪽인 원생약·처방환산량으로 본다.
         (분말 값이 아예 없는 생약은 분말 배합이 인정되지 않는 것이므로
          그 경우에도 원생약 값을 쓴다) */
      const _basis   = row.herbBasis === '분말' ? '분말' : '원생약';
      const _powder  = hRef['1일최대분량_분말_g'];
      const maxG     = (_basis === '분말' && _powder != null)
                     ? _powder
                     : (hRef['1일최대분량_원생약_g'] ?? _powder);
      const critMax  = maxG!=null ? +(maxG*coeff).toFixed(4) : null;
      const critMin  = critMax!=null ? +(critMax/10).toFixed(4) : null;
      const issues   = [];
      if (critMax!=null && dailyMax>critMax) issues.push(_reasonOver('1일', dailyMax, critMax, 'g'));
      if (critMin!=null && dailyMin<critMin) issues.push(_reasonUnder('1일', dailyMin, critMin, 'g'));
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
    if (_doseUnusable(row)) return _unusableResult(base, row.unit);

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
      if (+raw.toFixed(4) > dose1Max) issues.push(_reasonOver('1회', +raw.toFixed(4), dose1Max, refUnit));
      if (dailyMax>critMax) issues.push(_reasonOver('1일', dailyMax, critMax, refUnit));
      if (critMin!=null&&dailyMin<critMin) issues.push(_reasonUnder('1일', dailyMin, critMin, refUnit));
      return { ...base, dose1:+raw.toFixed(4), dailyMin, dailyMax, dose1Max, critMin, critMax, unit,
               ok:issues.length===0, reason:issues.length===0?'적합':issues.join('; ') };
    }

    const hRef = table1h.find(t=>t['성분명']===row.ingr);
    if (hRef) {
      const rawG = toGram(parseFloat(row.dose), row.unit);
      if (rawG===null) return {...base, dose1:null, dailyMin:null, dailyMax:null, dose1Max:null, critMin:null, critMax:null, unit:'g', ok:false, reason:'IU 단위는 생약에 사용 불가'};
      const dailyMin = +(rawG*amtMin*freqMin).toFixed(4);
      const dailyMax = +(rawG*amtMax*freqMax).toFixed(4);
      /* 생약은 원생약(처방환산량)으로 넣을 때와 분말로 넣을 때
         1일 최대분량이 다르다. 어느 쪽인지는 작업자가 행마다 고르며,
         고르지 않았으면 흔한 쪽인 원생약·처방환산량으로 본다.
         (분말 값이 아예 없는 생약은 분말 배합이 인정되지 않는 것이므로
          그 경우에도 원생약 값을 쓴다) */
      const _basis   = row.herbBasis === '분말' ? '분말' : '원생약';
      const _powder  = hRef['1일최대분량_분말_g'];
      const maxG     = (_basis === '분말' && _powder != null)
                     ? _powder
                     : (hRef['1일최대분량_원생약_g'] ?? _powder);
      const t2row    = table2.find(t=>t['성분구분']==='Ⅵ란');
      const cp       = parseCh9CoeffStr(t2row?.['1종배합_계수']);
      const critMax  = maxG!=null ? +(maxG*coeff).toFixed(4) : null;
      const critMin  = (cp?.min!=null&&maxG!=null) ? +(maxG*coeff*cp.min).toFixed(4) : null;
      const dose1Max = critMax!=null ? +(critMax/dose1MaxFactor).toFixed(4) : null;
      const issues   = [];
      if (dose1Max!=null && +rawG.toFixed(4) > dose1Max) issues.push(_reasonOver('1회', +rawG.toFixed(4), dose1Max, 'g'));
      if (critMax!=null&&dailyMax>critMax) issues.push(_reasonOver('1일', dailyMax, critMax, 'g'));
      if (critMin!=null&&dailyMin<critMin) issues.push(_reasonUnder('1일', dailyMin, critMin, 'g'));
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
    const uncountable=[];          // 최대분량이나 단위를 알 수 없어 셀 수 없는 성분
    for (const row of rows2란1항) {
      const eRef=table1e.find(t=>t['성분명']===row.ingr);
      const maxMg=typeof eRef?.['1일최대분량_mg']==='number' ? eRef['1일최대분량_mg'] : null;
      let raw=parseFloat(row.dose);
      if (!maxMg || !Number.isFinite(raw)) { uncountable.push(row.ingr); continue; }
      if (row.unit!=='mg') {
        const cv=convertToUnit(raw,row.unit,'mg');
        if(!cv) { uncountable.push(row.ingr); continue; }
        raw=cv.value;
      }
      const daily=+(raw*amtMax*freqMax).toFixed(4);
      const adjMax=+(maxMg*coeff).toFixed(4);
      const r=+(daily/adjMax).toFixed(4);
      ratioSum+=r;
      details.push(`${row.ingr}: ${daily}/${adjMax}=${r}`);
    }
    /* 하나라도 못 세면 합이 실제보다 작아진다 — 잘못된 "적합"이 나가지 않게
       판정하지 않고 사람에게 넘긴다. */
    if (uncountable.length) {
      prop2Result = { key:'Ⅱ란 1항 비례배합 합산', ok:null,
        reason:`합산비를 계산할 수 없습니다 — ${uncountable.join(', ')}의 1일 최대분량을 알 수 없습니다. 직접 확인해 주세요.` };
    } else {
      const adj=+ratioSum.toFixed(4);
      prop2Result = { key:'Ⅱ란 1항 비례배합 합산', ok:adj<=2,
        reason:`합산비 ${adj} (≦2 ${adj<=2?'충족':'초과'})  [${details.join(', ')}]` };
    }
  }

  return { itemResults, ruleErrors, prop2Result, coeff, freqMin, freqMax, amtMax, Ⅴ란감소, dose1MaxFactor };
}



/* ══════════ 4) 성분명 매칭 · 적용 기준 추정 ══════════
   허가목록의 성분 표기를 표준제조기준 성분명과 이어주고,
   성분 구성으로 어느 장에 해당하는지 추정한다.
   화면(DOM)을 건드리지 않으므로 어느 화면에서든 재사용된다. */

function _normIngrName(s) {
  return String(s ?? '').replace(/\([^)]*\)/g, '').replace(/\s/g, '').toLowerCase();
}

/* 비타민 묶음 이름 ↔ 실제 성분명
   제2·3·7·9장 표에는 "비타민B2 및 그 유도체와 염류" 같은 묶음 이름만 있는데,
   허가목록의 제품은 "리보플라빈"처럼 실제 성분명을 쓴다.
   두 이름은 글자가 하나도 겹치지 않아 그냥 두면 매칭이 안 된다.

   묶음에 무엇이 들어가는지는 제1장 표1(비타민)에 이미 다 적혀 있으므로
   손으로 목록을 만들지 않고 거기서 뽑아 쓴다. 개정으로 성분이 늘어도 따라온다. */
let _vitGroupCache = null;
function _vitaminGroupMembers(groupName) {
  if (!/비타민\s*[A-Z]?\s*\d*/i.test(groupName)) return [];

  if (!_vitGroupCache) {
    _vitGroupCache = new Map();   // '비타민b2' → ['리보플라빈', ...]
    const t1 = (typeof DB !== 'undefined')
      ? DB?.['제1장_비타민미네랄']?.['표']?.['표1_비타민'] : null;
    for (const row of (Array.isArray(t1) ? t1 : [])) {
      // 항목이 "Ⅴ(비타민B2)" 꼴이므로 괄호 안의 비타민 이름을 꺼낸다
      const m = String(row['항목'] ?? '').match(/\(([^)]*비타민[^)]*)\)/);
      if (!m) continue;
      const key = m[1].replace(/\s/g, '').toLowerCase();
      const names = Array.isArray(row['성분명']) ? row['성분명'] : [row['성분명']];
      const list = _vitGroupCache.get(key) ?? [];
      for (const n of names) if (n) list.push(n);
      _vitGroupCache.set(key, list);
    }
  }

  // "비타민B2 및 그 유도체와 염류" → "비타민B2"
  const g = String(groupName).match(/비타민\s*[A-Za-z]?\s*\d*/i);
  if (!g) return [];
  return _vitGroupCache.get(g[0].replace(/\s/g, '').toLowerCase()) ?? [];
}

function _ingrAliases(name) {
  const raw = String(name ?? '');
  const out = new Set();
  const push = v => {
    const n = String(v ?? '').replace(/\s/g, '').toLowerCase();
    if (n) out.add(n);
  };
  push(raw.replace(/\([^)]*\)/g, ''));                       // 괄호 주석 제거
  push(raw.replace(/[()]/g, ''));                            // 괄호 기호만 제거
  for (const m of raw.matchAll(/\(([^)]*)\)/g)) push(m[1]);   // 괄호 안 별칭
  push(raw);
  // "비타민B2 및 그 유도체와 염류"라면 리보플라빈 등도 같은 이름으로 친다
  if (/유도체|염류/.test(raw)) {
    for (const member of _vitaminGroupMembers(raw)) {
      push(member);
      push(String(member).replace(/\([^)]*\)/g, ''));
    }
  }
  return [...out];
}

function _hangulParts(ch) {
  const c = ch.codePointAt(0) - 0xAC00;
  if (c < 0 || c > 11171) return null;
  return { cho: Math.floor(c / 588), jung: Math.floor((c % 588) / 28), jong: c % 28 };
}

function _vowelVariantOnly(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    if (++diff > 1) return false;
    const pa = _hangulParts(a[i]), pb = _hangulParts(b[i]);
    if (!pa || !pb) return false;
    if (pa.cho !== pb.cho || pa.jong !== pb.jong) return false;
  }
  return diff === 1;
}

function ingrMatchLevel(nameA, nameB) {
  const A = _ingrAliases(nameA), B = _ingrAliases(nameB);
  let best = 0;
  for (const a of A) {
    for (const b of B) {
      if (!a || !b) continue;
      if (a === b) return 3;
      const shorter = a.length <= b.length ? a : b;
      if (shorter.length < 3) continue;   // "물", "황" 등 짧은 이름의 부분일치 오탐 차단
      if (a.includes(b) || b.includes(a)) best = Math.max(best, 2);
      else if (shorter.length >= 5 && _vowelVariantOnly(a, b)) best = Math.max(best, 1);
    }
  }
  return best;
}

function ingrNamesEqual(nameA, nameB) {
  return ingrMatchLevel(nameA, nameB) > 0;
}

function bestIngrMatch(candidates, target, nameOf = (c => c)) {
  let best = null, bestLv = 0;
  for (const c of candidates) {
    const lv = ingrMatchLevel(nameOf(c), target);
    if (lv > bestLv) { best = c; bestLv = lv; }
    if (bestLv === 3) break;
  }
  return bestLv ? { item: best, level: bestLv } : null;
}

function rankChaptersByIngredients(parsed) {
  const targets = (parsed || []).map(p => p.name).filter(Boolean);
  if (!targets.length) return [];

  const ranked = [];
  for (const key of Object.keys(chaptersMap)) {
    const names = chapterIngredientNames(key);
    if (!names.length) continue;

    let hits = 0;
    for (const t of targets) {
      if (names.some(n => ingrNamesEqual(n, t))) hits++;
    }
    if (hits) ranked.push({ key, hits, ratio: hits / targets.length, total: targets.length });
  }
  ranked.sort((a, b) => b.hits - a.hits || b.ratio - a.ratio);
  return ranked;
}

function chapterIngredientNames(key) {
  const names = [];
  for (const g of (chaptersMap[key]?.ingredientGroups || [])) {
    for (const n of (g.ingredients || [])) names.push(n);
  }
  if (key === '제1장_비타민미네랄') {
    for (const it of ch1ExtraIngrCatalog()) names.push(it.ingr);
  }
  return names;
}

function ch1ExtraIngrCatalog() {
  const tables = DB['제1장_비타민미네랄']?.['표'] ?? {};
  const out = [];
  const collect = (tbl, type) => {
    for (const item of (tables[tbl] ?? [])) {
      const 항목 = item['항목'];
      const names = Array.isArray(item['성분명']) ? item['성분명'] : [item['성분명']];
      names.forEach((ingr, idx) => { if (ingr) out.push({ type, 항목, ingr, idx }); });
    }
  };
  collect('표3_기타성분', 'etc');
  collect('표4_생약',    'herb');
  return out;
}

function inferChapterFromIngredients(parsed) {
  return rankChaptersByIngredients(parsed)[0] ?? null;
}

function _isConfidentGuess(g) {
  return !!g && g.hits >= 2 && g.ratio >= 0.6;
}

const FORM_NAME_HINTS = [
  { form: '구강용해필름',  keys: ['구강용해필름', '필름'] },
  { form: '경구용젤리제',  keys: ['젤리'] },
  { form: '시럽제',        keys: ['시럽'] },
  { form: '과립제',        keys: ['과립'] },
  { form: '환제',          keys: ['환제'] },
  { form: '산제',          keys: ['산제'] },
  { form: '경구용 액제',   keys: ['내용액', '드링크', '액제'] },
  { form: '캡슐제',        keys: ['캡슐'] },
  { form: '정제',          keys: ['정'], endsWith: true },   // '정'은 흔한 글자라 어미일 때만
];

function inferFormFromName(name, forms) {
  const n = String(name ?? '').replace(/\s/g, '');
  if (!n || !forms?.length) return null;
  for (const hint of FORM_NAME_HINTS) {
    const hit = hint.endsWith ? hint.keys.some(k => n.endsWith(k))
                              : hint.keys.some(k => n.includes(k));
    if (!hit) continue;
    // 해당 장이 실제로 허용하는 제형 문자열을 찾는다
    const form = forms.find(f => f === hint.form || f.startsWith(hint.form));
    if (form) return form;
  }
  return null;
}

/* 허가목록의 단위 표기는 품목마다 제각각이다.
   같은 밀리그램인데 "mg"으로 적은 품목도 있고 "밀리그램"으로 적은 품목도 있다.
   한글 표기를 못 읽으면 성분명에 단위가 붙은 채로 남아
   배합 성분표에 하나도 반영되지 않는다 (캐롤비 계열이 이 경우였다). */
const _UNIT_ALIAS = {
  '밀리그램': 'mg', '미리그램': 'mg', '밀리그람': 'mg', '㎎': 'mg',
  '그램': 'g', '그람': 'g',
  '마이크로그램': 'μg', '㎍': 'μg', 'mcg': 'μg', 'ug': 'μg',
  '국제단위': 'IU', '아이유': 'IU',
  '밀리리터': 'mL', '㎖': 'mL', 'ml': 'mL',
};
function _normUnit(u) {
  if (!u) return 'mg';
  const t = String(u).trim();
  if (_UNIT_ALIAS[t]) return _UNIT_ALIAS[t];
  if (_UNIT_ALIAS[t.toLowerCase()]) return _UNIT_ALIAS[t.toLowerCase()];
  if (/^mg$/i.test(t)) return 'mg';
  if (/^g$/i.test(t))  return 'g';
  if (/^iu$/i.test(t)) return 'IU';
  return t;
}

/* 긴 표기부터 맞춰야 "밀리그램"이 "그램"으로 잘리지 않는다 */
const _UNIT_PATTERN = [
  '마이크로그램', '밀리그램', '미리그램', '밀리그람', '밀리리터',
  '국제단위', '아이유', '그램', '그람',
  'mcg', 'ug', 'mg', 'mL', 'ml', 'IU', 'μg', '㎍', '㎎', '㎖', '%', 'g',
].join('|');
const _INGR_RE = new RegExp('^(.+?)\\s*([\\d.]+)\\s*(' + _UNIT_PATTERN + ')?$', 'i');

/* 부적합 사유 문구 — 숫자만 나열하면 무엇의 값인지 알 수 없다.
   "배합 최소 미달: 540<750" 대신
   "1일 540 mg — 기준 최소 750 mg에 미달" 처럼 풀어 쓴다. */
function _num(v) {
  return (v == null || isNaN(+v)) ? String(v ?? '') : (+v).toLocaleString('ko-KR', { maximumFractionDigits: 3 });
}
function _reasonOver(what, actual, limit, unit, note) {
  const u = unit ? ` ${unit}` : '';
  return `${what} ${_num(actual)}${u} — 기준 최대 ${_num(limit)}${u}을 넘음${note || ''}`;
}
function _reasonUnder(what, actual, limit, unit, note) {
  const u = unit ? ` ${unit}` : '';
  return `${what} ${_num(actual)}${u} — 기준 최소 ${_num(limit)}${u}에 미달${note || ''}`;
}

function _parseExcelIngredients(ingrStr) {
  const parts = ingrStr.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
  return parts.map(part => {
    const m = part.match(_INGR_RE);
    if (m) return { name: m[1].trim(), dose: m[2], unit: _normUnit(m[3]) };
    return { name: part, dose: '', unit: 'mg' };
  });
}


/* ══════════ 5) 효능효과 · 사용상 주의사항 자동 생성 ══════════
   배합된 성분과 첨가제로 허가사항 문구를 만든다.
   화면(DOM)을 건드리지 않으므로 어느 화면에서든 재사용된다. */

function getFreqRange(chapterKey, form) {
  const f = form || '';
  if (chapterKey === '제3장_감기약') {
    if (/내용액제|시럽/.test(f)) return { min:4, max:4, locked:true };
    return { min:3, max:3, locked:true };
  }
  if (chapterKey === '제7장_진해거담제') {
    if (f.includes('트로키')) return { min:6, max:6, locked:true };
    return { min:3, max:4, locked:false };
  }
  if (chapterKey === '제9장_비염용경구제') {
    if (/내용액제|시럽/.test(f)) return { min:6, max:6, locked:true };
    return { min:3, max:3, locked:true };
  }
  return { min:1, max:3, locked:false };
}

function formToUnit(form) {
  if (!form) return null;
  if (form.includes('캡슐')) return '캡슐';
  if (form.includes('젤리')) return '젤리';
  if (form.includes('구강용해필름')) return '매';
  if (/정제|추어블정|환제|구강용/.test(form)) return '정';
  if (/산제|과립/.test(form)) return '포';
  if (/액제|시럽|트로키/.test(form)) return 'mL';
  return null;
}

function parseThresholdStr(s) {
  if (!s) return null;
  const m = s.replace(/,/g,'').match(/([\d.]+)\s*(IU|mg|g|μg|mcg)/);
  return m ? { value: parseFloat(m[1]), unit: m[2] } : null;
}

function extractVitType(항목) {
  const m = (항목 ?? '').match(/[（(]([^）)]+)[）)]/);
  return m ? m[1] : null;
}

function calcEffDaily(row, refUnit, amtMax, freqMax) {
  let v = parseFloat(row.dose);
  if (!isFinite(v)) return null;
  if (row.unit !== refUnit) {
    const cv = convertToUnit(v, row.unit, refUnit);
    if (!cv) return null;
    v = cv.value;
  }
  return +(v * amtMax * freqMax).toFixed(6);
}

function generateEfficacy(chapterKey, form, activeRows, dosage) {
  const { amtMax = 1, freqMax = 1 } = dosage;
  const ch = DB[chapterKey];
  if (!ch) return null;
  const tables = ch['표'];
  const kijun  = ch['기준'] ?? {};

  /* ── 제2장 해열진통제 ── */
  if (chapterKey === '제2장_해열진통제') {
    const texts = kijun['효능효과'] ?? [];
    return { finalTexts: Array.isArray(texts) ? texts : [texts], items: [] };
  }

  /* ── 제9장 비염용경구제 ── */
  if (chapterKey === '제9장_비염용경구제') {
    const t = kijun['효능효과'] ?? '';
    return { finalTexts: t ? [t] : [], items: [] };
  }

  /* ── 제3장 감기약 ── */
  if (chapterKey === '제3장_감기약') {
    const table1e = tables['표1_유효성분']        ?? [];
    const table1h = tables['표1_생약_및_한약처방'] ?? [];

    const hasGubun = p => activeRows.some(r => {
      const ref = table1e.find(t => t['성분명'] === r.ingr);
      return ref && (ref['구분'] ?? '').startsWith(p);
    });
    const hasHan = lan => activeRows.some(r =>
      !!table1h.find(t => t['성분명'] === r.ingr && t['구분'] === lan));
    const hasIngrName = name => activeRows.some(r => r.ingr === name);

    // 콧물·코막힘·재채기: Ⅲ항 or Ⅵ항
    const okNose = hasGubun('Ⅲ항') || hasGubun('Ⅵ항');
    // 기침: Ⅳ항 or Ⅴ항 or 가란
    const okCough = hasGubun('Ⅳ항') || hasGubun('Ⅴ항') || hasHan('가란');
    // 가래: Ⅳ항 특정성분, Ⅴ항, Ⅶ항, Ⅺ항, 가란, 나란
    const okPhlegm = hasIngrName('구연산티페피딘') || hasIngrName('히벤즈산티페피딘')
      || hasGubun('Ⅴ항') || hasGubun('Ⅶ항') || hasGubun('Ⅺ항')
      || hasHan('가란') || hasHan('나란');

    // 표준 원문 순서·표현으로 증상 목록 구성
    const symptoms = [];
    if (okNose)   symptoms.push('콧물', '코막힘', '재채기');
    symptoms.push('인후(목구멍)통');
    if (okCough)  symptoms.push('기침');
    if (okPhlegm) symptoms.push('가래');
    symptoms.push('오한(춥고 떨리는 증상)', '발열', '두통', '관절통', '근육통');

    // "제증상"은 원래 단어를 그대로 두고 쉬운말은 괄호 설명으로 붙인다
    // ("제증상(여러 증상)"). applyEasyTerms는 바로 뒤에 괄호가 또 이어지면
    // 이중 괄호를 막으려고 건너뛰므로, 실제 증상 목록 괄호는 여기서 직접 이어 붙인다.
    const finalText = `감기의 제증상(여러 증상)(${symptoms.join(', ')})의 완화`;

    // 조건부 항목 검토 결과 (결과 화면 표시용)
    const items = [
      { label: '콧물·코막힘·재채기', ok: okNose,
        reason: okNose ? '' : 'Ⅲ항(항히스타민제) 또는 Ⅵ항(항콜린제) 미포함' },
      { label: '기침', ok: okCough,
        reason: okCough ? '' : 'Ⅳ항(진해제), Ⅴ항(기관지확장제), 가란 생약 미포함' },
      { label: '가래', ok: okPhlegm,
        reason: okPhlegm ? '' : 'Ⅳ항 티페피딘계, Ⅴ항, Ⅶ항, Ⅺ항, 가란/나란 미포함' },
    ];
    return { finalTexts: [finalText], items };
  }

  /* ── 제7장 진해거담제 ── */
  if (chapterKey === '제7장_진해거담제') {
    const effData = kijun['효능효과'] ?? {};
    const table1e = tables['표1_유효성분'] ?? [];
    const table1h = tables['표1_생약']    ?? [];
    const isTroki = form.includes('트로키');

    const hasGubun = p => activeRows.some(r => {
      const ref = table1e.find(t => t['성분명'] === r.ingr);
      return ref && (ref['구분'] ?? '').startsWith(p);
    });
    const hasHan = lan => activeRows.some(r =>
      !!table1h.find(t => t['성분명'] === r.ingr && t['구분'] === lan));
    const hasIngrName = name => activeRows.some(r => r.ingr === name);

    const has1항 = hasGubun('1항');
    const okCough  = has1항 || hasGubun('2항') || hasGubun('3항') || hasHan('가란');
    const okPhlegm = hasGubun('2항') || hasGubun('4항') || hasGubun('5항')
      || hasHan('가란') || hasHan('나란')
      || hasIngrName('구연산티페피딘') || hasIngrName('히벤즈산티페피딘');
    const hasAsthmaSrc = hasGubun('2항') || hasGubun('4항') || hasHan('가란');
    const okAsthma = hasAsthmaSrc && !has1항;

    const items = [
      { label: '기침', texts: ['기침'],
        ok: okCough, reason: okCough ? '' : '1항(중추성진해제), 2항(기관지확장제), 3항(말초성진해제), 가란 미포함' },
      { label: '가래', texts: ['가래'],
        ok: okPhlegm, reason: okPhlegm ? '' : '2항, 4항(거담제), 5항, 가란, 나란, 구연산/히벤즈산티페피딘 미포함' },
      { label: '천식', texts: ['천식'],
        ok: okAsthma, reason: okAsthma ? '' :
          !hasAsthmaSrc ? '2항(기관지확장제), 4항(크산틴계), 가란 미포함' :
          '1항(중추성진해제)과 동시 배합 시 천식 효능효과 기재 불가' },
    ];

    if (isTroki && hasGubun('9항')) {
      const trokiText = effData['트로키제_추가효능'] ?? '구내염, 편도염, 인·후두염 관련';
      items.push({ label: '구강·인후 (트로키 9항)', texts: [trokiText], ok: true, reason: '' });
    }

    const qualifying = items.filter(it => it.ok).flatMap(it => it.texts);
    return { finalTexts: qualifying.length > 0 ? [qualifying.join(', ')] : [], items };
  }

  /* ── 제1장 비타민미네랄 ── */
  if (chapterKey === '제1장_비타민미네랄') {
    const table1  = tables['표1_비타민']     ?? [];
    const table2  = tables['표2_미네랄']     ?? [];
    const table4  = tables['표4_생약']       ?? [];
    const 표6     = tables['표6_효능효과']   ?? [];
    const effData = kijun['효능효과'] ?? {};
    const conds   = effData['1일_보급량_기준_기재조건'] ?? [];
    const 추가    = effData['추가효능'] ?? [];
    const items   = [];

    /* 기본기재 + 세부항목 */
    const 기본기재    = effData['기본기재'] ?? '';
    const 세부항목arr = effData['세부항목'] ?? [];
    const _parseSebuCond = s => {
      const t = s.replace(/\s*함유시\s*$/, '').trim();
      const names = [];
      if (t.includes('간유')) names.push('간유');
      const vm = t.match(/비타민\s+(.+)$/);
      if (vm) vm[1].split(/,\s*/).forEach(p => {
        const n = p.trim().replace(/\s+/g, ''); if (n) names.push('비타민' + n);
      });
      return names;
    };
    const _vitPresent = vn => {
      if (vn === '간유') return activeRows.some(r => r.ingr.includes('간유'));
      return activeRows.some(r =>
        table1.some(vr => extractVitType(vr['항목']) === vn && nameMatches(vr['성분명'], r.ingr)));
    };
    const VIT_SHORT_MAP = { '비타민A':'A','비타민D':'D','비타민E':'E','비타민B1':'B1','비타민B2':'B2','비타민B6':'B6','비타민C':'C' };
    const presentVitShort = Object.entries(VIT_SHORT_MAP).filter(([vn]) => _vitPresent(vn)).map(([, s]) => s);
    const basicText = (기본기재 && presentVitShort.length)
      ? 기본기재.replace(/X\s*\([^)]+\)/, presentVitShort.join(', ')) : null;
    const basicItems = 세부항목arr.map(txt => {
      const m = txt.match(/^([^(（]+)[（(]([^）)]+)[）)]/);
      if (!m) return { label: txt, ok: false, cond: '' };
      const condVits = _parseSebuCond(m[2]);
      return { label: m[1].trim(), ok: condVits.some(_vitPresent), cond: m[2] };
    });

    /* 비타민별 효능효과 */
    for (const cond of conds) {
      const vitName = cond['성분'];
      const thresh  = parseThresholdStr(cond['기재조건']);
      const 표6row  = 표6.find(r => r['제제'] === `${vitName}함유제제`);
      const effTexts = 표6row?.['효능효과'] ?? [];
      if (!effTexts.length) continue;

      const relevant = activeRows.filter(r =>
        table1.some(vr => extractVitType(vr['항목']) === vitName && nameMatches(vr['성분명'], r.ingr))
      );

      if (!relevant.length) {
        items.push({ label: vitName, texts: effTexts, ok: false, reason: `${vitName} 성분 미포함` });
        continue;
      }
      if (!thresh) {
        items.push({ label: vitName, texts: effTexts, ok: true, reason: '' });
        continue;
      }
      let total = 0;
      for (const row of relevant) {
        const d = calcEffDaily(row, thresh.unit, amtMax, freqMax);
        if (d !== null) total += d;
      }
      total = +total.toFixed(4);
      const ok = total >= thresh.value;
      items.push({ label: vitName, texts: effTexts, ok,
        reason: ok ? '' : `1일 ${total} ${thresh.unit} < 기재조건 ${thresh.value} ${thresh.unit}` });
    }

    /* 추가효능 (미네랄, 자양강장) */
    for (const eff of 추가) {
      if (eff.startsWith('자양강장')) {
        const t4I = table4.find(r => r['항목'] === 'Ⅰ');
        const rel = t4I ? activeRows.filter(r => nameMatches(t4I['성분명'], r.ingr)) : [];
        if (!rel.length) {
          items.push({ label: '자양강장', texts: ['자양강장'], ok: false, reason: '표4 Ⅰ항 생약(인삼·홍삼·미삼) 미포함' });
        } else {
          let g = 0;
          for (const row of rel) { const v = toGram(parseFloat(row.dose), row.unit); if (v !== null) g += v * amtMax * freqMax; }
          g = +g.toFixed(4);
          const ok = g >= 0.6;
          items.push({ label: '자양강장', texts: ['자양강장'], ok,
            reason: ok ? '' : `1일 ${g}g < 기재조건 0.6g (원생약 기준)` });
        }
        continue;
      }
      const m = eff.replace(/,/g,'').match(/^([^(（]+)[（(]([가-힣]+)으로서\s*([\d.]+)\s*(mg|IU|μg|g|mcg)\s*이상/);
      if (!m) continue;
      const [, effText, minName, threshStr, unit] = m;
      const thresh = parseFloat(threshStr);
      const rel = activeRows.filter(r => { const mr = findMineralRow(table2, r.ingr); return mr && mr['성분'] === minName; });
      if (!rel.length) {
        items.push({ label: effText.trim(), texts: [effText.trim()], ok: false, reason: `${minName} 성분 미포함` });
        continue;
      }
      let total = 0;
      for (const row of rel) { const d = calcEffDaily(row, unit, amtMax, freqMax); if (d !== null) total += d; }
      total = +total.toFixed(4);
      const ok = total >= thresh;
      items.push({ label: effText.trim(), texts: [effText.trim()], ok,
        reason: ok ? '' : `1일 ${total} ${unit} < 기재조건 ${thresh} ${unit}` });
    }

    const finalTexts = items.filter(it => it.ok).flatMap(it => it.texts);
    return { finalTexts, items, basicText, basicItems };
  }

  return null;
}

const EXCIPIENT_PREC_DB = {
  '벤질알코올': {
    경고: ['벤질알코올은 조숙아에게서 치명적인 가쁜 호흡증상과 연관이 있는 것으로 보고되었다.'],
    복용하지_말_것: ['신생아, 미숙아 (벤질알코올을 함유하고 있다.)'],
  },
  '삭카린나트륨': {
    복용시_주의: ['동물실험에서 발암성이 있는 것으로 나타난 삭카린을 함유하고 있어 건강에 해로울 수 있다. (감미제로서 삭카린이 함유되어 있다.)'],
  },
  '아스파탐': {
    경고: ['이 약에 함유되어 있는 인공감미제 아스파탐은 체내에서 분해되어 페닐알라닌으로 대사되므로, 페닐알라닌의 섭취를 규제할 필요가 있는 유전성 질환인 페닐케톤뇨증환자에는 투여하지 말 것.'],
  },
  '아황산수소나트륨': {
    복용전_상의: ['이 약은 아황산수소나트륨이 함유되어 있으므로 아황산 아나필락시와 같은 알레르기를 일으킬 수 있으며, 일부 감수성 환자에서는 생명을 위협할 정도 또는 이보다 약한 천식발작을 일으킬 수 있다. 일반 사람에서의 아황산감수성에 대한 총괄적인 빈도는 알려지지 않았으나 낮은 것으로 보이며 아황산감수성은 비천식환자보다 천식환자에서 빈번한 것으로 나타났다.'],
  },
  '아황산나트륨': {
    복용전_상의: ['이 약은 아황산나트륨이 함유되어 있어 아나필락시와 같은 알레르기를 일으킬 수 있으며 일부 감수성 환자에서는 생명을 위협할 정도 또는 이보다 약한 천식발작을 일으킬 수 있다. 일반 사람에서의 아황산감수성에 대한 총괄적인 빈도는 알려지지 않았으나 낮은 것으로 보이며 아황산감수성은 비천식환자보다 천식환자에서 빈번한 것으로 나타났다.'],
  },
  '피로아황산나트륨': {
    복용전_상의: ['이 약은 피로아황산나트륨이 함유되어 있어 아나필락시와 같은 알레르기를 일으킬 수 있으며 일부 감수성 환자에서는 생명을 위협할 정도 또는 이보다 약한 천식발작을 일으킬 수 있다. 일반 사람에서의 아황산감수성에 대한 총괄적인 빈도는 알려지지 않았으나 낮은 것으로 보이며 아황산감수성은 비천식환자보다 천식환자에서 빈번한 것으로 나타났다.'],
  },
  '피로아황산칼륨': {
    복용전_상의: ['이 약은 피로아황산칼륨이 함유되어 있어 아나필락시와 같은 알레르기를 일으킬 수 있으며 일부 감수성 환자에서는 생명을 위협할 정도 또는 이보다 약한 천식발작을 일으킬 수 있다. 일반 사람에서의 아황산감수성에 대한 총괄적인 빈도는 알려지지 않았으나 낮은 것으로 보이며 아황산감수성은 비천식환자보다 천식환자에서 빈번한 것으로 나타났다.'],
  },
  '벤조산나트륨': {
    복용시_주의: [
      '(외용제) 이 약은 안식향산(나트륨)을 포함하고 있어 피부, 눈, 점막에 경미한 자극이 될 수 있다.',
      '(주사제) 이 약은 안식향산(나트륨)을 포함하고 있어 신생아에게 황달의 위험을 증가시킬 수 있다.',
    ],
  },
  '알코올': {
    복용하지_말_것: [
      '간염, 알코올중독, 간질 또는 두뇌손상 환자',
      '임부, 수유부 및 소아',
    ],
    복용시_주의: [
      '다른 약물의 효과를 감소시키거나 증가시킬 수 있으며, 반응속도가 감소될 수 있다.',
      '운전자와 기계조작자는 특히 주의할 것.',
    ],
  },
  '월견초종자유': {
    복용시_주의: ['이 약은 월견초종자유를 함유하고 있으므로 발진 등의 알레르기 반응과 복통이 나타날 수 있다.'],
  },
  '치메로살': {
    복용하지_말_것: ['치메로살에 과민증 환자'],
    복용시_주의: ['이 약은 치메로살(유기수은제제)을 함유하고 있어 과민반응이 일어날 수 있다.'],
  },
  '카라멜': {
    복용전_상의: ['이 약은 카라멜을 함유하고 있으므로 이 성분에 과민하거나 알레르기 병력이 있는 환자에는 신중히 투여한다.'],
  },
  '카제인': {
    복용하지_말_것: ['우유에 과민하거나 알레르기 병력이 있는 환자(이 약은 우유단백질을 함유한다)'],
  },
  '캄파': {
    복용하지_말_것: ['30개월 이하의 유아'],
    복용전_상의: ['소아 (경련을 유발할 수 있다.)'],
  },
  '프로필렌글리콜': {
    복용전_상의: ['이 약은 프로필렌글리콜을 함유하고 있으므로 이 성분에 과민하거나 알레르기 병력이 있는 환자에는 신중히 투여한다.'],
  },
  '황색4호(타르트라진)': {
    복용전_상의: ['이 약은 황색4호(타르트라진)를 함유하고 있으므로 이 성분에 과민하거나 알레르기 병력이 있는 환자에는 신중히 투여한다.'],
  },
  '황색5호(선셋옐로우 FCF)': {
    복용전_상의: ['이 약은 황색5호(선셋옐로우 FCF, Sunset Yellow FCF)를 함유하고 있으므로 이 성분에 과민하거나 알레르기 병력이 있는 환자에는 신중히 투여한다.'],
  },
  '엘-아르기닌': {
    복용하지_말_것: ['심근경색 및 그 병력이 있는 환자'],
  },
  '대두유': {
    복용하지_말_것: [
      '대두유에 과민하거나 알레르기 병력이 있는 환자',
      '콩 또는 땅콩에 과민증이 있는 환자',
    ],
    복용전_상의: ['고지단백혈증, 당뇨병성고지질혈증 및 췌장염 등 지방대사 이상 환자 또는 지질성유제를 신중히 투여해야 하는 환자(경구제, 주사제 및 질연질캡슐제에 한함)'],
    복용시_주의: [
      '지방과부하로 특별한 위험이 예상되는 환자에게 이 약을 투여할 때 혈장지질치를 점검할 것을 권장한다. 이 점검을 통해 지방의 체외배설이 불충분하다고 판단될 경우에는 이 약의 투여를 적절히 조절한다. 환자가 다른 정주용 지질제를 동시에 투여 받고 있다면 이 약 중의 부형제로 혼재되어 있는 지질의 양을 고려하여 그 지질제의 투여량을 감소해야 한다.',
    ],
  },
  '유당': {
    복용하지_말_것: ['이 약은 유당을 함유하고 있으므로, 갈락토오스 불내성(galactose intolerance), Lapp유당분해효소 결핍증(Lapp lactase deficiency) 또는 포도당-갈락토오스 흡수장애(glucose-galactose malabsorption) 등의 유전적인 문제가 있는 환자에게는 투여하면 안 된다.'],
  },
  '벤잘코늄염화물': {
    복용시_주의: [
      '이 약은 벤잘코늄염화물을 함유하고 있어 기관지 경련을 일으킬 수 있으며, 특히 장기간 사용시 비강 내 자극이나 종창(부기), 비강 점막의 부종을 유발할 수 있다.(비강 분무제에 한함)',
      '이 약은 벤잘코늄염화물을 함유하고 있어 기관지 경련을 일으킬 수 있으며, 특히 천식 환자에서 이러한 이상사례의 위험이 높다.(폐 흡입제에 한함)',
    ],
  },
};

const CHANGE_DIRECTIVE_DB = [
  {
    trigger: ['이부프로펜', '덱시부프로펜'],
    citation: "이부프로펜, 덱시부프로펜 성분제제 : 의약품안전평가과-2738호('15.11.26), 허가사항 변경 반영일자: 2016.01.14",
    sections: [
      {
        catKey: '경고',
        items: [
          '심혈관계 위험: 조절되지 않는 고혈압, 울혈심부전증(NYHA II-III), 확립된 허혈성 심장질환, 말초동맥질환, 뇌혈관질환을 가진 환자들은 신중히 고려하여 이부프로펜을 사용하여야하며 고용량 이부프로펜(1일 2400mg) 사용을 피해야 한다. 또한 심혈관계 위험 요소(예. 고혈압, 고지혈증, 당뇨병, 흡연)를 가지고 있는 환자가 고용량 이부프로펜(1일 2400mg)이 필요한 경우 장기간 치료를 시작하기 전에 신중히 고려해야한다. 임상연구 결과 고용량(1일 2400mg) 이부프로펜 사용이 동맥 혈전 증상(심근경색증 또는 뇌졸중)에 대한 위험성을 다소 증가시킬 수 있다고 나타났다. 종합적으로 역학연구 결과 저용량 이부프로펜(예. 1일 1200mg 이하)과 동맥 혈전 증상의 위험성 증가간의 연관성은 증명되지 않았다.',
        ],
      },
      {
        catKey: '복용전_상의',
        items: [
          '심근경색이나 뇌졸중 예방목적으로 저용량 아스피린을 복용하는 사람 (이 약은 아스피린의 효과를 감소시키고, 중증의 위장관계 이상반응의 발생 위험을 증가시킬 수 있다.) 실험실적 자료에서 이부프로펜과 아스피린(아세틸살리실산) 병용투여시 이부프로펜이 저용량 아스피린의 혈소판 응집 효과를 억제할 수 있다고 나타났다. 이 데이터 외삽법에 대해 임상적으로 불확실성이 존재하지만 일반적 또는 장기간 이부프로펜 사용시, 저용량 아스피린의 심장 보호 효과가 감소될 수 있다.',
        ],
      },
    ],
  },
  {
    trigger: ['이부프로펜'],
    citation: "이부프로펜 함유제제(전신적용 제제) : 의약품안전평가과-3777(2024.5.28.), 허가사항 변경 반영일자: 2024.7.15.",
    sections: [
      {
        catKey: '이상반응_및_즉각중지',
        items: [
          '매우 드물게 다형성 홍반, 탈락 피부염이 나타날 수 있으며, 빈도불명의 전신증상과 호산구증가증을 동반한 약물 반응(DRESS 증후군) 및 급성 전신 피진성 농포증(AGEP)이 나타날 수 있다.',
        ],
      },
      {
        catKey: '복용시_주의',
        items: [
          '이부프로펜 함유 제품과 관련하여 위중하거나 치명적일 수 있는 중증 피부 이상 반응(탈락 피부염, 다형성 홍반, 스티븐스-존슨 증후군, 독성 표피 괴사 용해, DRESS 증후군, 급성 전신 피진성 농포증(AGEP) 포함)이 보고되었다. 대부분의 경우 이러한 이상반응은 투여 초기 1개월 이내에 발생한다. 이러한 반응의 증상 및 징후가 발현할 경우 이부프로펜 투여를 즉시 중단하고 적절한 치료대안을 고려해야 한다.',
        ],
      },
    ],
  },
  {
    trigger: ['이부프로펜'],
    citation: "이부프로펜 함유제제(전신적용 제제) : 의약품안전평가과-4423호('25.6.20.), 허가사항 변경 반영일자: 2025.10.10.",
    sections: [
      {
        catKey: '이상반응_및_즉각중지',
        items: [
          '빈도 불명의 코니스 증후군이 나타날 수 있다.',
        ],
      },
      {
        catKey: '복용시_주의',
        items: [
          '이 약 투여 환자에게서 코니스 증후군 사례가 보고되었다. 코니스 증후군은 관상동맥 수축과 관련이 있는 알레르기 또는 과민반응 후 발생하는 심혈관계 증상으로 심근경색을 초래할 수 있다.',
        ],
      },
    ],
  },
  {
    trigger: ['이부프로펜'],
    citation: "이부프로펜 함유제제(전신적용 제제) : - 의약품안전평가과-2229(2019.4.5.), 허가사항 변경 반영일자: 2019.5.22.",
    sections: [
      {
        catKey: '이상반응_및_즉각중지',
        items: [
          '이 약의 과량 복용 시 대사산증이 나타날 수 있다.',
        ],
      },
    ],
  },
  {
    trigger: ['이부프로펜'],
    citation: "이부프로펜 함유제제 - 전신작용 비스테로이드성 항염증제(NSAIDs) : 의약품안전평가과-887(2024.2.1.), 허가사항 변경 반영일자: 2024.5.22.",
    sections: [
      {
        catKey: '임부수유부투여',
        items: [
          '임신 30주 이후 이 약을 포함한 비스테로이드성 소염제(NSAIDs)의 사용은 태아 동맥관 조기 폐쇄 위험을 높이므로, 이 약의 사용을 피해야 한다.',
          '임신 약 20주 이후 이 약을 포함한 비스테로이드성 소염제(NSAIDs)의 사용은 태아 신기능 이상을 일으켜 양수 과소증을 유발할 수 있으며 경우에 따라서는 신생아 신장애를 일으킬 수 있다. 비스테로이드성 소염제(NSAIDs) 개시 후 48시간 이내에 양수 과소증이 흔하지 않게 보고되었지만 이러한 부작용은 평균적으로 투여 후 수일에서 수주 사이에 나타난다. 양수 과소증은 보통 투여 중단 시 회복이 가능하나, 항상 그렇지는 않다. 양수 과소증이 지속되면 합병증(예, 사지 구축과 폐 성숙 지연)이 발생할 수 있다. 신생아 신기능이 손상된 일부 시판 후 사례에서는 교환 수혈이나 투석 같은 침습적 시술이 필요했다. 임신 20~30주 동안 이 약의 투여가 필요한 경우 최소 유효 용량을 최단 기간 동안 사용하고 투여 시간이 48시간을 경과하는 경우에는 양수의 초음파 모니터링을 고려해야 한다. 양수 과소증이 발생하면 이 약을 중단하고 진료 지침에 따라 추적 관찰한다.',
        ],
      },
    ],
  },
];

function buildPrecautionCtx(chapterKey, form, activeRows, doseRows) {
  const ingrRaw = activeRows.map(r => (r.ingr || '').replace(/\s+/g, '').toLowerCase());
  const classes = new Set();
  for (const [cls, kws] of Object.entries(_PREC_CLASS_KW)) {
    if (kws.some(kw => ingrRaw.some(n => n.includes(kw.replace(/\s+/g,'').toLowerCase()))))
      classes.add(cls);
  }
  const hasChildDosage = (doseRows || []).some(r => r.age && r.age !== '만12세이상(성인)');
  return { ingrRaw, classes, form: form || '', hasChildDosage };
}

function _checkPrecItem(text, ctx, isAlert) {
  const conds = _extractPrecConds(text);
  if (!conds.length) return { show: true, tags: [] };

  // "어린이에 대한 용법이 있는 경우" 조건은 AND 필수 게이트로 처리
  // (성분 조건이 충족되더라도 어린이 용법이 없으면 표시 안 함)
  const childCondIdx = conds.findIndex(c => /어린이에\s*대한\s*용법이\s*있는\s*경우/.test(c));
  if (childCondIdx >= 0 && !ctx.hasChildDosage) return { show: false, tags: [] };

  // 나머지 조건은 OR(anyMet) 처리
  const otherConds = conds.filter((_, i) => i !== childCondIdx);
  if (!otherConds.length) return { show: true, tags: childCondIdx >= 0 ? [conds[childCondIdx]] : [] };

  const tags = []; let anyMet = false;
  for (const c of otherConds) {
    if (_condMet(c, ctx, isAlert)) { tags.push(c); anyMet = true; }
  }
  if (anyMet && childCondIdx >= 0) tags.push(conds[childCondIdx]);
  return { show: anyMet, tags };
}

function _resolveInlineMarkers(text, ctx) {
  return text.replace(/\[\[([^\|]*)\|([^\]]+)\]\]/g, (_, t, clsStr) => {
    return clsStr.split(',').map(c => c.trim()).some(c => ctx.classes.has(c)) ? t : '';
  });
}

function _stripIngredientParens(text) {
  return text.replace(/\s*\((?:[^)(]|\([^)]*\))*(?:함유\s?제제|복합제|미함유[^)]*|에\s*한함|어린이의?\s*용법[·・]?용량이?\s*있는\s*경우|어린이에\s*대한\s*용법이\s*있는\s*경우)(?:[^)(]|\([^)]*\))*\)\)?/g, '');
}

function _flattenPrecItems(cat, val) {
  const CIRC_RE    = /^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉮㉯]/;
  const SUB_NUM_RE = /^\d+[)）]/;
  if (typeof val === 'string') return [{ sub: null, text: val }];
  if (Array.isArray(val)) return val.map(v => {
    const text = String(v);
    return { sub: null, text, indent: SUB_NUM_RE.test(text), circled: CIRC_RE.test(text) };
  });
  if (typeof val === 'object' && val !== null) {
    const out = [];
    for (const [k, v] of Object.entries(val)) {
      if (k === '기타') { out.push({ sub: '기타', text: typeof v === 'string' ? v : v.join(' / ') }); continue; }
      const SUB_LABEL = { '일반증상': '일반증상', '중증증상': '중증증상' };
      const sub = SUB_LABEL[k] || k;
      if (Array.isArray(v)) v.forEach(s => out.push({ sub, text: String(s) }));
      else if (typeof v === 'string') out.push({ sub, text: v });
    }
    return out;
  }
  return [];
}

function generatePrecautions(chapterKey, form, activeRows, excipients, doseRows) {
  const chData = DB[chapterKey];
  if (!chData || !chData['사용상의_주의사항']) return null;
  const prec = chData['사용상의_주의사항'];
  const ctx  = buildPrecautionCtx(chapterKey, form, activeRows, doseRows);
  window.__lastPrecParams = { chapterKey, form, activeRows, selectedExcipients, doseRows };

  const CAT_LABELS = [
    ['경고',                   '경고'],
    ['복용하지_말_것',         '다음과 같은 사람은 이 약을 복용하지 말 것'],
    ['병용금기',               '이 약을 복용하는 동안 다음의 약을 복용하지 말 것'],
    ['복용전_상의',            '다음과 같은 사람(경우)은 이 약을 복용하기 전에 의사, 치과의사, 약사와 상의할 것.'],
    ['이상반응_및_즉각중지',   '다음과 같은 경우 이 약의 복용을 즉각 중지하고 의사, 치과의사, 약사와 상의할 것. 상담 시 가능한 한 이 첨부문서를 소지할 것.'],
    ['기타주의사항',           '기타 주의사항'],
    ['소아투여',               '소아에 대한 투여'],
    ['임부수유부투여',         '임부 및 수유부에 대한 투여'],
    ['복용시_주의',            '기타 이 약의 복용 시 주의할 사항'],
    ['저장상의_주의',          '저장상의 주의사항'],
  ];

  const sections = [];
  for (const [cat, label] of CAT_LABELS) {
    if (!(cat in prec)) continue;
    const filtered = [];

    if (cat === '이상반응_및_즉각중지' && prec['이상반응_성분매핑']) {
      const mapping  = prec['이상반응_성분매핑'];
      const advArr   = prec[cat];
      const headerText = advArr[0].split('\n')[0].trim();
      const matched  = mapping.filter(e => ctx.classes.has(e.class));
      if (matched.length) {
        filtered.push({ sub: null, text: headerText, origIdx: 0 });
        const seenTokens = new Set();
        const allSymptoms = [];
        matched.forEach(e => {
          const cleanLine = e.line
            .replace(/^[①-⑳㉮㉯]\s*/, '')
            .replace(/^[^\s:：]+\s*[:：]\s*/, '');
          cleanLine.split(',').map(s => s.trim()).filter(Boolean).forEach(item => {
            const subTokens = item.split('·').map(s => s.trim());
            if (!subTokens.every(t => seenTokens.has(t))) {
              allSymptoms.push(item);
              subTokens.forEach(t => seenTokens.add(t));
            }
          });
        });
        if (allSymptoms.length)
          filtered.push({ sub: null, text: allSymptoms.join(', '), origIdx: 0, isMapping: true });
      }
      for (let i = 1; i < advArr.length; i++) {
        const { show, tags } = _checkPrecItem(advArr[i], ctx);
        if (show) filtered.push({ sub: null, text: advArr[i], tags, origIdx: i });
      }
    } else {
      const flatItems = _flattenPrecItems(cat, prec[cat]);
      for (let i = 0; i < flatItems.length; i++) {
        const { sub, text, indent, circled } = flatItems[i];
        const resolved = _resolveInlineMarkers(text, ctx);
        if (!resolved.replace(/[\s,]/g, '')) continue;
        const { show, tags } = _checkPrecItem(resolved, ctx, cat === '경고');
        if (show) filtered.push({ sub, text: _stripIngredientParens(resolved), tags, origIdx: i, indent: !!indent, circled: !!circled });
      }
    }

    // circled 항목(④-⑨) 재번호: 앞 항목에 포함된 ①②③ 개수부터 이어서 번호 부여
    if (cat === '이상반응_및_즉각중지') {
      const CIRC = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳'];
      const hdrText = filtered.find(it => !it.circled && !it.indent)?.text || '';
      const baseCount = (hdrText.match(/[①-⑳㉮㉯]/g) || []).length;
      let nextIdx = baseCount;
      for (const it of filtered) {
        if (it.circled && nextIdx < CIRC.length) {
          it.text = it.text.replace(/^[①-⑳㉮㉯]/, CIRC[nextIdx++]);
        }
      }
    }

    let dispNum = 0;
    filtered.forEach(it => { if (!it.isMapping && !it.indent && !it.circled) it.displayNum = ++dispNum; });
    if (filtered.length) sections.push({ cat, label, items: filtered });
  }

  const catOrder = CAT_LABELS.map(([c]) => c);

  // 품목허가사항 변경지시 통합 (첨가제보다 먼저)
  const ingrNamesAll = activeRows.map(r => r.ingr);
  for (const entry of CHANGE_DIRECTIVE_DB) {
    if (!entry.trigger.some(t => ingrNamesAll.some(n => n.includes(t)))) continue;
    for (const dsec of entry.sections) {
      let sec = sections.find(s => s.cat === dsec.catKey);
      if (!sec) {
        const catLabelEntry = CAT_LABELS.find(([c]) => c === dsec.catKey);
        if (!catLabelEntry) continue;
        const catIdx = catOrder.indexOf(dsec.catKey);
        const insertAfterIdx = sections.reduce((best, s, i) =>
          catOrder.indexOf(s.cat) < catIdx ? i : best, -1);
        sec = { cat: dsec.catKey, label: catLabelEntry[1], items: [] };
        sections.splice(insertAfterIdx + 1, 0, sec);
      }
      for (const text of dsec.items) {
        sec.items.push({ sub: null, text, origIdx: -1, indent: false, isDirective: true, citation: entry.citation });
      }
      let dn = 0;
      sec.items.forEach(it => { if (!it.isMapping && !it.indent && !it.circled) it.displayNum = ++dn; });
    }
  }

  // 첨가제 사용상 주의사항 통합
  const excList = excipients && excipients.length ? excipients : (selectedExcipients || []);
  if (excList.length) {
    for (const excName of excList) {
      const excData = EXCIPIENT_PREC_DB[excName];
      if (!excData) continue;
      for (const cat of catOrder) {
        const items = excData[cat];
        if (!items || !items.length) continue;
        let sec = sections.find(s => s.cat === cat);
        if (!sec) {
          const lbl = CAT_LABELS.find(([c]) => c === cat)[1];
          const insertAfterIdx = sections.reduce((best, s, i) =>
            catOrder.indexOf(s.cat) < catOrder.indexOf(cat) ? i : best, -1);
          sec = { cat, label: lbl, items: [] };
          sections.splice(insertAfterIdx + 1, 0, sec);
        }
        for (const text of items) {
          sec.items.push({ sub: null, text, origIdx: -1, indent: false, isExcipient: true, excipientName: excName });
        }
        let dn = 0;
        sec.items.forEach(it => { if (!it.isMapping && !it.indent && !it.circled) it.displayNum = ++dn; });
      }
    }
  }

  return sections.length ? sections : null;
}

function applyEasyTerms(text) {
  if (!text) return text;
  const PH = '\x00';
  let s = text;
  for (const [med, easy, rawReplace] of _EASY_TERMS) {
    const er = med.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // lookbehind: skip if preceded by Korean syllable (term is inside a compound, e.g. 두부신경에서 신)
    // lookahead: only match at a true word boundary — non-Korean char, end-of-string,
    //   or a known Korean particle/suffix syllable (이/가/을/를/에/의/은/는/도/만/로/과/와/등/들/임/인/으)
    //   Also allows 후 (e.g. 발치후) and 통 (e.g. 인후통) as common medical suffixes
    //   This blocks 신장염(→신장+염), 발적되어(→발적+되) while allowing 부종이(particle 이)
    s = s.replace(
      new RegExp(
        '(?<![\\uAC00-\\uD7A3\\x00])' + er +
        '(?=[^\\uAC00-\\uD7A3\\x00(]|$|[이가을를에의은는도만로과와등들임인으후통])',
        'g'
      ),
      PH + (rawReplace || (med + '(' + easy + ')')) + PH
    );
  }
  return s.replace(/\x00/g, '');
}


/* ══════════ 6) 생성기 보조 ══════════ */

const _PREC_CLASS_KW = {
  // 아세트아미노펜(파라세타몰)은 살리실산 계열이 아니다 — 위통·소화관출혈·
  // 위부불쾌감·난청·이명 같은 살리실산/NSAID 특유의 부작용이 없는데도
  // 이 목록에 있으면 함께 걸려서 근거 없이 표시된다 (푸루콜드 사례로 확인).
  // "아스피린류" 태그는 이 5개 부작용에만 쓰이므로 실제 살리실산 계열만 남긴다.
  '아스피린류':       ['아스피린','아스피린알루미늄','에텐자미드','살리실산나트륨'],
  '이부프로펜류':     ['이부프로펜'],
  '항히스타민제':     ['디펜히드라민','클로르페니라민','프로메타진','메퀴타진','알리메마진','트리프롤리딘','카르비녹사민','세티리진','로라타딘','아크리바스틴','멕타진','이프로헵타딘'],
  '디펜히드라민':     ['디펜히드라민'],
  '크산틴류':         ['아미노필린','테오필린','카페인','디프로필린','크산틴'],
  '기관지확장제':     ['에페드린','메틸에페드린','슈도에페드린','아미노필린','테오필린','이소프로테레놀','살부타몰','클렌부테롤'],
  '교감신경자극제':   ['에페드린','메틸에페드린','슈도에페드린'],
  '부교감신경차단제': ['스코폴리아','벨라돈나','아트로핀','히오신','부틸스코폴라민','염화리소짐'],
  '마황':             ['마황'],
  '감초':             ['감초','글리시리진'],
  '소시호탕':         ['소시호탕'],
  '시호계지탕':       ['시호계지탕'],
  '소시호탕류':       ['소시호탕','시호계지탕'],
  '에페드린마황류':   ['에페드린','메틸에페드린','슈도에페드린','마황'],
  '갈근탕':           ['갈근탕'],
  '맥문동탕':         ['맥문동탕'],
  '미네랄':           ['칼슘으로서','마그네슘으로서','철으로서','아연으로서','망간으로서','크롬으로서','구리으로서','요오드으로서','셀레늄으로서','몰리브덴으로서','염소으로서','인으로서','칼륨으로서','나트륨으로서','황으로서'],
  '비타민A':                ['레티놀','베타카로틴','간유','레티닐팔미테이트','레티닐아세테이트'],
  '비타민D':                ['에르고칼시페롤','콜레칼시페롤'],
  '비타민E':                ['토코페롤','알파토코페롤'],
  '비타민C':                ['아스코르브산','아스코르빈산'],
  '비타민B1':               ['티아민','옥토티아민','비스벤티아민','푸르설티아민','프로설티아민','벤포티아민'],
  '비타민B1_티아민염류제외': ['옥토티아민','비스벤티아민','푸르설티아민','프로설티아민','벤포티아민'],
  '비타민B1_푸르설티아민':  ['푸르설티아민'],
  '비타민B2':               ['리보플라빈','플라빈아데닌디뉴클레오티드'],
  '비타민B2_리보플라빈부티레이트': ['리보플라빈부티레이트'],
  '비타민B6':               ['피리독신','피리독살'],
  '칼슘':                   ['칼슘','탄산칼슘','인산칼슘','글루콘산칼슘','유산칼슘'],
  '철':                     ['철','황산제일철','푸마르산제이철','구연산철암모늄'],
  '구리':                   ['구리','황산구리','글루콘산구리'],
  '요오드':                 ['요오드','요오드화칼륨','요오드화나트륨'],
  '몰리브덴':               ['몰리브덴','몰리브덴산나트륨'],
  '칼륨':                   ['칼륨','염화칼륨','글루콘산칼륨'],
  '셀레늄':                 ['셀레늄','셀레나이트나트륨','셀렌산나트륨'],
  '아연':                   ['아연','산화아연','황산아연','글루콘산아연'],
  '나트륨':                 ['탄산수소나트륨','탄산나트륨','염화나트륨'],
  '콘드로이틴설페이트나트륨': ['콘드로이틴'],
  '타우린':                 ['타우린'],
};

function _extractPrecConds(text) {
  const re = /\(((?:[^)(]|\([^)]*\))*(?:함유\s*제제|복합제|미함유[^)]*|에\s*한함|어린이에\s*대한\s*용법이\s*있는\s*경우|소아의?\s*용법[·・]?용량이?\s*있는\s*경우)(?:[^)(]|\([^)]*\))*)\)/g;
  const out = []; let m;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

function _condMet(condStr, ctx, isAlert) {
  const s = condStr.trim();
  if (/어린이에\s*대한\s*용법이\s*있는\s*경우|소아의?\s*용법[·・]?용량이?\s*있는\s*경우/.test(s)) {
    return !!ctx.hasChildDosage;
  }
  if (s.includes('에 한함')) {
    const fp = s.replace(/에\s*한함/, '').trim();
    return fp.split(/[,·및\s]+/).filter(Boolean).some(kw => ctx.form.includes(kw));
  }
  if (s.includes('미함유') || /함유\s*제제\s*제외/.test(s)) {
    // "미함유" 또는 "함유제제 제외" → 해당 성분이 없을 때 표시
    const sub = s.replace(/함유\s*제제\s*제외/, '').replace(/미함유[^$]*/,'').replace(/함유\s*제제/g,'').trim();
    const parts = sub.split(/[,·]|또는|및/).map(p => p.trim().replace(/\s+/g,'').toLowerCase()).filter(Boolean);
    return !parts.some(p =>
      ctx.ingrRaw.some(n => n.includes(p)) ||
      ctx.classes.has(p) ||
      [...ctx.classes].some(cls => cls.replace(/\s+/g,'').toLowerCase() === p)
    );
  }
  if (/\d+\s*(mg|g|IU|μg|mcg|mL)/.test(s)) return false;
  const text = s.replace(/함유\s*제제/g,'').replace(/\([^)]*\)/g,'').trim();
  const parts = text.split(/[,·，]|또는|및/).map(p => p.trim().replace(/\s+/g,'').toLowerCase()).filter(p => p.length > 1);
  for (const p of parts) {
    if (ctx.classes.has(p)) return true;
    for (const cls of ctx.classes) if (cls.replace(/\s+/g,'').toLowerCase() === p) return true;
    if (!isAlert && ctx.ingrRaw.some(n => n.includes(p))) return true;
    if (isAlert && ctx.ingrRaw.some(n => n.startsWith(p))) return true;
  }
  return false;
}

const _EASY_TERMS = (() => {
  const r = [
    ['노동성 호흡곤란','운동호흡곤란'],['노작성 호흡곤란','운동호흡곤란'],['광유성 사하제','기름성 설사약'],
    ['진구성 심근 경색','오래된 심근경색증'],['골화 지연','뼈발달지연'],['방사선 조사','방사선 쬐임'],
    ['임신 초삼분기','임신 첫3개월'],['산후 출혈','분만 후 출혈'],['급성 호흡 부전','급성 호흡 기능상실'],
    ['호기성 호흡곤란','내쉬기 곤란'],['흡기성 호흡곤란','들이쉬기 곤란'],['신성 빈혈','신장성 빈혈'],
    ['속발성 고혈압','이차 고혈압'],['아두 골반 불균형','머리 골반 불균형'],
    ['유행성이하선염','볼거리'],['횡문근융해증','횡문근용해'],['유즙울체','젖고임'],
    ['안와주위부종','눈주변 부기'],['다형성홍반','여러모양의 붉은 반점'],['개방동맥관','동맥관 개방증'],
    ['이중맹검','환자,의사 모두 모르게 임상시험하는 방법'],['간헐성파행증','이따금 절뚝거림'],
    ['간헐파행증','이따금 절뚝거림'],['경상이성체','거울상 이성질체'],['척주후만증','척주뒤굽음증'],
    ['척주측만증','척주옆굽음증'],['척주전만증','척주앞굽음증'],['척주전만','척주앞굽음증'],
    ['전격성간염','급격히 발병하는 간염'],['안구건조증','눈마름증'],['안구진탕증','눈떨림'],
    ['안구진탕','눈떨림,안진'],['안구작열감','눈의 화끈거림'],['안구자통','눈의(찌르는듯한) 통증'],
    ['담도폐쇄증','쓸개길폐쇄증'],['담낭절제술','쓸개절제술'],['유양동절제술','꼭지돌기절제술'],
    ['위아전절제술','대부분위절제술'],['충수절제술','막창자꼬리절제술,맹장꼬리절제술'],
    ['유산산증','젓산 산증'],['요추간원판','허리척추원반'],['고뇨산혈증','요산과다증'],
    ['다발성신경염','여러신경염,다발신경염'],['신경근병증','신경뿌리병증'],['고초열','꽃가루 알레르기비염'],
    ['견수증후군','어깨손증후군'],['경견완증후군','목어깨팔증후군'],['공기연하증','공기삼킴증'],
    ['시아노시스','청색증'],['쇽(아나필락시)','','쇽(아나필락시)(과민성 쇼크)'],['아나필락시쇽','과민성 쇼크'],['디스키네시아','운동이상증'],
    ['아키네시아','운동불능증'],['아시도시스','산증'],['산성증','산증'],['헤마토크리트','적혈구용적률'],
    ['헤르니아','탈장'],['임플란트','인공치아이식'],['맥관부종','혈관부기,혈관부종'],
    ['맥관석회화','혈관석회화'],['맥관염','혈관염'],['이긴장증','근육긴장이상'],
    ['근긴장이상','근육긴장이상'],['디스토니아','근육긴장이상'],['안와주위','눈주변'],
    ['난원공개존','열린타원구멍'],['심장압전','심장눌림증'],['부전수축','심장박동정지'],
    ['심계항진','두근거림'],['심와부','명치부위'],['심흉비증대','심흉비 증가'],
    ['심상성여드름','(보통)여드름'],['심폐독성','폐동맥 고혈압'],['심재성','드러나지 않는'],
    ['이형성증','형성이상'],['형성장애','형성이상'],['형성부전','형성장애'],
    ['전신조홍','온몸이 붉어짐'],['전신홍조','온몸이 붉어짐'],['전염단핵구증','전염성 단핵구'],
    ['전정장애','평형기능장애'],['시조절장애','시각조절장애'],['안검하수','눈꺼풀처짐'],
    ['안검내반','속말림,눈꺼풀속말림'],['안검염','눈꺼풀염'],['검결막염','눈꺼풀결막염'],
    ['유착결여','안붙음'],['조갑주위염','손발톱주위염'],['조갑진균증','손발톱진균증'],
    ['조갑장애','손발톱병'],['조혈모세포','줄기세포'],['한센병균','한센병균'],['나균','한센병균'],
    ['비갑개절제술','코선반절제술'],['누낭비강','눈물주머니코안'],['누낭염','눈물주머니염'],
    ['비강진','잔비늘증'],['비문증','날파리증'],['비종대','지라비대/비장비대'],
    ['비충혈','코막힘'],['비폐','코막힘'],['빈삭호흡','빠른호흡'],['급속호흡','빠른호흡'],
    ['비출혈','코피'],['비색법','색측정법'],['관류저하','혈류감소'],['관상동맥','심장동맥'],
    ['담즙울체','쓸개즙정체'],['담녹색','엷은녹색,연두빛'],['담낭축농','고름쓸개,고름담낭'],
    ['상완외측','위팔 바깥쪽'],['두중감','머리무거움'],['두경부','머리목부위'],
    ['두개골','머리뼈'],['대퇴골','넙적다리뼈'],['족근골','발목뼈'],['경추','목뼈'],
    ['요추골','허리뼈'],['하악골','아래턱뼈'],['상악골','위턱뼈'],['미골','꼬리뼈'],
    ['견갑골','어깨뼈'],['상완골','위팔뼈'],['늑골','갈비뼈'],['슬개골','무릎뼈'],
    ['경골','정강뼈'],['비골','종아리뼈'],['천골','엉치뼈'],['쇄골','빗장뼈'],
    ['추골','망치뼈'],['접형골','나비뼈'],
    ['고관절','엉덩관절'],['견관절','어깨관절'],['슬관절','무릎관절'],['주관절','팔꿉 관절'],
    ['골다공증','뼈엉성증'],['골조송증','뼈엉성증'],['골이영양증','뼈형성장애'],
    ['골연령','뼈나이'],['골막','뼈막'],['골수','뼈속질'],['골단','뼈끝'],
    ['골연화','뼈연화'],['골질환','뼈 질환'],
    ['검구유착','결막붙음증'],['공막','흰자위막'],['괄약근','조임근'],
    ['교원섬유','콜라겐섬유'],['교원성 질환','콜라겐 질환'],['교질','콜로이드'],
    ['경면','졸음'],['기면','졸음'],['면기','졸음'],['내약성','약에 대한 내성'],
    ['내이','속귀'],['냉암소','시원하고 어두운 곳'],['냉소','시원한 곳'],
    ['건냉암소','건조,시원,어두운 곳'],['건냉소','건조하고 시원한 곳'],['건소보관','건조한 곳에 보관'],
    ['뇌수종','물뇌증,수두증'],['뇌일혈','뇌출혈'],['뇨저류','소변이 고임'],
    ['농가진','고름딱지증'],['농뇨','고름뇨,농뇨'],['농양','고름집'],
    ['농포','고름물집'],['농피증','고름피부증'],['농흉','가슴고름집'],
    ['다모증','털과다증'],['다한증','땀과다증'],['다행증','이상행복감'],
    ['다뇨','소변량과다'],['다갈증','목마름증'],['다발성','여러 부위에서 동시에 나타나는'],
    ['단회투여','1회 투여'],['담관','쓸개관'],['담낭','쓸개'],['담마진','두드러기'],
    ['담즙','쓸개즙'],['당내성','포도당 내성'],['대구치','큰어금니'],
    ['대동맥류','대동맥자루'],['대증요법','증상별로 치료하는 방법'],['대증적','증상에 대응하여'],
    ['대퇴','넙적다리'],['도찰하다','바르고 문지르다'],['도포하다','바르다'],
    ['동계','두근거림'],['동통','통증'],['동창','언 상처'],['동요','안절부절'],
    ['두경감','현기증,어지러움'],['두부경증감','현기증,어지러움'],
    ['만곡족','휜발,곤봉발'],['말단지절','끝관절 마디'],['맥립종','다래끼'],
    ['면역부전','면역반응약화'],['모창','털종기증'],['미각도착','맛을 제대로 못느낌'],
    ['미란','짓무름'],['미로염','내이염/속귀염'],['미소혈관','미세혈관계'],['미황색','연노랑'],
    ['박리','벗겨내기/벗겨짐'],['반흔','흉터'],['발백선증','무좀'],
    ['발적','충혈되어 붉어짐'],['발치','이를 뽑음'],['발한','땀이 남'],
    ['배통','등 통증'],['번갈','심한갈증'],['범혈구','전체 혈구'],
    ['변색백선','어루러기'],['변의','변을 보고 싶은 느낌'],['병용','함께 복용(사용)'],
    ['봉소염','벌집염'],['부유감','들뜨는 느낌'],['부정교합','맞물림장애,교합장애,부정 교합'],
    ['부종','부기'],['불현성화','겉으로 드러나지않게'],['불현성','증상이 나타나지 않는'],
    ['불용성','녹지 않는'],['비강내','코안'],['비강','코안'],['비루','콧물'],
    ['알레르기성비염','코염'],['비염','코염'],['비측','코쪽'],['빈맥','빠른맥/빈맥'],['빈호흡','빠른 호흡'],
    ['사경','기운목'],['사지냉감','팔다리 찬느낌'],['산동','동공확대'],
    ['산립종','콩다래끼'],['산욕기','출산후기'],['산욕','출산후기'],
    ['소양감','가려움/가려움증'],['소양증','가려움/가려움증'],
    ['서맥','느린맥'],['선조','튼살'],['설변색','혀의 변색'],['설유착증','혀유착증'],
    ['설하','혀밑'],['설염','혀염'],['세균총','세균집단'],['세뇨관','콩팥뇨세관'],
    ['세동','잔떨림'],['수족냉증','손발이 차가움'],['수족지','손발가락'],
    ['수족구','손발입병'],['수지','손가락'],['수태능','임신능력'],['수포음','거품소리'],
    ['수명감','눈부심'],['수명','눈부심'],['식피술','피부이식술'],['신장병증','콩팥병증'],
    ['신세뇨관','신장세뇨관'],['신독성','신장독성'],['신장애','신장장애'],
    ['신장질환','','신장(콩팥)질환'],['신장','콩팥'],['신증','콩팥증'],['신염','신장염'],['신손상','신장손상'],
    ['실독증','읽기곤란증'],['실보증','보행불능(증)'],['실행증','행위상실증'],
    ['심박율','심장박동율'],['심인성','정신탓,마음탓'],
    ['쌍태임신','쌍둥이임신'],['쌍태','쌍둥이'],
    ['약진','약물발진'],['양진','가려움발진'],['역연동','거꿀꿈틀운동'],['역위증','좌우바뀜증'],
    ['연동','꿈틀운동'],['연변','묽은변'],['연용','계속 복용(사용)'],
    ['연하곤란','삼킴곤란'],['연하장애','삼킴곤란'],['연하운동','삼킴운동'],
    ['연하','삼키기/삼킴'],['연축','수축과 이완'],
    ['열개창','열린상처,개방창'],['열공','구멍,틈새'],['열상','화상'],
    ['염기성','알칼리성'],['염좌통','삔 통증'],['염좌','삠'],
    ['영아','젖먹이,갓난아기'],['오심','구역'],['오용','잘못 사용'],['옹종','큰종기'],
    ['와우기관','와우관,달팽이관'],['와우각','와우,달팽이관'],
    ['완선','사타구니백선(증)'],['외골증','뼈돌출증'],['외상','상처'],
    ['외이도','바깥귀길'],['외이','바깥귀'],
    ['요당양성','소변에 포도당이 배출됨'],['요배통증','허리,등 통증'],
    ['요부','허리'],['요잠혈','피섞인 소변,피섞인 오줌'],['요천통','허리통증'],
    ['요통','허리 통증','요(허리)통'],
    ['요추','허리뼈'],['요폐색','요로폐색'],['요폐','소변축적'],
    ['용량의존적인','용량에 비례하는'],['용량의존적','용량에 비례하는'],
    ['용이하도록','쉽도록'],['용이하게','쉽게'],['용이하며','쉬우며'],
    ['용해하여','녹여서'],['우종','사마귀'],['위부포만감','상복부 팽창감'],
    ['위약','속임약,모양약,헛약'],['위양성','거짓양성'],['위음성','거짓음성'],
    ['위중감','위가 답답한 느낌'],['위하수','위처짐'],['유당','젖당'],
    ['유루증','눈물흘림'],['유상물질','기름상태물질'],['유즙루','젖흐름증,유즙분비과다'],
    ['유루','젖흐름증'],['유착','부착,붙음'],['유치','젖니,탈락치아'],
    ['유타증','침과다증'],['유합술','융합,융해,고정술'],
    ['육안으로','눈으로'],['육안','맨눈'],['음위','발기불능/발기부전'],
    ['이구전색','귀지떡,귀지전색'],['이루','귓물'],['이명','귀울림'],
    ['이완되다','풀어지다,느즈러지다,늘어지다'],['이유','젖떼기'],
    ['이인증','자아상실감,자아분리감'],['이절','귀 부스럼증'],
    ['이출혈','귀출혈'],['이통','귀통증'],['이폐색감','귀가 막힌 느낌'],
    ['이폐감','귀가 먹먹한 느낌'],['이하선','귀밑샘'],['이개','귓바퀴'],
    ['이염','귀염'],['인설','비늘,껍질'],['인습성','흡습성'],['인후','목구멍'],
    ['일과성','한번 나타나고 없어지는'],['일광화상','햇볕화상'],
    ['자반','자주색반점'],['자색반','자주색반점'],
    ['자상','찔린상처'],['자창','찔린상처'],['자통','찌르는 것 같은 아픔'],
    ['작열감','화끈감'],['장간막','창자간막'],['장관','창자'],
    ['장중첩','창자겹침증,장겹침증'],['장중적증','장겹침증'],
    ['장폐색증','창자막힘증'],['장염전','창자꼬임'],['장염','창자염'],
    ['저류','고임,쌓임'],['저작운동','씹는운동'],['저작','씹기'],['저해제','억제제'],
    ['전간','뇌전증'],['전기소작','전기지짐'],['전립선','전립샘'],
    ['전박','아래팔'],['전색','혈관막힘'],['전풍','어루러기'],
    ['절상','베인 상처'],['절종증','종기증'],['절창증','종기(증)'],
    ['절증','종기/부스럼'],['점상출혈','출혈점'],
    ['점안','눈에 넣음'],['점이','귀에 넣음'],['점조','끈끈하고 뻑뻑함'],
    ['조갑','손발톱'],['조균증','털곰팡이증'],['조발형','조기발생형'],
    ['조산','조기분만'],['조홍','홍조'],['족배','발등'],
    ['족부백선','발백선증,무좀'],['족장','발바닥'],['족저','발바닥'],
    ['족구','발과 입'],['종격','세로칸'],['종골','발꿈치뼈'],
    ['종창','부기'],['좌골신경염','궁둥이뼈신경염'],['좌상','타박상/멍'],
    ['좌창','여드름'],['면포','여드름'],['주산기','출산전후기'],['중격','사이막'],
    ['중이','가운데귀'],['증량','양을 늘림'],['지둔','매우 우둔'],
    ['지방패드','지방덩이'],['지주막','거미막'],['진경작용','경련멈춤작용'],
    ['진경','경련완화'],['진균','곰팡이'],['진전','떨림'],
    ['착감각','감각이상'],['찰과상','긁힌 상처'],['찰상','긁힌 상처'],
    ['창상봉합','상처꿰맴,상처봉합'],['창상','상처'],
    ['천공','뚫림'],['천명','숨을 쌕쌕거림'],['천문','숫구멍'],
    ['천자통','찌름통증'],['천자','뚫기'],['천포창','물집증'],
    ['체액저류','체액 고임'],['체순환','온몸순환,체순환'],
    ['초발성','처음 발생'],['초발','처음발생'],
    ['초회용량','처음 투여량'],['초회량','처음 복용(사용)량'],['초회통','처음통증'],
    ['최기형성','기형유발성'],['최기형','기형발생'],
    ['치근관','치아뿌리관,치근관'],['치근','치아뿌리'],['치경','잇몸'],
    ['항문누공','항문샛길'],['치루','항문샛길'],['치수','치아속질'],
    ['치아맹출','이돋이,치아맹출'],['치육 비대','잇몸이 붓는 증상'],
    ['치은비후','잇몸이 붓는 증상'],['치은염','잇몸염'],['치육염','잇몸염'],
    ['치조','이틀'],['치주질환','치아주위조직질환'],['치주','치아주위조직'],
    ['침강','가라앉음'],['침흔','주사침 자국'],['카피약','후발약,제네릭의약품'],
    ['타액','침'],['탈감작','과민성 제거,약화'],['토출','구토'],['토혈','혈액구토'],
    ['파탄출혈','파열성 출혈'],['파열','터짐'],['파행증','절뚝거림'],['파행','절뚝거림'],
    ['편평족','평발'],['폐농양','폐고름집'],['폐부전','폐기능 저하'],
    ['포도상구균','포도알균'],['포진','물집'],['표재성','표면에 있는'],
    ['피진','피부 발진'],['피하','피부밑'],
    ['핍뇨증','소변감소증'],['핍정액증','정액저하증'],
    ['하리','설사'],['하수','처짐'],['하악','아래턱'],['하제','설사약'],
    ['하지','다리'],['하퇴궤양','다리종아리궤양'],['한진','땀띠'],
    ['합지증','손발가락붙음증'],['항삼출작용','진물억제작용'],
    ['항성','쉰목소리'],['하성','쉰목소리'],['해소','기침'],
    ['현기증','어지러움'],['현기','어지러움'],['현훈','어지러움'],
    ['현운','현기증,어지러움'],['현성화','겉으로 드러나게'],
    ['혈괴','피덩이'],['혈병퇴축','혈병뒤당김,응혈뒤당김'],
    ['혈전','혈관 막힘'],['혈행역학','혈액동력학,혈류역학'],
    ['호기','날숨'],['호발','자주 발생'],['호전','나아짐'],
    ['호흡완만','느린호흡'],['혼몽','정신이 흐릿하고 가물가물함'],
    ['혼용','섞어씀'],['홍피증','홍색피부증'],['화농','곪음'],
    ['확진','확정 진단'],['환부','질환 부위'],['활액막','윤활막'],['활액','윤활'],
    ['황색시증','노랗게 보이는 병'],['황시','노랗게 보임'],
    ['횡격막','가로막'],['휴약','복용(사용) 중지'],
    ['흉내고민','가슴쓰림'],['흉선','가슴샘'],['흉통','가슴통증'],
    ['흑모설','검은털모양혀'],['흑변','검게 변함'],['흑토증','혈액구토'],
    ['흡기','들숨'],['흡인','빨기'],['희석','묽게 함'],['희치증','치아부족증'],
    ['S상결장','구불결장'],['가역성','회복가능한'],['각막연화증','각막무름증'],
    ['각화','각질화'],['간헐성','시간 간격을 두고 되풀이하여'],['간부전','간기능상실'],
    ['간찰진','피부스침증'],['견비부','어깨와 팔'],['결절','튀어나온 부위'],
    ['경축','경련과 수축이 일어나 수축 상태가 지속되는 현상'],
    ['고투여량','투여량이 많음'],['고함량','많은 함량'],
    ['과호흡','과다호흡'],['국한성','특정 부분에 나타나는'],
    ['굴곡','구부러진'],['근좌상','근육타박상'],
    ['기명력','새롭게 경험한 것을 기억하는 능력'],['기저치','기본값'],
    ['기형발현','기형발생'],['난백','달걀흰자'],
    ['늑간신경통','갈비뼈 사이 신경통'],['단백뇨','단백질이 섞인 오줌'],
    ['반상출혈','피부에 검보랏빛 얼룩점이 생기는 내부출혈'],
    ['반점상','얼룩덜룩한 모양의'],['발포정','물에 녹여 복용하는 알약'],
    ['배농','고름 빼기'],['배뇨곤란','','배뇨(소변을 눔)곤란'],['배뇨','소변을 눔'],['백대하','흰색 질분비물'],
    ['번열','열이 나고 가슴 속이 답답한 증상'],['변잠혈','피섞인 변'],
    ['병변','병에 의한 몸의 변화'],['병중병후','병을 앓는 동안이나 회복 후'],
    ['복통','배아픔'],['산혈증','혈액이 산성화 되는 증상'],
    ['서방형','효과가 지속적으로 나타나는'],['안내압','눈내부 압력'],
    ['암적색','검붉은 색'],['야맹증','밤에 잘 못 보는 증상'],
    ['연소성','어리거나 젊은나이에 나타나는'],['오한','춥고 떨리는 증상'],
    ['요단백','소변에 포함된 단백질'],['요변색','소변색이 변함'],
    ['요침사','소변 침전물 검사'],['용혈성','적혈구 파괴성'],
    ['잔뇨감','소변을 누고난 후에도 다 눈 것 같지 않은 느낌'],
    ['점증투여','점차적으로 늘려 투여하는'],['제증상','여러 증상'],
    ['제질환','여러 질환'],['진해거담제','','진해(기침을 그치게 함)거담제(가래약)'],['진해','기침을 그치게 함'],
    ['특발성','원인 불명의'],['폐색','닫혀서 막힘'],['풍질','신경계 질환'],
    ['항응혈제','혈액응고저지제'],['협착','좁아짐'],
    ['홍반','붉은 반점'],['화상양','불에 덴 듯한 모양'],
    ['황반','피부나 눈 흰자위가 노래짐'],
    ['감작','과민상태로 만듦'],['감정둔마','감정무딤'],
    ['강축증','강직증'],['개존','개방,열린'],['객담','가래'],
    ['거담제','가래약'],['게실','곁주머니'],['격통','심한 고통'],
    ['경결','단단해짐'],['경동맥','목동맥'],
    ['경미한','가벼운,대수롭지 않은'],['경부통','목통증'],
    ['경지증','손발가락경화증'],['경직','굳음'],
    ['경피적','피부경유'],['경피증','피부경화증'],
    ['고령자','노인'],['고미','쓴 맛'],['고식적','임기응변적'],
    ['고정약진','약에 의한 피부발진'],['공수병','물공포증'],
    ['공장','빈창자'],['과산증','위산과다증'],['과이완','심하게 이완됨'],
    ['관침','주사침'],['교상','물린상처'],
    ['구각염','입꼬리염'],['구갈증','목마름증'],['구강','입안'],
    ['구개수','목젖'],['구개','입천장'],['구기','메스꺼움'],
    ['구내염','입안염'],['구내이상감','입안이상감'],['구순건조감','입술건조감'],
    ['구순열','입술갈림증'],['구순염','입술염'],['구순유착증','입술붙음증'],
    ['구취','입냄새'],['굴근','굽힘근육'],['굴염','부비동염'],
    ['균열','갈라짐'],['근경련','근육경련'],['근무력증','근육무력증'],
    ['근병증','근육병증'],['근위부','몸쪽'],['급성동통','급성통증'],
    ['기분변조','기분저하증'],['기왕력','병력'],['기왕증','과거 질병'],
    ['기외수축','조기수축'],['기흉','공기가슴증'],
    ['길항작용','억제작용,대항작용'],['길항제','억제제,대항제'],
    ['나태','게으름'],['난청','귀먹음'],
    ['녹농','푸른 고름'],['누공','샛길'],
    ['누도','눈물길'],['누선염','눈물샘염'],['누안','눈물흘림'],['누액','눈물'],
    ['다맥색','진한 갈색'],['단락술','지름길,지름술,션트,사잇 길'],
    ['단신증','단일신장증'],['단안증','외눈증'],['담객출','가래뱉음'],
    ['담마진','두드러기'],
    ['만곡족','휜발,곤봉발'],['망상적혈구','그물적혈구'],
    ['면정','안면종기'],['무언증','벙어리증'],['무유증','젖마름증'],
    ['무지외반증','엄지발가락가쪽휨증,무지 외반증'],
    ['밀전하여','뚜껑을 꼭 닫아,단단히 마개로 막아'],
    ['반수치사량','반수치사용량'],['반추','되새김'],
    ['배굴','발등굽힘,손등굽힘'],['배담작용','쓸개즙분비작용'],
    ['배부','등'],['변력제','심장근육수축 조절약'],
    ['보장구','장애인 보조기'],['보체고정법','도움체고정법'],
    ['보행','걸음'],['복명','창자 가스소리'],['복부','배부분'],
    ['복수','뱃물'],['복시','겹보임'],['복청','겹듣기'],
    ['본제','이 약'],['봉합','꿰맴'],['부신','콩팥위샘'],
    ['부안검','덧눈꺼풀'],['분무하다','뿌리다'],['분비선','분비샘'],
    ['분시박출량','분당박출량'],['불온','불안감'],
    ['산부','산모'],['살세포','살해세포'],['색륜','시각 달무리'],
    ['선통','쏘는 통증'],['세그먼트','조각,분절,부분,구역'],
    ['세극등','틈새등'],['소구증','작은입증'],
    ['소상','긁어서 생긴 상처'],['소실','없어짐'],['소염제','항염증제,염증약'],
    ['소염','항염'],['소이증','작은귀증'],['소파술','긁어냄(술)'],
    ['속발성','이차,제이'],['속행','계속함'],
    ['수활액낭종','물낭,물주머니'],['수회','여러 차례'],['숙지','자세히 앎'],
    ['순목','눈 깜박거림'],['습윤','습기 참'],['시겔라증','이질'],
    ['시몽감','흐린시력'],['식간에','식사때와 식사때 사이에'],
    ['식체','체함'],['식피창','피부 이식후 생긴 상처'],
    ['알칼로시스','알칼리증'],['암점','시야불능부위'],
    ['압통','누르는 통증'],['애역','딸꾹질'],['양안','두 눈'],
    ['연령','나이'],['연성하감균','무른궤양균'],
    ['위체','체함'],['육안으로','눈으로'],['율속단계','속도결정단계'],
    ['의거하여','따라서,좇아서,근거삼아'],['의주감','스멀거림/개미기는 느낌'],
    ['입상','알갱이모양'],['임신 초삼분기','임신 첫3개월'],
    ['장문합술','장연결(술)'],['장쇄','긴 사슬'],
    ['적자색','붉은 자주색'],['전풍','어루러기'],
    ['제대','탯줄'],['제동맥','탯줄동맥'],
    ['제세동기','잔떨림제거기,제세동기'],['제염','배꼽염'],
    ['조동','된떨림,조동'],['중증','심한 증상'],
    ['증량','양을 늘림'],['척주전만','척주앞굽음증'],
    ['청열','열을 내려줌'],['추벽','주름'],
    ['취한증','땀악취증'],['타제','다른 약'],
    ['보체','도움체,보체'],
    ['가성','거짓'],['가임여성','임신가능성 있는 여성'],
    ['감독','독성을 줄임'],['감량','줄임'],['감미','단맛'],
    ['감신미','달고신맛'],['감약','감소하여 복용(사용)'],
    ['개시투여량','첫 투여량'],['개방동맥관','동맥관 개방증'],
    ['건염','힘줄염'],['건초염','힘줄윤활막염'],['건성안','눈마름'],
    ['건피증','피부건조증'],['결막낭','결막주머니'],['결막하','결막밑'],
    ['결찰술','묶기,묶음술'],['겸자','집게'],
    ['경피적','피부경유'],['공복','빈 속'],
    ['공여부','주는 부위,공여부'],['공여자','주는이,제공자'],
    ['공여','기증,주기,헌혈'],['고부백선','대퇴부백선'],
    ['곤충자상','벌레물린 상처'],
    ['상경적으로','경쟁적으로'],['상순','윗입술'],
    ['상안검','윗눈꺼풀'],['상용','일상적으로 사용'],
    ['상회','웃돎,웃돌다'],
    ['악안면','턱얼굴'],['안각','눈구석'],['안검','눈꺼풀'],
    ['안근','안구근육'],['안면','얼굴'],['안염','눈염증'],
    ['안와','눈주변'],['안저','눈바닥'],['안내','안구내/눈속'],
    ['위양성','거짓양성'],['위음성','거짓음성'],
    ['유즙루','젖흐름증,유즕분비과다'],
    ['전위성','전위,변위'],
    ['조갑주위염','손발톱주위염'],
    ['중이','가운데귀'],
    ['전립선','전립샘'],['췌장','이자'],['치조','이틀'],
    ['직장','곧창자,직장','직장'],['진보','나아짐'],
    ['쌍태','쌍둥이'],
    ['색륜','시각 달무리'],
    ['수의근','맘대로근'],['산미','신 맛'],
    ['역위증','좌우바뀜증'],
    ['이두근','두갈래근'],['이욕','귀를 씻음'],
    ['견통','어깨결림,어깨통증'],
    ['가온','온도를 올림'],['가감','더하거나 줄임'],
    ['비경구','먹는 약이 아닌'],
    ['서방형','효과가 지속적으로 나타나는'],
    ['배뇨','소변을 눔'],['배농','고름 빼기'],
    ['발포정','물에 녹여 복용하는 알약'],
    ['병소','아픈 부위'],['병인','병의 원인'],['병태','병의 상태'],
    ['병합','합침'],
    ['두부단독','머리나 얼굴이 세균 감염 등으로 열이 나고 붉어지며 붓고 아픈 증상'],
    ['맥관석회화','혈관석회화'],['무시','앞이 보이지 않음'],
  ];
  r.sort((a, b) => b[0].length - a[0].length);
  return r;
})();


function renderPrecautions(sections) {
  if (!sections || !sections.length) return '';
  const ts       = 'padding:4px 8px 4px 0;border-bottom:1px solid #f5f5f5;font-size:11px;vertical-align:top;color:#333;';
  const tsIndent = 'padding:4px 8px 4px 18px;border-bottom:1px solid #f5f5f5;font-size:11px;vertical-align:top;color:#333;';
  const STRIP_COND = /\s*\((?:[^)(]|\([^)]*\))*(?:함유\s?제제|미함유[^)]*|에\s*한함|어린이의?\s*용법[·・]?용량이?\s*있는\s*경우|어린이에\s*대한\s*용법이\s*있는\s*경우)(?:[^)(]|\([^)]*\))*\)\??/g;
  const copyLines = [];
  sections.forEach((sec, si) => {
    copyLines.push(`\n${si + 1}. ${sec.label}`);
    sec.items.forEach((it) => {
      if (it.text && it.text.includes('<삭제>')) return;
      if (it.sub) copyLines.push(`[${it.sub}]`);
      const clean = applyEasyTerms(removeEditorial(it.text).replace(STRIP_COND, '').trim());
      if (it.isMapping || it.indent) {
        copyLines.push(`   ${clean}`);
      } else if (it.circled) {
        copyLines.push(clean);
      } else {
        copyLines.push(`${it.displayNum}) ${clean}`);
      }
    });
  });
  window.__precCopyText = copyLines.join('\n').trim();
  const sectHtml = sections.map((sec, secIdx) => {
    let prevSub = null;
    const rows = sec.items.filter(it => !(it.text && it.text.includes('<삭제>'))).map((it) => {
      const subHdr = (it.sub && it.sub !== prevSub)
        ? `<tr><td style="padding:4px 0 2px;font-size:11px;font-weight:700;color:#666;letter-spacing:0.04em;">${esc(it.sub)}</td></tr>`
        : '';
      prevSub = it.sub;
      const cleanText = applyEasyTerms(removeEditorial(it.text).replace(STRIP_COND, '').trim());
      const extraStyle = it.isDirective ? 'background:#FFF3E0;' : '';
      const badge = it.isDirective
        ? `<span style="font-size:11px;color:#E65100;margin-left:5px;font-style:italic;white-space:nowrap;">[변경지시]</span>`
        : '';
      if (it.isMapping || it.indent) {
        return `${subHdr}<tr><td style="${tsIndent}${extraStyle}">${esc(cleanText).replace(/\n/g,'<br>')}${badge}</td></tr>`;
      }
      if (it.circled) {
        return `${subHdr}<tr><td style="${ts}${extraStyle}">${esc(cleanText).replace(/\n/g,'<br>')}${badge}</td></tr>`;
      }
      return `${subHdr}<tr><td style="${ts}${extraStyle}">${it.displayNum}) ${esc(cleanText).replace(/\n/g,'<br>')}${badge}</td></tr>`;
    }).join('');
    return `<div style="margin-bottom:12px;">
      <div style="font-size:12px;font-weight:600;color:var(--obsidian);padding:3px 0 5px;border-bottom:1px solid var(--hairline);margin-bottom:3px;">${secIdx + 1}. ${esc(sec.label)}</div>
      <table style="width:100%;border-collapse:collapse;"><tbody>${rows}</tbody></table>
    </div>`;
  }).join('');
  // 다섯 절을 통째로 접는다 — 결과 화면이 세로로 너무 길어지지 않게.
  return `<div class="res-doc">
    <div class="res-doc-head">
      <span class="res-sec-title">[사용상의 주의사항]</span>
      ${resCopyBtn('__precCopyText')}
    </div>
    <details class="fold">
      <summary>전체 5개 항목 보기</summary>
      <div class="fold-body">${sectHtml}</div>
    </details>
  </div>`;
}

function generateWordDoc() {
  const params = window.__lastPrecParams;
  if (!params) { alert('먼저 검증을 실행하세요.'); return; }
  const { chapterKey, form, activeRows, selectedExcipients: excList, doseRows } = params;

  const chData = DB[chapterKey];
  if (!chData || !chData['사용상의_주의사항']) return;
  const prec    = chData['사용상의_주의사항'];
  const ctx     = buildPrecautionCtx(chapterKey, form, activeRows, doseRows);
  const fnMaps  = prec?.['각주_맵'] || {};   // 섹션별 인라인 각주 성분명 맵

  // Build displayedMap: cat -> Set<origIdx>
  const sections = generatePrecautions(chapterKey, form, activeRows, excList, doseRows);
  const displayedMap = new Map();
  if (sections) {
    sections.forEach(sec => {
      if (!displayedMap.has(sec.cat)) displayedMap.set(sec.cat, new Set());
      sec.items.forEach(it => displayedMap.get(sec.cat).add(it.origIdx));
    });
  }

  const CAT_LABELS = [
    ['경고',                 '경고'],
    ['복용하지_말_것',       '다음과 같은 사람은 이 약을 복용하지 말 것'],
    ['병용금기',             '이 약을 복용하는 동안 다음의 약을 복용하지 말 것'],
    ['복용전_상의',          '다음과 같은 사람(경우)은 이 약을 복용하기 전에 의사, 치과의사, 약사와 상의할 것.'],
    ['이상반응_및_즉각중지', '다음과 같은 경우 이 약의 복용을 즉각 중지하고 의사, 치과의사, 약사와 상의할 것. 상담 시 가능한 한 이 첨부문서를 소지할 것.'],
    ['기타주의사항',         '기타 주의사항'],
    ['소아투여',             '소아에 대한 투여'],
    ['임부수유부투여',       '임부 및 수유부에 대한 투여'],
    ['복용시_주의',          '기타 이 약의 복용 시 주의할 사항'],
    ['저장상의_주의',        '저장상의 주의사항'],
  ];

  const HL  = 'background:#FFFF00;';
  const DIM = 'color:#aaa;';
  const BASE = 'font-size:11pt;margin:0;padding:2pt 0;line-height:1.6;';
  const INDENT = 'padding-left:20pt;';

  let body = '';
  const ingrNames = activeRows.map(r => r.ingr).join(', ');
  body += `<p style="font-size:11pt;margin-bottom:6pt;"><b>선택 성분:</b> ${ingrNames} &nbsp;|&nbsp; <b>제형:</b> ${form}</p>`;
  body += `<p style="font-size:10pt;color:#666;margin-bottom:14pt;">※ 노란색 하이라이트: 해당 성분에 적용되는 항목 &nbsp;/&nbsp; 회색: 미적용 항목</p>`;

  let secNum = 1;
  let commentDefs = '';
  let commentSeq = 0;
  for (const [cat, label] of CAT_LABELS) {
    const hasDbCat = cat in prec;
    const excItemsInCat = (excList || []).some(n => (EXCIPIENT_PREC_DB[n] || {})[cat]);
    const dirItemsInCat = (sections || []).find(s => s.cat === cat)?.items.filter(it => it.isDirective) || [];
    if (!hasDbCat && !excItemsInCat && !dirItemsInCat.length) continue;
    const dispSet = displayedMap.get(cat) || new Set();
    const fnMap   = fnMaps[cat] || null;   // 이 섹션의 각주 성분명 맵
    body += `<p style="font-size:12pt;font-weight:bold;color:#b71c1c;margin-top:14pt;margin-bottom:4pt;">${secNum++}. ${label}</p>`;

    let dispNum = 0;
    if (hasDbCat && cat === '이상반응_및_즉각중지' && prec['이상반응_성분매핑']) {
      const advArr = prec[cat];
      const mapping = prec['이상반응_성분매핑'];

      // Split advArr[0] into header + individual entry lines
      const rawLines = advArr[0].split('\n').filter(l => l.trim());
      const headerLine = rawLines[0];
      const contentLines = rawLines.slice(1);

      body += `<p style="${BASE}">${esc(_stripInlineMarkers(headerLine))}</p>`;

      // Each content line matched sequentially to its mapping entry for per-line highlight
      contentLines.forEach((line, idx) => {
        const entry = mapping[idx];
        const isActive = entry ? ctx.classes.has(entry.class) : false;
        if (isActive) {
          // 활성: 문단 전체 HL + 비활성 조건 단어만 white로 덮어씌움
          body += `<p style="${BASE + INDENT + HL}">${_renderPrecWithInlineHL(line, ctx, HL, fnMap, true)}</p>`;
        } else {
          body += `<p style="${BASE + INDENT + DIM}">${esc(_stripInlineMarkers(line))}</p>`;
        }
      });

      // Regular advArr items (index 1+)
      for (let i = 1; i < advArr.length; i++) {
        const disp = dispSet.has(i);
        body += `<p style="${BASE + (disp ? '' : DIM)}">${i}) ${esc(_stripInlineMarkers(advArr[i]))}</p>`;
      }
    } else if (hasDbCat) {
      const flatItems = _flattenPrecItems(cat, prec[cat]);
      flatItems.forEach((item, i) => {
        const isIndent = !!item.indent;
        const isCircled = !!item.circled;
        if (!isIndent && !isCircled) dispNum++;
        const displayed = dispSet.has(i);
        const baseS = BASE + (isIndent ? INDENT : '');
        const prefix = (isIndent || isCircled) ? '' : `${dispNum}) `;
        if (displayed) {
          // 활성: 문단 전체 HL + [[...]] 마커 있으면 비활성 단어만 white로 덮어씌움
          // 각주 정의 라인(\n1)함유제제...)은 화면에 표시하지 않음 — 워드 좌측(기준)열에만 표시
          body += `<p style="${baseS + HL}">${prefix}${_renderPrecWithInlineHL(_stripFootnoteLines(item.text), ctx, HL, fnMap, true)}</p>`;
        } else {
          body += `<p style="${baseS + DIM}">${prefix}${esc(_stripInlineMarkers(_stripFootnoteLines(item.text))).replace(/\n/g,'<br>')}</p>`;
        }
      });
    }
    // 변경지시 추가 항목
    if (dirItemsInCat.length) {
      body += `<p style="font-size:9pt;color:#E65100;margin:6pt 0 2pt;font-style:italic;">[품목허가사항 변경지시 추가 문구]</p>`;
      dirItemsInCat.forEach((it) => {
        const cmtId = `cmt${++commentSeq}`;
        const cmtRef = `<span style="mso-comment-reference:${cmtId};mso-comment-date:20240101T000000"><span style="mso-special-character:comment"> </span></span>`;
        body += `<p style="${BASE}background:#FFF3E0;">${it.displayNum}) ${it.text}${cmtRef}</p>`;
        commentDefs += `<div style="mso-element:comment" id="${cmtId}"><p class="MsoNormal" style="font-size:9pt;font-family:&apos;맑은 고딕&apos;,sans-serif;"><b>기재 사유:</b> ${it.citation}</p></div>`;
      });
    }

    // 첨가제 추가 항목 (항상 하이라이팅)
    if (excList && excList.length) {
      for (const excName of excList) {
        const excItems = (EXCIPIENT_PREC_DB[excName] || {})[cat];
        if (!excItems) continue;
        body += `<p style="font-size:9pt;color:#1565c0;margin:3pt 0 1pt;font-style:italic;">[첨가제: ${excName}]</p>`;
        excItems.forEach(text => {
          body += `<p style="${BASE + HL}">${++dispNum}) ${text}</p>`;
        });
      }
    }
  }

  const commentListHtml = commentDefs
    ? `<div style="mso-element:comment-list">${commentDefs}</div>`
    : '';
  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset="UTF-8"><title>사용상의 주의사항 원본</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:TrackChanges/></w:WordDocument></xml><![endif]-->
<style>body{font-family:'맑은 고딕',Arial,sans-serif;margin:2cm;}p{margin:0;padding:2pt 0;}.MsoCommentText{font-size:9pt;font-family:'맑은 고딕',sans-serif;}</style>
</head><body>
<h2 style="font-size:14pt;color:#b71c1c;margin-bottom:10pt;">사용상의 주의사항 (원본 전체)</h2>
${body}
${commentListHtml}</body></html>`;

  const blob = new Blob(['﻿' + html], { type: 'application/msword;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `사용상주의사항_원본_${chapterKey}_${new Date().toISOString().slice(0,10)}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ════════════════════════════════════════════════════════════════════
// 2. 기준 적합여부 섹션 (배합량 표 전체 이후 1회 표시)
// ════════════════════════════════════════════════════════════════════
function renderCriteriaSection(chapterKey, validations, allDosageRows) {
  if (!validations.length) return '';

  if (chapterKey === '제2장_해열진통제') {
    const allVpairs = allDosageRows.map((dr, i) => ({ dr, v: validations[i] })).filter(x => x.v);
    const { kindsSt, amtsSt } = computeCh2KindsAmtsStatus(allVpairs);
    const kindsDb = DB['제2장_해열진통제']?.['기준']?.['유효성분의_종류'] ?? [];
    const amtsDb  = DB['제2장_해열진통제']?.['기준']?.['유효성분의_분량'] ?? [];

    const { ruleErrors } = validations[0];
    const maxFreqAll = Math.max(...allDosageRows.map(dr => dr.freqMax));
    const aspirinFail = allVpairs.some(({ v }) => v.ruleErrors.some(r => r.key === '아스피린계 연령' && r.ok === false));
    const aspirinReason = allVpairs.flatMap(({ v }) => v.ruleErrors.filter(r => r.key === '아스피린계 연령' && r.ok === false).map(r => r.reason)).join('; ');

    const td = 'padding:4px 8px;border:1px solid #dde3ef;font-size:11px;';
    const thd = td + 'font-weight:700;background:#f7f9fc;';

    const mkRow = (num, label, st) => {
      const mark  = st.na ? '—' : (st.ok ? 'O' : 'X');
      const color = st.na ? '#aaa' : (st.ok ? '#2e7d32' : '#c62828');
      const bg    = resRowBg(st.na ? null : st.ok);
      const reasonHtml = (!st.na && !st.ok && st.reason) ? `<br><span style="color:#c62828;font-size:11px;">↳ ${esc(st.reason)}</span>` : '';
      return `<tr style="background:${bg};">
        <td style="${td}text-align:center;white-space:nowrap;color:#666;">${esc(num)}</td>
        <td style="${td}">${esc(label)}${reasonHtml}</td>
        <td style="${td}text-align:center;font-weight:700;font-size:13px;color:${color};">${mark}</td>
      </tr>`;
    };

    // 유효성분의_종류 rows
    const kindsRows = kindsDb.map((item, i) => {
      const st = kindsSt[i] ?? { ok: null, na: true, reason: '' };
      return mkRow(`${i+1}`, item, st);
    }).join('');

    // 유효성분의_분량 rows
    const amtsRows = amtsDb.map((item, i) => {
      const st = amtsSt[i] ?? { ok: null, na: true, reason: '' };
      return mkRow(`${i+1}`, item, st);
    }).join('');

    // 기타 기준 rows
    const extraRows = [
      mkRow('용법용량', '용법용량은 1일 1~3회까지로 한다.',
            { ok: maxFreqAll <= 3, na: false,
              reason: maxFreqAll <= 3 ? '' : `입력된 1일 최대 ${maxFreqAll}회 — 허용 범위(1~3회) 초과` }),
      ...(aspirinFail || allVpairs.some(({ v }) => v.ruleErrors.some(r => r.key === '아스피린계 연령'))
        ? [mkRow('아스피린 연령', '아스피린/아스피린알루미늄/살리실산나트륨/히드로탈시트는 만 15세 미만 사용 불가',
                 { ok: !aspirinFail, na: false, reason: aspirinFail ? aspirinReason : '' })]
        : []),
    ].join('');

    const tableHtml = (rows) => `
      <table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
        <thead><tr>
          <th style="${thd}width:5%;text-align:center;">번호</th>
          <th style="${thd}">기준 내용</th>
          <th style="${thd}width:7%;text-align:center;white-space:nowrap;">적합<br>여부</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;

    return `<div style="margin-bottom:14px;padding:10px 14px;background:var(--white);box-shadow:var(--ring2);border-radius:var(--r);">
      <div style="font-size:12px;font-weight:600;color:var(--obsidian);margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--hairline);">2. 기준 적합여부</div>
      <div style="font-size:11px;font-weight:600;color:var(--charcoal);margin-bottom:3px;">▸ 유효성분의 종류</div>
      ${kindsDb.length ? tableHtml(kindsRows) : '<p style="color:var(--graphite);font-size:11px;">DB 데이터 없음</p>'}
      <div style="font-size:11px;font-weight:600;color:var(--charcoal);margin:6px 0 3px;">▸ 유효성분의 분량</div>
      ${amtsDb.length ? tableHtml(amtsRows) : '<p style="color:var(--graphite);font-size:11px;">DB 데이터 없음</p>'}
      <div style="font-size:11px;font-weight:600;color:var(--charcoal);margin:6px 0 3px;">▸ 기타 기준</div>
      ${tableHtml(extraRows)}
    </div>`;
  }

  return '';
}

// ════════════════════════════════════════════════════════════════════
// 검토 실행
// ════════════════════════════════════════════════════════════════════
function renderAgeHeader(dr) {
  const unitDisplay = dosageUnit || '정';
  const freqStr = dr.freqMin === dr.freqMax ? `${dr.freqMax}회` : `${dr.freqMin}~${dr.freqMax}회`;
  const amtStr  = dr.amtMin  === dr.amtMax  ? `${dr.amtMax}${unitDisplay}` : `${dr.amtMin}~${dr.amtMax}${unitDisplay}`;
  return `<div style="margin-top:14px;margin-bottom:4px;padding:6px 10px;background:var(--std-head);color:var(--std-head-fg);
    border-radius:var(--r);font-size:11px;font-weight:500;">
    ▸ ${esc(displayAgeLabel(dr.age, currentKey, currentForm) || '연령 미선택')} &nbsp;|&nbsp; 1일 ${esc(freqStr)}, 1회 ${esc(amtStr)}
  </div>`;
}

function runValidation() {
  const ch   = chaptersMap[currentKey];
  const form = $('sel-dosage-form').value;
  const body = $('results-body');

  if (!ch)   { setStatus('장을 선택하세요', 'error'); return; }
  if (!form) { setStatus('제형을 선택하세요', 'error'); return; }

  // 못 쓰는 배합량(음수·문자)이 하나라도 있으면 검토하지 않는다.
  // 그냥 넘기면 그 성분이 결과에서 통째로 빠지고 "적합"이 나온다.
  if (typeof badDoseRows === 'function') {
    const bad = badDoseRows();
    if (bad.length) {
      const names = bad.slice(0, 3).map(r => r.ingr).filter(Boolean).join(', ');
      setStatus(`배합량을 확인하세요 — ${names}${bad.length > 3 ? ` 외 ${bad.length - 3}건` : ''} (0보다 큰 숫자만 넣을 수 있습니다)`, 'error');
      const first = document.querySelector('.mx-dose-input.is-bad');
      if (first) { first.scrollIntoView({ block: 'center' }); first.focus(); }
      return;
    }
  }

  const validDosageRows = dosageRows.filter(dr => dr.age);
  if (!validDosageRows.length) { setStatus('연령을 1개 이상 선택하세요', 'error'); return; }

  /* 범위가 거꾸로 든 행(1회 2~1캡슐)은 검토하지 않는다.
     화면에서 자동으로 바로잡지만, 저장해 둔 옛 제품을 불러오면
     뒤집힌 값이 그대로 들어올 수 있다. 그대로 계산하면 최대·최소
     기준이 서로 바뀌어 엉뚱하게 "적합"이 나온다. */
  const flipped = validDosageRows.filter(dr =>
    (dr.freqMin > dr.freqMax) || (dr.amtMin > dr.amtMax));
  if (flipped.length) {
    const d = flipped[0];
    const what = d.freqMin > d.freqMax
      ? `1일 ${d.freqMin}~${d.freqMax}회`
      : `1회 ${d.amtMin}~${d.amtMax}${typeof dosageUnit !== 'undefined' ? dosageUnit : ''}`;
    setStatus(`용법용량 범위가 거꾸로입니다 — ${d.age} ${what} (앞이 뒤보다 클 수 없습니다)`, 'error');
    return;
  }

  const activeRows = currentKey === '제1장_비타민미네랄' ? getCh1ActiveRows()
                   : isMatrixMode() ? getMatrixActiveRows()
                   : ingredientRows.filter(r => r.ingr && r.dose);
  if (!activeRows.length) { setStatus('성분과 배합량을 입력하세요', 'error'); return; }

  // 입력 검증을 통과한 시점에 결과 패널을 펼친다
  setResultsCollapsed(false);

  let html = '';
  let anyFail = false;
  const validations = []; // 연령별 검증 결과 수집 (기준 섹션·전체판정용)

  // ── 연령별 배합량 판정 표 (전 장 공통) ──
  // 좌측 입력 패널의 표는 편집용 실시간 화면이고, 우측 결과 패널의 표는
  // 검토 결과 기록(캡처·공유용)이므로 두 곳 모두에 표시한다.
  for (const dr of validDosageRows) {
    const dosage = { freqMin: dr.freqMin, freqMax: dr.freqMax,
                     amtMin: dr.amtMin,   amtMax: dr.amtMax, unit: dosageUnit };

    if (currentKey === '제1장_비타민미네랄') {
      if (validDosageRows.length > 1) html += renderAgeHeader(dr);
      const v = validateChapter1(DB['제1장_비타민미네랄']['표'], form, dr.age, activeRows, dosage);
      /* ok 는 셋이다 — true(적합) · false(부적합) · null(판정 못 함).
         "부적합만 아니면 적합"(ok !== false)으로 보면 판정하지 못한 성분이
         있어도 "기준에 맞습니다"가 뜬다. 표에 없는 성분을 직접 넣었을 때
         실제로 그랬다. 전체 적합은 "확인한 것만"(ok === true)으로 따진다.
         ruleErrors 는 위반만 담기므로 종전대로 !== false 로 본다. */
      if (!v.itemResults.every(r => r.ok === true) || !v.sumResults.every(r => r.ok !== false))
        anyFail = true;
      html += renderChapter1Results(v, form, dr.age);
      validations.push(v);
    } else if (currentKey === '제2장_해열진통제') {
      if (validDosageRows.length > 1) html += renderAgeHeader(dr);
      const v = validateChapter2(DB['제2장_해열진통제']['표'], form, dr.age, activeRows, dosage);
      if (!v.itemResults.every(r => r.ok === true) || !v.ruleErrors.every(r => r.ok !== false))
        anyFail = true;
      html += renderChapter2Results(v, form, dr.age);
      validations.push(v);
    } else if (currentKey === '제3장_감기약') {
      if (validDosageRows.length > 1) html += renderAgeHeader(dr);
      const v = validateChapter3(DB['제3장_감기약']['표'], form, dr.age, activeRows, dosage);
      if (!v.itemResults.every(r => r.ok === true) || !v.ruleErrors.every(r => r.ok !== false))
        anyFail = true;
      html += renderChapter3Results(v, form, dr.age);
      validations.push(v);
    } else if (currentKey === '제7장_진해거담제') {
      if (validDosageRows.length > 1) html += renderAgeHeader(dr);
      const v = validateChapter7(DB['제7장_진해거담제']['표'], form, dr.age, activeRows, dosage);
      if (!v.itemResults.every(r => r.ok === true) || !v.ruleErrors.every(r => r.ok !== false))
        anyFail = true;
      html += renderChapter7Results(v, form, dr.age);
      validations.push(v);
    } else if (currentKey === '제9장_비염용경구제') {
      if (validDosageRows.length > 1) html += renderAgeHeader(dr);
      const v = validateChapter9(DB['제9장_비염용경구제']['표'], form, dr.age, activeRows, dosage);
      if (!v.itemResults.every(r => r.ok === true) || !v.ruleErrors.every(r => r.ok !== false))
        anyFail = true;
      html += renderChapter9Results(v, form, dr.age);
      validations.push(v);
    }
  }

  // ── 2. 기준 적합여부 (배합량 표 전체 이후 1회) ──
  html += renderCriteriaSection(currentKey, validations, validDosageRows);

  // ── 효능효과·사용상주의사항 (연령과 무관하므로 1회만 표시) ──
  const refDr = validDosageRows[0];
  const refDosage = { freqMin: refDr.freqMin, freqMax: refDr.freqMax,
                      amtMin: refDr.amtMin,   amtMax: refDr.amtMax };
  const effResult  = generateEfficacy(currentKey, form, activeRows, refDosage);
  const precResult = generatePrecautions(currentKey, form, activeRows, selectedExcipients, dosageRows);
  if (typeof renderDosageDoc === 'function') html += renderDosageDoc(currentKey, validDosageRows, form);
  if (effResult)  html += renderEfficacy(effResult);
  if (precResult) html += renderPrecautions(precResult);

  body.innerHTML = html || '<div class="empty-state"><span>결과 없음</span></div>';
  if (typeof collapseResultTables === 'function') collapseResultTables(body);
  /* 용법용량이 아직 기본값(허가목록에 용법이 없어 임시로 넣은 값)이면,
     그 값으로 나온 부적합은 이 제품의 부적합이 아니다. 실제 용법을 넣기
     전까지는 "부적합"이라고 단정하지 않고 확인을 요청한다. */
  const usingDefaultDose = (typeof doseIsDefault !== 'undefined') && doseIsDefault;
  if (anyFail && usingDefaultDose) {
    setStatus('⚠️ 용법용량 확인 필요 — 실제 용법을 넣어야 판정할 수 있습니다', 'warn');
  } else {
    setStatus(anyFail ? '❌ 부적합 항목 있음' : '✅ 검토 완료 — 적합', anyFail ? 'error' : 'ok');
  }
}

// ════════════════════════════════════════════════════════════════════
// 최종 Word 파일 다운로드 (표준제조기준 비교표)
// ════════════════════════════════════════════════════════════════════
function buildCriteriaRows(chapterKey, allValidations) {
  if (!allValidations.length) return [];
  const v0 = allValidations[0].v;
  if (chapterKey === '제2장_해열진통제') {
    const { ruleErrors, propResult } = v0;
    const maxFreqAll = Math.max(...allValidations.map(({ dr }) => dr.freqMax));
    const isOk = key => !ruleErrors.some(r => r.key === key && r.ok === false);
    const getReason = key => (ruleErrors.find(r => r.key === key) || {}).reason || '';
    return [
      { num: '(1)②', ok: isOk('필수 성분 누락'), na: false, reason: getReason('필수 성분 누락'),
        label: '배합하지 않으면 안되는 유효성분은 Ⅰ항과 Ⅱ항 성분 중 1종 이상으로 한다.' },
      { num: '(1)④', ok: isOk('Ⅲ항 초과'), na: false, reason: getReason('Ⅲ항 초과'),
        label: 'Ⅲ항의 유효성분을 배합하는 경우는 Ⅲ항의 유효성분 중 1종만 배합한다.' },
      { num: '(1)⑤', ok: isOk('Ⅱ항+Ⅰ항 배합 금지'), na: false, reason: getReason('Ⅱ항+Ⅰ항 배합 금지'),
        label: 'Ⅱ항의 성분인 이부프로펜은 Ⅰ항의 성분과 배합하지 않는다.' },
      { num: '(2)⑤', ok: propResult ? propResult.ok : null, na: propResult == null,
        reason: propResult ? propResult.reason : '',
        label: 'Ⅰ항 2종이상 배합 시 각 성분을 각각 1회 최대분량으로 나누어 얻은 수치의 합이 1/2이상, 3/2이하' },
      { num: '④', ok: maxFreqAll <= 3, na: false,
        reason: maxFreqAll <= 3 ? '' : `입력된 1일 최대 ${maxFreqAll}회 — 허용 범위(1~3회) 초과`,
        label: '용법용량은 1일 1~3회까지로 한다.' },
    ];
  }
  const ruleErrors = v0.ruleErrors || [];
  return ruleErrors.map((e, i) => ({
    num: `(${i + 1})`, ok: e.ok !== false, na: e.ok === null,
    reason: e.ok === false ? e.reason : '', label: e.key,
  }));
}

// ── ch2 유효성분의 종류/분량 기준 O/X 계산 ──────────────────────────────
// allVpairs: [{dr, v}, ...] (validateChapter2 결과 + 해당 dosageRow)
function computeCh2KindsAmtsStatus(allVpairs) {
  if (!allVpairs.length) return { kindsSt: [], amtsSt: [] };
  const v0   = allVpairs[0].v;
  const { ruleErrors, propResult } = v0;
  const ir0  = v0.itemResults;
  const isOk = key => !ruleErrors.some(r => r.key === key && r.ok === false);
  const getReason = key => (ruleErrors.find(r => r.key === key) || {}).reason || '';

  // 유효성분의 종류 (5 items) — 규칙은 연령 무관, allVpairs[0] 기준
  const unknownIngr = ir0.filter(r => r.ok === null);
  const kindsSt = [
    { ok: unknownIngr.length === 0, na: false,
      reason: unknownIngr.length ? unknownIngr.map(r => `${r.ingr}: 표1·표2 미등재`).join('; ') : '' },
    { ok: isOk('필수 성분 누락'),      na: false, reason: getReason('필수 성분 누락') },
    { ok: isOk('Ⅰ항 초과'),           na: false, reason: getReason('Ⅰ항 초과') },
    { ok: isOk('Ⅲ항 초과'),           na: false, reason: getReason('Ⅲ항 초과') },
    { ok: isOk('Ⅱ항+Ⅰ항 배합 금지'), na: false, reason: getReason('Ⅱ항+Ⅰ항 배합 금지') },
  ];

  // 유효성분의 분량 (6 items) — 전체 연령 중 가장 엄격한 결과(worst-case)
  const anyFail = pred => allVpairs.some(({ v }) => v.itemResults.some(pred));
  const grup1n  = ir0.filter(r => r.gubun === 'Ⅰ항').length;
  const grup3n  = ir0.filter(r => r.gubun === 'Ⅲ항').length;
  const grup5n  = ir0.filter(r => r.gubun === 'Ⅴ항').length;
  const grp2n   = ir0.filter(r => r.gubun === '표2 Ⅰ항').length;
  const allProp = allVpairs.map(({ v }) => v.propResult).filter(Boolean);

  // item1: 1회/1일 최대분량 이하
  const ok1 = !anyFail(r => r.ok === false && r.reason?.includes('최대 초과'));
  const fail1 = [];
  allVpairs.forEach(({ dr, v }) => {
    const al = displayAgeLabel(dr.age, '제2장_해열진통제', currentForm) || dr.age;
    v.itemResults.filter(r => r.ok === false && r.reason?.includes('최대 초과'))
                 .forEach(r => fail1.push(`${r.ingr}(${al}): ${r.reason}`));
  });

  // item2: Ⅰ항 1종 배합 시 1/2 하한 (NA if Ⅰ항이 없거나 2종이상, 또는 Ⅲ항 있음)
  const it2na = grup1n === 0 || grup1n >= 2 || grup3n >= 1;
  const ok2   = it2na ? null : !anyFail(r => r.gubun === 'Ⅰ항' && r.ok === false && r.reason?.includes('1/2'));

  // item3: Ⅰ항 2종이상/Ⅲ항 시 1/5 하한 (NA if 해당 구성 없음)
  const it3na = grup1n < 2 && grup3n === 0;
  const ok3   = it3na ? null : !anyFail(r => (r.gubun === 'Ⅰ항' || r.gubun === 'Ⅲ항') && r.ok === false && r.reason?.includes('1/5'));

  // item4: Ⅴ항 1/15 하한 (NA if Ⅴ항 없음)
  const it4na = grup5n === 0;
  const ok4   = it4na ? null : !anyFail(r => r.gubun === 'Ⅴ항' && r.ok === false && r.reason?.includes('1/15'));

  // item5: Ⅰ항 2종이상 비례배합 (NA if 적용 안됨)
  const it5na = allProp.length === 0;
  /* 합산비를 못 센 연령이 하나라도 있으면 판정하지 않는다 (ok:null).
     못 센 채로 "적합"이라 하면 기준을 넘은 제품이 통과한다. */
  const prop5Hold = allProp.some(p => p.ok === null);
  const ok5   = (it5na || prop5Hold) ? null : allProp.every(p => p.ok === true);
  const fail5 = (allProp.find(p => p.ok === null) || allProp.find(p => p.ok === false))?.reason || '';

  // item6: 표2 성분 1/10 하한 (NA if 표2 성분 없음)
  const it6na = grp2n === 0;
  const ok6   = it6na ? null : !anyFail(r => r.gubun === '표2 Ⅰ항' && r.ok === false);

  const amtsSt = [
    { ok: ok1, na: false,  reason: ok1   ? '' : fail1.join('; ') || '최대분량 초과' },
    { ok: ok2, na: it2na,  reason: ok2 === false ? 'Ⅰ항 1종 배합: 1/2 하한 미달' : '' },
    { ok: ok3, na: it3na,  reason: ok3 === false ? 'Ⅰ항 2종이상/Ⅲ항: 1/5 하한 미달' : '' },
    { ok: ok4, na: it4na,  reason: ok4 === false ? 'Ⅴ항: 1/15 하한 미달' : '' },
    { ok: ok5, na: it5na,  reason: ok5 === false ? fail5 : '' },
    { ok: ok6, na: it6na,  reason: ok6 === false ? '표2 성분 1일 하한(1/10) 미달' : '' },
  ];
  return { kindsSt, amtsSt };
}

/* [사용상의 주의사항] 2열 대조표 — 좌: 표제기 원문(해당 부분 노랑), 우: 이 제품 문구.
   제1·2·3·7·9장이 모두 같은 표를 쓴다. 예전에는 장마다 이 100여 줄이
   변수 이름만 바꿔 복사돼 있어서, 한 곳을 고치면 다른 장은 그대로 남았다. */
function _wordPrecautionSection(opts) {
  const { chapterKey, form, activeRows, doseRows, precSections,
          productName, FN, TH, TD, HL, DIM } = opts;

  const CAT_LABELS = [
    ['경고',                 '1.  경고'],
    ['복용하지_말_것',       '2.  다음과 같은 사람은 이 약을 복용하지 말 것.'],
    ['병용금기',             '3.  이 약을 복용하는 동안 다음의 약을 복용하지 말 것.'],
    ['복용전_상의',          '5.  다음과 같은 사람은 이 약을 복용하기 전에 의사, 치과의사, 약사와 상의 할 것.'],
    ['이상반응_및_즉각중지', '6.  다음과 같은 경우 이 약의 복용을 즉각 중지하고 의사, 치과의사, 약사와 상의할 것. 상담 시 가능한 한 이 첨부문서를 소지할 것.'],
    ['소아투여',             '7.  소아에 대한 투여'],
    ['임부수유부투여',       '임부 및 수유부에 대한 투여'],
    ['복용시_주의',          '8.  기타 이 약의 복용 시 주의할 사항'],
    ['저장상의_주의',        '9.  저장상의 주의사항'],
  ];

  let out = '';
  out += `<p>&nbsp;</p><p>&nbsp;</p>`;
  out += `<p class="sec-head" style="${FN}font-size:11pt;font-weight:bold;color:#1a4b8c;margin:16pt 0 5pt;line-height:1.3;">[사용상의 주의사항] <span style="${FN}font-size:9pt;font-weight:normal;color:#555;">(해당 부분 하이라이트)</span></p>`;
  out += `<table class="tall-rows" style="width:100%;border-collapse:collapse;margin-bottom:12pt;"><thead><tr>`;
  out += `<th style="${TH}width:50%;">의약품 표준제조기준</th>`;
  out += `<th style="${TH}width:50%;">${esc(productName)}</th>`;
  out += `</tr></thead><tbody>`;

  const prec    = DB[chapterKey]?.['사용상의_주의사항'];
  const ctx     = prec ? buildPrecautionCtx(chapterKey, form, activeRows, doseRows) : null;
  const fnMaps  = prec?.['각주_맵'] || {};
  const dispMap = new Map();
  if (precSections) {
    precSections.forEach(sec => {
      if (!dispMap.has(sec.cat)) dispMap.set(sec.cat, new Set());
      sec.items.forEach(it => dispMap.get(sec.cat).add(it.origIdx));
    });
  }

  let rSecNum = 0;
  for (const [cat, label] of CAT_LABELS) {
    const hasDbCat = prec && cat in prec;
    const excInCat = (selectedExcipients || []).some(n => (EXCIPIENT_PREC_DB[n] || {})[cat]);
    const dirInCat = (precSections || []).find(s => s.cat === cat)?.items.filter(it => it.isDirective) || [];
    if (!hasDbCat && !excInCat && !dirInCat.length) continue;

    const dispSet = dispMap.get(cat) || new Set();
    const fnMap   = fnMaps[cat] || null;
    let lH = `<p style="margin:0 0 4pt;font-weight:bold;font-size:10pt;">${esc(label)}</p>`;
    const rItems = [];
    let dNum = 0;

    if (hasDbCat && cat === '이상반응_및_즉각중지' && prec['이상반응_성분매핑']) {
      const advArr   = prec[cat];
      const mapping  = prec['이상반응_성분매핑'];
      const rawLines = advArr[0].split('\n').filter(l => l.trim());
      lH += `<p style="margin:0 0 2pt;">${esc(_stripInlineMarkers(rawLines[0]))}</p>`;
      rawLines.slice(1).forEach((line, idx) => {
        const entry    = mapping[idx];
        const isActive = entry ? ctx.classes.has(entry.class) : false;
        if (isActive) {
          lH += `<p style="margin:0;padding-left:10pt;${HL}">${_renderPrecWithInlineHL(line, ctx, HL, fnMap, true)}</p>`;
        } else {
          lH += `<p style="margin:0;padding-left:10pt;${DIM}">${esc(_stripInlineMarkers(line))}</p>`;
        }
      });
      for (let i = 1; i < advArr.length; i++) {
        const disp = dispSet.has(i);
        lH += `<p style="margin:0 0 2pt;${disp ? '' : DIM}">${i}) ${esc(_stripInlineMarkers(advArr[i]))}</p>`;
      }
    } else if (hasDbCat) {
      const flatItems = _flattenPrecItems(cat, prec[cat]);
      flatItems.forEach((item, i) => {
        const isIndent  = !!item.indent;
        const isCircled = !!item.circled;
        if (!isIndent && !isCircled) dNum++;
        const disp   = dispSet.has(i);
        const indent = isIndent ? 'padding-left:10pt;' : '';
        const pfx    = (isIndent || isCircled) ? '' : `${dNum}) `;
        if (disp) {
          lH += `<p style="margin:0 0 2pt;${indent + HL}">${pfx}${_renderPrecWithInlineHL(item.text, ctx, HL, fnMap, true)}</p>`;
        } else {
          lH += `<p style="margin:0 0 2pt;${indent}${DIM}">${pfx}${esc(_stripInlineMarkers(item.text)).replace(/\n/g,'<br>')}</p>`;
        }
      });
    }

    if (dirInCat.length) {
      lH += `<p style="font-size:9pt;color:#E65100;margin:4pt 0 2pt;font-style:italic;">[품목허가사항 변경지시]</p>`;
      dirInCat.forEach(it => {
        lH += `<p style="margin:0 0 1pt;background:#FFF3E0;">${it.displayNum}) ${esc(it.text)}</p>`;
        if (it.citation) lH += `<p style="margin:0 0 4pt;padding-left:8pt;font-size:8pt;font-style:italic;color:#888;font-family:'맑은 고딕',sans-serif;">○ ${esc(it.citation)}</p>`;
      });
    }
    for (const excName of (selectedExcipients || [])) {
      const excItems = (EXCIPIENT_PREC_DB[excName] || {})[cat];
      if (!excItems) continue;
      lH += `<p style="font-size:9pt;color:#1565c0;margin:4pt 0 2pt;font-style:italic;">[첨가제: ${esc(excName)}]</p>`;
      excItems.forEach(text => { lH += `<p style="margin:0 0 2pt;${HL}">${++dNum}) ${esc(text)}</p>`; });
    }

    const precSec = precSections?.find(s => s.cat === cat);
    if (precSec) {
      precSec.items.forEach(it => {
        if (it.text && it.text.includes('<삭제>')) return;
        const clean = applyEasyTerms(removeEditorial(_stripIngredientParens(it.text)));
        if (it.indent || it.isMapping) rItems.push(`   ${clean}`);
        else if (it.circled) rItems.push(clean);
        else rItems.push(`${it.displayNum}) ${clean}`);
      });
    }

    const rLabel = label.replace(/^\d+\.\s*/, '');
    const rH = rItems.length
      ? `<p style="margin:0 0 4pt;font-weight:bold;font-size:10pt;">${++rSecNum}. ${esc(rLabel)}</p>`
        + rItems.map(t => `<p style="margin:0 0 2pt;">${esc(t).replace(/\n/g,'<br>')}</p>`).join('')
      : `<span style="color:#aaa;">(해당 없음)</span>`;
    out += `<tr><td style="${TD}">${lH}</td><td style="${TD}">${rH}</td></tr>`;
  }
  out += `</tbody></table>`;
  return out;
}

/* 같은 내용을 새 창에 그려 인쇄 창을 띄운다.
   브라우저의 인쇄 창에서 "대상"을 "PDF로 저장"으로 고르면 PDF가 된다.
   워드용 mso-* 설정은 브라우저가 무시하므로 그대로 둬도 해가 없다. */
function _printAsPdf(productName, body, extraStyle, tail) {
  const win = window.open('', '_blank');
  if (!win) {
    setStatus('팝업이 막혀 있어 PDF를 열지 못했습니다 — 주소창 오른쪽에서 팝업을 허용해 주세요.', 'error');
    return;
  }
  const title = _reviewFileName(productName);
  win.document.write(`<!doctype html><html lang="ko"><head><meta charset="UTF-8">
<title>${esc(title)}</title>
<style>
  @page { size: A4 portrait; margin: 15mm 12mm; }
  body { font-family:'맑은 고딕','Malgun Gothic',Arial,sans-serif; margin:0; font-size:9.5pt;
         color:#111; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  p { margin:0; padding:1pt 0; line-height:1.4; }
  table { border-collapse:collapse; width:100%; table-layout:fixed; }
  td, th { padding:3pt 5pt; border:1px solid #b8c4d4; word-wrap:break-word;
           overflow-wrap:break-word; vertical-align:middle; }
  /* 표가 페이지에 걸려 아무 데서나 잘리지 않게 */
  tr { page-break-inside:avoid; }
  thead { display:table-header-group; }
  p.sec-head { page-break-after:avoid; page-break-inside:avoid; }
${extraStyle || ''}
  /* 화면에서만 보이는 안내 — 인쇄물에는 나오지 않는다 */
  #pdf-help { position:fixed; top:0; left:0; right:0; z-index:9;
              background:#1a4b8c; color:#fff; font-size:13px; padding:9px 16px;
              display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
  #pdf-help button { font:inherit; font-weight:600; padding:4px 14px; border:none;
                     border-radius:4px; background:#fff; color:#1a4b8c; cursor:pointer; }
  #pdf-body { padding-top:46px; }
  @media print { #pdf-help { display:none; } #pdf-body { padding-top:0; } }
</style></head><body>
<div id="pdf-help">
  <span>인쇄 창에서 <b>대상</b>을 <b>"PDF로 저장"</b>으로 고르면 PDF 파일이 됩니다.</span>
  <button type="button" onclick="window.print()">인쇄 창 열기</button>
</div>
<div id="pdf-body">
${body}
${tail || ''}
</div></body></html>`);
  win.document.close();
  // 글꼴과 표가 다 그려진 뒤에 인쇄 창을 띄운다
  win.addEventListener('load', () => setTimeout(() => win.print(), 250));
}

/* 검토서 파일 이름 — 제품명_표준제조기준_검토서_알피바이오_YYMMDD */
function _reviewFileName(productName) {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  const ymd = p(d.getFullYear() % 100) + p(d.getMonth() + 1) + p(d.getDate());
  return `${productName}_표준제조기준_검토서_알피바이오_${ymd}`;
}

/* 워드 문서 껍데기 + 내려받기 — 세 분기가 똑같이 갖고 있던 부분.
   제1장만 워드 메모(comment)를 쓰므로 extraStyle·tail로 받는다. */
/* 워드로 내려받을지 PDF(인쇄)로 낼지 — generateFullWordDoc(mode)가 정한다.
   전역으로 두는 이유: 문서를 만드는 함수가 세 갈래(제1·2장·매트릭스)로
   나뉘어 있어 인자를 끝까지 들고 다니려면 여러 곳을 고쳐야 한다.
   내보내는 순간에만 쓰고 바로 되돌린다. */
let _exportMode = 'word';

function _wordDownload(productName, body, extraStyle, tail) {
  if (_exportMode === 'pdf') return _printAsPdf(productName, body, extraStyle, tail);
  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office'`
    + ` xmlns:w='urn:schemas-microsoft-com:office:word'`
    + ` xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset="UTF-8"><title>${esc(productName)} 표준제조기준 검토</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>90</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
<style>
  @page { margin: 1.5cm 1cm; mso-page-orientation: portrait; }
  body { font-family:'맑은 고딕',Arial,sans-serif; margin:0; font-size:9pt; }
  p { margin:0; padding:1pt 0; line-height:1.4; }
  table { border-collapse:collapse; width:100%; table-layout:fixed; }
  td, th { padding:3pt 5pt; border:1px solid #b8c4d4; word-wrap:break-word; overflow-wrap:break-word;
           vertical-align:middle; mso-vertical-align-alt:middle; }
  /* 칸 안의 문단이 위로 붙는 것을 막는다 — 워드는 칸의 세로 정렬만으로는
     문단 여백까지 없애 주지 않아, 글이 한 줄일 때 위쪽에 치우쳐 보인다 */
  td p, th p { margin-top:0; margin-bottom:0; }
  /* 페이지 나눔 —
     한 행이 페이지에 걸쳐 쪼개지면 읽기 어려우므로 행 단위로 막는다.
     다만 주의사항·용법용량처럼 한 칸에 글이 길게 들어가는 표는
     행 하나가 한 쪽을 넘길 수 있다. 그런 행까지 통째로 막으면
     빈 쪽이 생기므로, 그런 표에는 avoid를 걸지 않는다(tall-rows). */
  tr { page-break-inside:avoid; mso-yfti-cnfc:0; }
  table.tall-rows tr { page-break-inside:auto; }
  thead { display:table-header-group; }      /* 페이지가 넘어가면 머리행을 다시 그린다 */
  table { page-break-inside:auto; }
  /* 절 제목은 바로 아래 내용과 붙여 둔다 — 제목만 남고 표가 넘어가지 않게 */
  p.sec-head { page-break-after:avoid; page-break-inside:avoid; }
${extraStyle || ''}
</style>
</head><body>
${body}
${tail || ''}
</body></html>`;
  const blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `${_reviewFileName(productName)}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ══════════ 제3장 조항별 적합여부 ══════════
   워드 검토서의 [유효성분의 종류]·[유효성분의 분량] 표에 조항마다
   적합/부적합을 적기 위한 것. 원문 조항 번호와 1:1로 맞춘다.

   상태는 넷:
     ok:true          적합      — 검사했고 통과
     ok:false         부적합    — 검사했고 위반 (reason 함께)
     na:true          해당없음  — 이 배합에는 적용되지 않는 조항
     ok:null,na:false 판정보류  — 프로그램이 판단할 수 없는 조항(서류 요건 등)

   ★ 매핑하지 않은 조항은 자동으로 "판정보류"가 된다.
     빠뜨려도 "적합"으로 잘못 나가지 않도록 일부러 이렇게 둔다. */
/* ══════════ 조항 표 ══════════
   조항 하나가 [절, 번호, 판정] 한 줄이다.

   왜 이렇게 바꿨나 —
   예전에는 판정 결과를 배열에 순서대로 담았다. 배열의 몇 번째냐가
   곧 조항 번호였다. 그래서 조항이 하나 끼거나 순서가 밀리면
   판정이 통째로 엉뚱한 조항에 붙었다. 실제로 그런 일이 있었고,
   원문 근거 표시가 "1/10 미달" 사유에 "아스피린과 Ⅴ-1항은 배합하지
   않는다"를 갖다 대고 있었다.

   이제 번호를 값으로 적으므로 순서가 어긋날 수 없다. 개정으로
   조항이 하나 늘면 표에 한 줄 더하면 되고, 적지 않은 번호는
   자동으로 "판정보류"가 된다 — 근거 없는 "적합"이 나가지 않는다. */

/* 조항 표를 돌려 절별 판정 배열을 만든다.
   rules: [[절, 번호, 판정함수], …]  ctx: 판정함수에 넘길 것 */
function _runClauseTable(rules, ctx, counts) {
  const out = {};
  for (const [sec, n] of Object.entries(counts)) {
    // 표에 적지 않은 조항은 판정보류로 남긴다
    out[sec] = Array.from({ length: n }, () => ({ ok: null, na: false, reason: '' }));
  }
  for (const [sec, no, fn] of rules) {
    if (!out[sec]) continue;
    if (no < 1 || no > out[sec].length) {
      // 조항 수가 바뀌었는데 표를 안 고친 경우 — 조용히 넘기지 않는다
      console.warn(`[조항 표] ${sec} ${no}번은 지금 ${out[sec].length}개 조항 밖입니다`);
      continue;
    }
    try {
      out[sec][no - 1] = fn(ctx);
    } catch (e) {
      console.warn(`[조항 표] ${sec} ${no}번 판정 중 오류:`, e);
      // 오류가 나면 "적합"이 아니라 판정보류로 둔다
      out[sec][no - 1] = { ok: null, na: false, reason: '' };
    }
  }
  return out;
}

/* ══════════ 제1장(비타민·미네랄) 조항 표 ══════════
   다른 장은 "유효성분의 종류/분량"으로 나뉘는데, 제1장은
   "배합성분의 종류 및 배합한도" 하나에 세 조항이 들어 있다.
   그래서 절 이름이 '배합'이다. */
const CH1_CLAUSES = [
  /* (1) 배합가능한 성분의 종류는 <표1>~<표4>에 기재된 것 */
  ['배합', 1, c => {
      const notFound = c.ir0.filter(r => r.ok === null);
      return notFound.length
        ? c.NO(notFound.map(r => `${r.ingr}: 표1~표4에 없음`).join('; '))
        : c.YES();
    },
    { 사유: /표\s*1|표1~표4에 없음|찾을 수 없음/, 우선: 10 }],

  /* (2) 같은 항목의 성분을 여러 개 넣으면 그 합이 1일 최대량을 넘을 수 없다.
         예) 레티놀아세테이트 + 레티놀팔미테이트 ≤ 10,000 IU
         검증기가 sumResults로 항목별 합을 이미 세고 있다. */
  ['배합', 2, c => {
      const sums = [];
      c.allVpairs.forEach(({ v }) => (v.sumResults || []).forEach(x => sums.push(x)));
      const bad = sums.filter(x => x.ok === false);
      if (bad.length) return c.NO(bad.map(x => x.reason || x.key).join('; '));
      const hold = sums.filter(x => x.ok === null);
      if (hold.length) return { ok: null, na: false, reason: hold[0].reason || '' };
      /* 한 항목에 성분이 하나뿐이면 합칠 것이 없지만, 그 성분의 양이 곧
         항목의 총량이고 성분별 판정에서 이미 확인했다. 그러니 "해당없음"이
         아니라 "적합"이다. 성분이 아예 없을 때만 볼 것이 없다. */
      if (!c.rows.length) return c.NA;
      const anyBad = c.anyFail(r => r.ok === false);
      return anyBad ? c.NO(c.failNames(r => r.ok === false)) : c.YES();
    },
    { 사유: /합계|총량|합이/, 우선: 9 }],

  /* (3) 만 8세 미만이 복용하는 제제에는 이 미네랄들을 넣을 수 없다 */
  ['배합', 3, c => {
      if (!c.under8) return c.NA;                    // 어린이 용법이 없으면 볼 것이 없다
      const 금지 = ['염소', '크롬', '망간', '몰리브덴', '칼륨', '나트륨', '황'];
      const hit = c.rows.filter(r => {
        const nm = String(r.ingr || '');
        // 표2 미네랄은 "칼륨으로서"처럼 적힌다. 낱말이 맞아떨어질 때만 잡는다
        return 금지.some(k => nm === k || nm.startsWith(k + '으로서') || nm.startsWith(k + '로서'));
      });
      return hit.length
        ? c.NO(`만 8세 미만 용법에는 배합할 수 없는 성분: ${hit.map(r => r.ingr).join(', ')}`)
        : c.YES();
    }],
];

function _ch1Ctx(allVpairs, form, activeRows) {
  const H    = _ruleStatusHelpers(allVpairs, '제1장_비타민미네랄', form);
  const v0   = allVpairs[0].v;
  const rows = activeRows.filter(r => r.ingr);
  return {
    NA:   { ok: null, na: true,  reason: '' },
    HOLD: { ok: null, na: false, reason: '' },
    YES:  () => ({ ok: true,  na: false, reason: '' }),
    NO:   r => ({ ok: false, na: false, reason: r }),
    allVpairs, form, rows,
    ir0: H.ir0, anyFail: H.anyFail, failNames: H.failNames,
    // 어느 연령에서든 만 8세 미만이 있으면 (3)을 본다
    under8: allVpairs.some(({ v }) => v.under8),
  };
}

function computeCh1KindsAmtsStatus(allVpairs, form, activeRows) {
  if (!allVpairs.length) return { kindsSt: [], amtsSt: [] };
  const base = DB['제1장_비타민미네랄']?.['기준'] ?? {};
  const out = _runClauseTable(CH1_CLAUSES, _ch1Ctx(allVpairs, form, activeRows), {
    '배합': (base['배합성분의_종류_및_배합한도'] ?? []).length,
  });
  // 제1장은 절이 하나다 — 다른 장과 모양을 맞추려고 kindsSt에 담는다
  return { kindsSt: out['배합'], amtsSt: [] };
}

/* ══════════ 제3장 조항 표 ══════════
   [절, 조항번호, 판정] — 번호를 값으로 적으므로 순서가 어긋날 수 없다. */
const CH3_CLAUSES = [
  // ── 유효성분의 종류 ──
  ['종류', 1, c => c.미등재.length
      ? c.NO(c.미등재.map(r => `${r.ingr}: 표1에 없음`).join('; ')) : c.YES()],
  // 한약처방 규격·기초시험자료 제출 — 서류 요건이라 프로그램이 판정할 수 없다
  ['종류', 2, c => c.ra.length ? c.HOLD : c.NA],
  ['종류', 3, c => (c.n1 + c.n2) >= 1 ? c.YES() : c.NO('Ⅰ항·Ⅱ항 성분이 하나도 없음')],
  ['종류', 4, c => c.n1 <= 3 ? c.YES() : c.NO(`Ⅰ항 ${c.n1}종 — 최대 3종`)],
  ['종류', 5, c => c.초과항.length
      ? c.NO(c.초과항.map(([h, n]) => `${h} ${n}종 — 각 1종만`).join('; ')) : c.YES()],
  ['종류', 6, c => c.isOk('마황×Ⅴ-1항 배합금지')
      ? c.YES() : c.NO(c.reasonOf('마황×Ⅴ-1항 배합금지'))],
  ['종류', 7, c => c.ra.length === 0 ? c.NA
      : (c.ga.length + c.na_.length + c.da.length) === 0 ? c.YES()
      : c.NO(`라란(${c.ra.map(r => r.ingr).join(',')})과 생약 동시 배합`)],
  // 향소산 이외의 한약처방은 엑스에 한하여 — 성분명으로 엑스 여부를 가릴 수 없다
  ['종류', 8, c => c.ra.length === 0 ? c.NA : c.HOLD],
  // 라란 구성생약·분량은 <표2>에 의한다 — 참조 규정이라 판정 대상이 아니다
  ['종류', 9, c => c.ra.length === 0 ? c.NA : c.HOLD],
  ['종류', 10, c => !c.hasIbu ? c.NA : (() => {
      const bad = [];
      if (c.n1) bad.push('Ⅰ항');
      if (c.n9) bad.push('Ⅸ항');
      if (c.ga.length) bad.push('가란 생약');
      if (c.da.some(r => r.ingr.includes('지룡'))) bad.push('지룡');
      if (c.ra.length) bad.push('라란 한약처방');
      return bad.length ? c.NO(`이부프로펜과 ${bad.join('·')} 동시 배합 불가`) : c.YES();
    })()],
  ['종류', 11, c => !c.n8 ? c.NA : (() => {
      const bad = [];
      if (c.n10) bad.push('Ⅹ항');
      if (c.ga.length) bad.push('가란 생약');
      if (c.ra.length) bad.push('라란 한약처방');
      return bad.length ? c.NO(`Ⅷ항과 ${bad.join('·')} 동시 배합 불가`) : c.YES();
    })()],
  ['종류', 12, c => !c.n9 ? c.NA : (() => {
      const bad = [];
      if (c.n2) bad.push('Ⅱ항');
      if (c.n10) bad.push('Ⅹ항');
      if (c.ga.length) bad.push('가란 생약');
      if (c.ra.length) bad.push('라란 한약처방');
      return bad.length ? c.NO(`Ⅸ항과 ${bad.join('·')} 동시 배합 불가`) : c.YES();
    })()],
  // 2026-57호 신설
  ['종류', 13, c => !c.hasMeq ? c.NA : (() => {
      const bad = [];
      if (/내용액제|경구용\s*액제|시럽/.test(c.form || '')) bad.push('경구용 액제에는 배합 불가');
      if (c.ra.length) bad.push('라란 한약처방과 동시 배합 불가');
      return bad.length ? c.NO('메퀴타진 — ' + bad.join('; ')) : c.YES();
    })()],
  ['종류', 14, c => !c.n15 ? c.NA : (() => {
      const bad = [];
      if (c.ga.length) bad.push('가란 생약');
      if (c.na_.some(r => r.ingr.includes('감초'))) bad.push('나란 감초');
      if (c.ra.length) bad.push('라란 한약처방');
      return bad.length ? c.NO(`ⅩⅤ항(글리시리진산)과 ${bad.join('·')} 동시 배합 불가`) : c.YES();
    })()],

  // ── 유효성분의 분량 ──
  /* 1) 각 성분의 1일 최대분량은 <표1>의 양.
        다만 Ⅴ-1항 또는 가란에 Ⅻ항을 배합하면 그 합이 3/2을 넘을 수 없다. */
  ['분량', 1, c => {
      if (c.anyFail(c.overFail)) return c.NO(c.failNames(c.overFail));
      const hasV1Ga = c.inH('Ⅴ-1항').length + c.ga.length;
      const has12   = c.inH('Ⅻ항').length;
      if (!(hasV1Ga && has12)) return c.YES();      // 다만 조건이 아니면 앞부분만 본다
      const res = c.propSum(r => /^(Ⅴ-1항|Ⅻ항)/.test(r.gubun || '')
                              || c.ga.some(x => x.ingr === r.ingr));
      const vd = _propVerdict(res, { max: 1.5 }, 'Ⅴ-1항·가란+Ⅻ항');
      return vd.na ? c.YES() : vd;
    },
      { 사유: /최대.*(넘음|초과)/, 우선: 10 }],
  /* 2) Ⅰ항 2종 이상, 또는 가란·나란 생약 2종 이상 — 각 묶음의 합이 1 이하.
        조건이 "또는"으로 갈려 있으므로 두 묶음을 따로 센다. */
  ['분량', 2, c => {
      const out = [];
      if (c.n1 >= 2) out.push(_propVerdict(
        c.propSum(r => (r.gubun || '').startsWith('Ⅰ항')), { max: 1 }, 'Ⅰ항'));
      if ((c.ga.length + c.na_.length) >= 2) out.push(_propVerdict(
        c.propSum(r => c.ga.some(x => x.ingr === r.ingr) || c.na_.some(x => x.ingr === r.ingr)),
        { max: 1 }, '가란·나란 생약'));
      return c.mergeVerdicts(out);
    }],
  /* 3) Ⅰ항에 지룡·갈근탕·마황탕을 배합하면 그 합이 1 이하 */
  ['분량', 3, c => {
      const extra = c.da.filter(r => r.ingr.includes('지룡'))
                     .concat(c.ra.filter(r => /갈근탕|마황탕/.test(r.ingr)));
      if (!(c.n1 >= 1 && extra.length)) return c.NA;
      return _propVerdict(
        c.propSum(r => (r.gubun || '').startsWith('Ⅰ항') || extra.some(x => x.ingr === r.ingr)),
        { max: 1 }, 'Ⅰ항+지룡·갈근탕·마황탕');
    }],
  ['분량', 4, c => c.ra.length === 0 ? c.NA : (() => {
      const p = r => c.ra.some(x => x.ingr === r.ingr) && r.ok === false;
      return c.anyFail(p) ? c.NO(c.failNames(p)) : c.YES();
    })(),
      { 구분: /라란/, 사유: /최소|미달|하한/, 우선: 8 }],
  ['분량', 5, c => c.anyFail(c.underFail) ? c.NO(c.failNames(c.underFail)) : c.YES(),
      // 짚을 조항이 따로 없을 때의 일반 하한
      { 사유: /최소|미달|하한/, 우선: 0 }],
  /* 6번은 5번(일반 하한 1/2)과 별개다. 표1 최대가 1,500이면 1/2 = 750이라
     5번이 더 엄하다. 둘을 묶으면 700mg처럼 600은 넘고 750은 못 넘는 값에서
     6번까지 잘못 부적합으로 찍힌다. 그래서 600mg 기준으로 따로 센다. */
  ['분량', 6, c => !(c.n1 === 1 && c.inH('Ⅰ항')[0]?.ingr === '아세트아미노펜') ? c.NA : (() => {
      const bad = [];
      c.allVpairs.forEach(({ dr, v }) => {
        const r = (v.itemResults || []).find(x => x.ingr === '아세트아미노펜');
        if (!r || r.dailyMin == null) return;
        const floor = +(600 * (v.coeff ?? 1)).toFixed(4);
        if (r.dailyMin < floor) {
          const al = displayAgeLabel(dr.age, '제3장_감기약', c.form) || dr.age;
          bad.push(`${al}: 1일 ${_num(r.dailyMin)} mg — 하한 ${_num(floor)} mg 미달`);
        }
      });
      /* 뒷부분 — Ⅰ항을 2종 이상 배합하면 그 합이 1/2 이상이어야 한다.
         (하한 1/5은 성분별 판정에서 이미 본다) */
      if (bad.length) return c.NO(bad.join('; '));
      if (c.n1 >= 2) {
        const vd = _propVerdict(c.propSum(r => (r.gubun || '').startsWith('Ⅰ항')),
                                { min: 0.5 }, 'Ⅰ항');
        if (!vd.na) return vd;
      }
      return c.YES();
    })(),
      { 사유: /하한\s*600|600\s*mg\s*미달/, 우선: 9 }],
  ['분량', 7, c => (c.inH('Ⅻ항').length + c.inH('ⅩⅣ항').length) === 0 ? c.NA : (() => {
      const p = r => /Ⅻ항|ⅩⅣ항/.test(r.gubun || '') && c.underFail(r);
      return c.anyFail(p) ? c.NO(c.failNames(p)) : c.YES();
    })(),
      { 구분: /Ⅻ항|ⅩⅣ항/, 사유: /최소|미달|하한/, 우선: 8 }],
  ['분량', 8, c => !c.n13 ? c.NA : (() => {
      const p = r => /ⅩⅢ항/.test(r.gubun || '') && c.underFail(r);
      return c.anyFail(p) ? c.NO(c.failNames(p)) : c.YES();
    })(),
      { 구분: /ⅩⅢ항/, 사유: /최소|미달|하한/, 우선: 8 }],
  ['분량', 9, c => (c.n15 + c.ga.length + c.na_.length + c.da.length) === 0 ? c.NA : (() => {
      const p = r => /1\/10/.test(r.reason || '');
      return c.anyFail(p) ? c.NO(c.failNames(p)) : c.YES();
    })(),
      { 구분: /ⅩⅤ항|가란|나란|다란/, 사유: /최소|미달|하한/, 우선: 8 }],
  /* 10) "효능의 근거가 가란·나란에만 의할 경우"의 하한 1/2.
         무엇을 근거로 효능을 냈는지는 프로그램이 단정할 수 없다.
         다만 그 경우에 해당하는 "나란 2종 이상일 때 합 1/2 이상"은
         셀 수 있으므로 계산해 보여 준다. */
  ['분량', 10, c => {
      if ((c.ga.length + c.na_.length) === 0) return c.NA;
      const soleHerb = (c.inH('Ⅳ항').length + c.inH('Ⅴ항').length + c.inH('Ⅶ항').length) === 0;
      if (!soleHerb) return c.NA;
      if (c.na_.length >= 2) {
        const vd = _propVerdict(c.propSum(r => c.na_.some(x => x.ingr === r.ingr)),
                                { min: 0.5 }, '나란 생약');
        if (!vd.na) return vd;
      }
      return c.HOLD;
    }],
  ['분량', 11, c => !(c.isLiquid && c.hasCaf) ? c.NA : (() => {
      const caf = c.ir0.find(r => r.ingr.includes('카페인'));
      const per = caf?.dose1 != null ? +caf.dose1 : null;
      if (per == null) return c.HOLD;
      return per <= 30 ? c.YES() : c.NO(`1회 카페인 ${per} mg — 30 mg 초과`);
    })()],
  ['분량', 12, c => !c.hasAsp ? c.NA
      : (c.inH('Ⅴ-1항').length ? c.NO('아스피린과 Ⅴ-1항 성분 동시 배합 불가') : c.YES())],
];

/* 판정에 쓰는 값을 한 번에 만들어 조항 표에 넘긴다 */
function _ch3Ctx(allVpairs, form, activeRows) {
  const H      = _ruleStatusHelpers(allVpairs, '제3장_감기약', form);
  const tables = DB['제3장_감기약']?.['표'] ?? {};
  const t1e    = tables['표1_유효성분'] ?? [];
  const t1h    = tables['표1_생약_및_한약처방'] ?? [];
  const rows   = activeRows.filter(r => r.ingr);

  const eOf   = r => t1e.find(t => t['성분명'] === r.ingr);
  const hOf   = r => t1h.find(t => t['성분명'] === r.ingr);
  const inH   = pfx => rows.filter(r => (eOf(r)?.['구분'] ?? '').startsWith(pfx));
  const inLan = lan => rows.filter(r => (hOf(r)?.['구분'] ?? '') === lan);

  // 각 항 1종 (2026-57호로 ⅩⅤ항이 들어왔다)
  const 단일항 = ['Ⅲ항','Ⅳ항','Ⅴ-1항','Ⅵ항','Ⅶ항','Ⅺ항','Ⅻ항','ⅩⅤ항'];
  const ra = inLan('라란');
  const 초과항 = 단일항.map(h => [h, inH(h).length]).filter(([, n]) => n > 1);
  if (ra.length > 1) 초과항.push(['라란', ra.length]);

  return {
    NA:   { ok: null, na: true,  reason: '' },
    HOLD: { ok: null, na: false, reason: '' },
    YES:  () => ({ ok: true,  na: false, reason: '' }),
    NO:   r => ({ ok: false, na: false, reason: r }),
    propSum: pick => _propSum(allVpairs, pick, '제3장_감기약', form),
    /* 한 조항이 여러 묶음을 따로 세는 경우 — 하나라도 걸리면 부적합,
       못 센 것이 있으면 판정보류, 다 통과해야 적합. */
    mergeVerdicts: list => {
      const v = list.filter(x => x && !x.na);
      if (!v.length) return { ok: null, na: true, reason: '' };
      const no = v.find(x => x.ok === false);
      if (no) return no;
      const hold = v.find(x => x.ok === null);
      if (hold) return hold;
      return { ok: true, na: false, reason: v.map(x => x.reason).filter(Boolean).join('  /  ') };
    },
    allVpairs, form, rows, inH, inLan,
    ir0: H.ir0, isOk: H.isOk, reasonOf: H.reasonOf,
    anyFail: H.anyFail, failNames: H.failNames,
    overFail:  r => r.ok === false && /최대/.test(r.reason || ''),
    underFail: r => r.ok === false && /최소|미달|하한/.test(r.reason || ''),
    n1: inH('Ⅰ항').length, n2: inH('Ⅱ항').length,
    n8: inH('Ⅷ항').length, n9: inH('Ⅸ항').length, n10: inH('Ⅹ항').length,
    n13: inH('ⅩⅢ항').length, n15: inH('ⅩⅤ항').length,
    ga: inLan('가란'), na_: inLan('나란'), da: inLan('다란'), ra,
    초과항,
    hasMeq: rows.some(r => r.ingr.includes('메퀴타진')),
    hasIbu: rows.some(r => r.ingr.includes('이부프로펜')),
    hasAsp: rows.some(r => r.ingr.includes('아스피린')),
    hasCaf: rows.some(r => r.ingr.includes('카페인')),
    isLiquid: /내용액제/.test(form || ''),
    미등재: H.ir0.filter(r => r.ok === null),
  };
}

function computeCh3KindsAmtsStatus(allVpairs, form, activeRows) {
  if (!allVpairs.length) return { kindsSt: [], amtsSt: [] };
  const base = DB['제3장_감기약']?.['기준'] ?? {};
  const out = _runClauseTable(CH3_CLAUSES, _ch3Ctx(allVpairs, form, activeRows), {
    // 조항 수는 데이터에서 가져온다 — 개정으로 늘면 자동으로 따라간다
    '종류': (base['유효성분의_종류'] ?? []).length,
    '분량': (base['유효성분의_분량'] ?? []).length,
  });
  return { kindsSt: out['종류'], amtsSt: out['분량'] };
}

/* ══════════ 제7장(진해거담제) 조항 표 ══════════ */
const CH7_CLAUSES = [
  // 원문 1)은 세 가지를 한 조항에 담는다 — 배합가능 종류 · 트로키제 △표시 · 9항
  ['종류', 1, c => {
      const bad = [];
      if (c.notFound.length) bad.push(c.notFound.map(r => `${r.ingr}: 표1에 없음`).join('; '));
      if (c.n9 && c.anyFail(r => /9항/.test(r.gubun || '') && r.ok === false && /트로키/.test(r.reason || '')))
        bad.push('9항 성분은 트로키제에만 배합 가능');
      if (c.isTroki) {
        const noTri = c.rows.filter(r => { const e = c.eOf(r); return e && !String(e['성분명']).includes('△'); });
        if (noTri.length)
          bad.push('트로키제에 배합할 수 없는 성분: '
                   + noTri.map(r => r.ingr.replace(/^△/, '')).join(', ')
                   + ' (표1에서 △ 표시된 성분만 가능)');
      }
      return bad.length ? c.NO(bad.join('; ')) : c.YES();
    }],
  ['종류', 2, c => (c.n1 + c.n2 + c.n3 + c.ga.length) >= 1
      ? c.YES() : c.NO('1항·2항·3항·가란 성분이 하나도 없음')],
  ['종류', 3, c => !c.n8 ? c.NA
      : ((c.n1 + c.n7) >= 1 ? c.YES() : c.NO('8항(카페인류)은 1항 또는 7항과 함께만 배합 가능'))],
  ['종류', 4, c => c.over1.length
      ? c.NO(c.over1.map(([h, n]) => `${h} ${n}종 — 각 1종만`).join('; ')) : c.YES()],
  ['종류', 5, c => (c.naL.length + c.da.length) === 0 ? c.NA
      : (c.naL.length > 5 || c.da.length > 5
          ? c.NO([c.naL.length > 5 ? `나란 ${c.naL.length}종` : '',
                  c.da.length  > 5 ? `다란 ${c.da.length}종`  : '']
                 .filter(Boolean).join('; ') + ' — 각 5종까지')
          : c.YES())],
  ['종류', 6, c => !c.ga.length ? c.NA
      : (c.isOk('가란(마황)×2항/4항 배합금지')
          ? c.YES() : c.NO(c.reasonOf('가란(마황)×2항/4항 배합금지')))],

  ['분량', 1, c => c.anyFail(c.overFail) ? c.NO(c.failNames(c.overFail)) : c.YES(),
      { 사유: /최대.*(넘음|초과)/, 우선: 10 }],
  /* 2) 2항과 4항을 함께 배합하는 경우, 그리고 가란·나란을 2종 이상
        배합하는 경우 — 각 묶음의 합이 1 이하 (제3장과 같은 읽기) */
  ['분량', 2, c => {
      const out = [];
      if (c.n2 && c.n4) out.push(_propVerdict(
        c.propSum(r => /^(2항|4항)/.test(r.gubun || '')), { max: 1 }, '2항+4항'));
      if ((c.ga.length + c.naL.length) >= 2) out.push(_propVerdict(
        c.propSum(r => c.ga.some(x => x.ingr === r.ingr) || c.naL.some(x => x.ingr === r.ingr)),
        { max: 1 }, '가란·나란 생약'));
      return c.mergeVerdicts(out);
    }],
  ['분량', 3, c => c.anyFail(c.underFail) ? c.NO(c.failNames(c.underFail)) : c.YES(),
      // 일반 하한 1/2 (8항은 1/5)
      { 사유: /최소|미달|하한/, 우선: 0 }],
  // "무엇으로 효능을 내는지"는 프로그램이 단정할 수 없다
  ['분량', 4, c => (c.n2 && c.n4) ? c.HOLD : c.NA],
  ['분량', 5, c => (c.ga.length + c.naL.length + c.da.length) === 0 ? c.NA : (() => {
      const p = r => r.ok === false && /1\/10|1\/2/.test(r.reason || '');
      return c.anyFail(p) ? c.NO(c.failNames(p)) : c.YES();
    })(),
      { 구분: /가란|나란|다란/, 사유: /최소|미달|하한/, 우선: 8 }],
  ['분량', 6, c => !(c.isTroki && c.n9) ? c.NA : c.HOLD],
  ['분량', 7, c => !c.isTroki ? c.NA
      : (c.allVpairs.some(({ dr }) => (dr.freqMax ?? 0) >= 5) ? c.HOLD : c.NA)],
  ['분량', 8, c => !c.n10 ? c.NA : (() => {
      const p = r => /10항/.test(r.gubun || '') && c.underFail(r);
      return c.anyFail(p) ? c.NO(c.failNames(p)) : c.YES();
    })(),
      { 구분: /10항/, 사유: /최소|미달|하한/, 우선: 8 }],
];

function _ch7Ctx(allVpairs, form, activeRows) {
  const H      = _ruleStatusHelpers(allVpairs, '제7장_진해거담제', form);
  const tables = DB['제7장_진해거담제']?.['표'] ?? {};
  const t1e    = tables['표1_유효성분'] ?? [];
  const t1h    = tables['표1_생약'] ?? [];
  const rows   = activeRows.filter(r => r.ingr);
  const eOf    = r => t1e.find(t => t['성분명'] === r.ingr);
  const hOf    = r => t1h.find(t => t['성분명'] === r.ingr);
  const inH    = pfx => rows.filter(r => (eOf(r)?.['구분'] ?? '').startsWith(pfx));
  const inLan  = lan => rows.filter(r => (hOf(r)?.['구분'] ?? '') === lan);
  const hangs  = ['1항','2항','3항','4항','5항','6항','7항','8항','9항'];
  return {
    NA:   { ok: null, na: true,  reason: '' },
    HOLD: { ok: null, na: false, reason: '' },
    YES:  () => ({ ok: true,  na: false, reason: '' }),
    NO:   r => ({ ok: false, na: false, reason: r }),
    propSum: pick => _propSum(allVpairs, pick, '제7장_진해거담제', form),
    /* 한 조항이 여러 묶음을 따로 세는 경우 — 하나라도 걸리면 부적합,
       못 센 것이 있으면 판정보류, 다 통과해야 적합. */
    mergeVerdicts: list => {
      const v = list.filter(x => x && !x.na);
      if (!v.length) return { ok: null, na: true, reason: '' };
      const no = v.find(x => x.ok === false);
      if (no) return no;
      const hold = v.find(x => x.ok === null);
      if (hold) return hold;
      return { ok: true, na: false, reason: v.map(x => x.reason).filter(Boolean).join('  /  ') };
    },
    allVpairs, form, rows, eOf, inH,
    isOk: H.isOk, reasonOf: H.reasonOf, anyFail: H.anyFail, failNames: H.failNames,
    overFail:  r => r.ok === false && /최대/.test(r.reason || ''),
    underFail: r => r.ok === false && /최소|미달|하한/.test(r.reason || ''),
    n1: inH('1항').length, n2: inH('2항').length, n3: inH('3항').length,
    n4: inH('4항').length, n7: inH('7항').length, n8: inH('8항').length,
    n9: inH('9항').length, n10: inH('10항').length,
    ga: inLan('가란'), naL: inLan('나란'), da: inLan('다란'),
    isTroki: /트로키/.test(form || ''),
    notFound: H.ir0.filter(r => r.ok === null),
    over1: hangs.map(h => [h, inH(h).length]).filter(([, n]) => n > 1),
  };
}

function computeCh7KindsAmtsStatus(allVpairs, form, activeRows) {
  if (!allVpairs.length) return { kindsSt: [], amtsSt: [] };
  const base = DB['제7장_진해거담제']?.['기준'] ?? {};
  const out = _runClauseTable(CH7_CLAUSES, _ch7Ctx(allVpairs, form, activeRows), {
    '종류': (base['유효성분의_종류'] ?? []).length,
    '분량': (base['유효성분의_분량'] ?? []).length,
  });
  return { kindsSt: out['종류'], amtsSt: out['분량'] };
}

/* ══════════ 제9장(비염용 경구제) 조항 표 ══════════ */
const CH9_CLAUSES = [
  ['종류', 1, c => c.notFound.length
      ? c.NO(c.notFound.map(r => `${r.ingr}: 표1에 없음`).join('; ')) : c.YES()],
  ['종류', 2, c => c.isOk('Ⅰ란 필수') ? c.YES() : c.NO(c.reasonOf('Ⅰ란 필수'))],
  // 각란은 상호 배합가능 — 금지가 아니라 허용 규정이라 판정 대상이 아니다
  ['종류', 3, c => c.NA],
  ['종류', 4, c => {
      const bad = ['Ⅰ란 1종 초과','Ⅲ란 1종 초과','Ⅳ란 1종 초과','Ⅴ란 1종 초과']
        .filter(k => !c.isOk(k)).map(k => c.reasonOf(k));
      return bad.length ? c.NO(bad.join('; ')) : c.YES();
    }],
  ['종류', 5, c => !(c.n21 + c.n22) ? c.NA : (() => {
      const bad = [];
      if (c.n21 > 2) bad.push(`Ⅱ란 1항 ${c.n21}종 — 2종까지`);
      ['Ⅱ란 2항 1종 초과','Ⅱ란 1항 배합금지']
        .filter(k => !c.isOk(k)).forEach(k => bad.push(c.reasonOf(k)));
      return bad.length ? c.NO(bad.join('; ')) : c.YES();
    })()],
  // 엑스의 종류는 성분명으로 가릴 수 없다
  ['종류', 6, c => (c.n42 + (c.has6 ? 1 : 0)) === 0 ? c.NA : c.HOLD],
  ['종류', 7, c => !c.n12 ? c.NA : (() => {
      const bad = ['Ⅰ란2항 액제 금지','Ⅰ란2항×Ⅵ란 배합금지']
        .filter(k => !c.isOk(k)).map(k => c.reasonOf(k));
      return bad.length ? c.NO(bad.join('; ')) : c.YES();
    })()],

  ['분량', 1, c => c.anyFail(c.overFail) ? c.NO(c.failNames(c.overFail)) : c.YES(),
      { 사유: /최대.*(넘음|초과)/, 우선: 10 }],
  ['분량', 2, c => !(c.n21 && c.n5) ? c.NA : (() => {
      const p = r => (r.gubun || '').startsWith('Ⅴ란') && c.overFail(r);
      return c.anyFail(p) ? c.NO(c.failNames(p)) : c.YES();
    })()],
  /* Ⅱ란 2종 이상일 때 합 ≤ 2 — 검증기가 prop2Result로 센다.
     못 센 연령이 있으면 판정하지 않는다 (잘못된 "적합" 방지) */
  ['분량', 3, c => !c.props.length ? c.NA
      : (c.props.some(p => p.ok === null)
          ? { ok: null, na: false, reason: c.props.find(p => p.ok === null).reason }
          : c.props.every(p => p.ok === true) ? c.YES()
          : c.NO(c.props.find(p => p.ok === false).reason))],
  ['분량', 4, c => !c.n1 ? c.NA : (() => {
      const p = r => (r.gubun || '').startsWith('Ⅰ란') && c.underFail(r);
      return c.anyFail(p) ? c.NO(c.failNames(p)) : c.YES();
    })(),
      { 구분: /^Ⅰ란/, 사유: /최소|미달|하한/, 우선: 8 }],
  ['분량', 5, c => (c.n21 + c.n22 + c.n3 + c.n5) === 0 ? c.NA : (() => {
      const p = r => /^(Ⅱ란|Ⅲ란|Ⅴ란)/.test(r.gubun || '') && c.underFail(r);
      return c.anyFail(p) ? c.NO(c.failNames(p)) : c.YES();
    })(),
      { 구분: /^(Ⅱ란|Ⅲ란|Ⅴ란)/, 사유: /최소|미달|하한/, 우선: 8 }],
  ['분량', 6, c => (c.n4 + (c.has6 ? 1 : 0)) === 0 ? c.NA : (() => {
      const p = r => /^(Ⅳ란|Ⅵ란)/.test(r.gubun || '') && c.underFail(r);
      return c.anyFail(p) ? c.NO(c.failNames(p)) : c.YES();
    })(),
      { 구분: /^(Ⅳ란|Ⅵ란)/, 사유: /최소|미달|하한/, 우선: 8 }],
  // 배합법·배합계수는 <표2>를 참고한다 — 참조 안내라 판정 대상이 아니다
  ['분량', 7, c => c.NA],
];

function _ch9Ctx(allVpairs, form, activeRows) {
  const H      = _ruleStatusHelpers(allVpairs, '제9장_비염용경구제', form);
  const tables = DB['제9장_비염용경구제']?.['표'] ?? {};
  const t1e    = tables['표1_유효성분'] ?? [];
  const t1h    = tables['표1_생약'] ?? [];
  const rows   = activeRows.filter(r => r.ingr);
  const eOf    = r => t1e.find(t => t['성분명'] === r.ingr);
  const hOf    = r => t1h.find(t => t['성분명'] === r.ingr);
  const inH    = pfx => rows.filter(r => (eOf(r)?.['구분'] ?? '').startsWith(pfx));
  return {
    NA:   { ok: null, na: true,  reason: '' },
    HOLD: { ok: null, na: false, reason: '' },
    YES:  () => ({ ok: true,  na: false, reason: '' }),
    NO:   r => ({ ok: false, na: false, reason: r }),
    propSum: pick => _propSum(allVpairs, pick, '제9장_비염용경구제', form),
    /* 한 조항이 여러 묶음을 따로 세는 경우 — 하나라도 걸리면 부적합,
       못 센 것이 있으면 판정보류, 다 통과해야 적합. */
    mergeVerdicts: list => {
      const v = list.filter(x => x && !x.na);
      if (!v.length) return { ok: null, na: true, reason: '' };
      const no = v.find(x => x.ok === false);
      if (no) return no;
      const hold = v.find(x => x.ok === null);
      if (hold) return hold;
      return { ok: true, na: false, reason: v.map(x => x.reason).filter(Boolean).join('  /  ') };
    },
    allVpairs, form, rows,
    isOk: H.isOk, reasonOf: H.reasonOf, anyFail: H.anyFail, failNames: H.failNames,
    overFail:  r => r.ok === false && /최대/.test(r.reason || ''),
    underFail: r => r.ok === false && /최소|미달|하한/.test(r.reason || ''),
    n1: inH('Ⅰ란').length, n12: inH('Ⅰ란 2항').length,
    n21: inH('Ⅱ란 1항').length, n22: inH('Ⅱ란 2항').length,
    n3: inH('Ⅲ란').length, n4: inH('Ⅳ란').length,
    n42: inH('Ⅳ란 2항').length, n5: inH('Ⅴ란').length,
    has6: rows.some(r => (hOf(r)?.['구분'] ?? '') === 'Ⅵ란'),
    notFound: H.ir0.filter(r => r.ok === null),
    props: allVpairs.map(({ v }) => v.prop2Result).filter(Boolean),
  };
}

function computeCh9KindsAmtsStatus(allVpairs, form, activeRows) {
  if (!allVpairs.length) return { kindsSt: [], amtsSt: [] };
  const base = DB['제9장_비염용경구제']?.['기준'] ?? {};
  const out = _runClauseTable(CH9_CLAUSES, _ch9Ctx(allVpairs, form, activeRows), {
    '종류': (base['유효성분의_종류'] ?? []).length,
    '분량': (base['유효성분의_분량'] ?? []).length,
  });
  return { kindsSt: out['종류'], amtsSt: out['분량'] };
}

/* ══════════ 비례합 ══════════
   "각각의 1일 최대분량으로 나누어 얻은 수치의 합"을 구한다.

   나누는 값(1일 최대분량)은 itemResults의 critMax를 그대로 쓴다 —
   거기에는 연령구분계수와 생약 기준(원생약/분말)이 이미 반영돼 있어,
   여기서 다시 계산하면 두 곳이 어긋날 수 있다.

   연령이 여럿이면 연령마다 따로 세고 가장 큰 합(가장 엄한 쪽)을 쓴다.
   어린이는 분모가 작아져 같은 배합량이라도 합이 커진다.

   ★ 하나라도 못 세면 합을 내지 않는다.
     못 세는 성분을 빼고 더하면 합이 작아져 잘못된 "적합"이 된다. */
function _propSum(allVpairs, pick, chapterKey, form) {
  let worst = null;
  for (const { dr, v } of allVpairs) {
    const rows = (v.itemResults || []).filter(pick);
    if (!rows.length) continue;
    const bad = [], parts = [];
    let sum = 0;
    for (const r of rows) {
      const denom = r.critMax;
      const num   = r.dailyMax;
      if (denom == null || num == null || !(denom > 0)) { bad.push(r.ingr); continue; }
      const ratio = num / denom;
      sum += ratio;
      parts.push(`${r.ingr} ${_num(num)}/${_num(denom)}=${ratio.toFixed(3)}`);
    }
    const age = displayAgeLabel(dr.age, chapterKey, form) || dr.age;
    const cur = { age, sum: +sum.toFixed(4), parts, bad, n: rows.length };
    if (bad.length) return cur;                       // 못 세면 그 자리에서 멈춘다
    if (!worst || cur.sum > worst.sum) worst = cur;    // 합이 가장 큰 연령
  }
  return worst;
}

/* 조항 표에서 쓰는 껍데기 — 한도를 넘었는지/못 미쳤는지까지 판정한다.
   opts.max 이하여야 하는 조항, opts.min 이상이어야 하는 조항 둘 다 쓴다. */
function _propVerdict(res, opts, label) {
  const NA   = { ok: null, na: true,  reason: '' };
  if (!res) return NA;                                  // 해당 구성이 아님
  if (res.bad.length) {
    return { ok: null, na: false,
      reason: `합을 계산할 수 없습니다 — ${res.bad.join(', ')}의 1일 최대분량을 알 수 없습니다. 직접 확인해 주세요.` };
  }
  const detail = `${label} 합 ${res.sum}` + (res.age ? ` (${res.age})` : '')
               + `  [${res.parts.join(', ')}]`;
  if (opts.max != null && res.sum > opts.max)
    return { ok: false, na: false, reason: `${detail} — 기준 ${opts.max} 이하` };
  if (opts.min != null && res.sum < opts.min)
    return { ok: false, na: false, reason: `${detail} — 기준 ${opts.min} 이상` };
  return { ok: true, na: false, reason: detail };
}

/* 조항별 판정에서 되풀이되는 부분 — 제3·7·9장이 함께 쓴다 */
function _ruleStatusHelpers(allVpairs, chapterKey, form) {
  const v0    = allVpairs[0].v;
  const rules = v0.ruleErrors || [];
  return {
    v0,
    ir0:      v0.itemResults || [],
    isOk:     key => !rules.some(r => r.key === key && r.ok === false),
    reasonOf: key => (rules.find(r => r.key === key) || {}).reason || '',
    // 어느 연령에서든 한 번이라도 걸리면 부적합으로 본다 (가장 엄격한 쪽)
    anyFail:  pred => allVpairs.some(({ v }) => (v.itemResults||[]).some(pred)),
    failNames: pred => {
      const out = [];
      allVpairs.forEach(({ dr, v }) => {
        const al = displayAgeLabel(dr.age, chapterKey, form) || dr.age;
        (v.itemResults||[]).filter(pred).forEach(r => out.push(`${r.ingr}(${al}): ${r.reason}`));
      });
      return [...new Set(out)].join('; ');
    },
  };
}

/* ══════════ 부적합 사유 → 표제기 원문 조항 ══════════
   "1일 540 mg — 기준 최소 750 mg에 미달"만 보여 주면 무엇을 근거로
   그렇게 판정했는지 알 수 없다. 해당 조항의 원문을 함께 싣는다.

   조항 번호는 조항 표에만 있다. 예전에는 여기에도 번호를 따로 적어
   두어, 개정으로 조항이 밀리면 엉뚱한 조항이 근거로 붙었다.
   이제 표를 훑어 번호를 스스로 찾으므로 어긋날 자리가 없다.

   ★ 짚을 수 없는 사유는 아무것도 돌려주지 않는다.
     엉뚱한 조항을 갖다 붙이면 없느니만 못하다. */
const _CLAUSE_TABLES = {
  '제1장_비타민미네랄': () => (typeof CH1_CLAUSES !== 'undefined' ? CH1_CLAUSES : null),
  '제3장_감기약':       () => (typeof CH3_CLAUSES !== 'undefined' ? CH3_CLAUSES : null),
  '제7장_진해거담제':   () => (typeof CH7_CLAUSES !== 'undefined' ? CH7_CLAUSES : null),
  '제9장_비염용경구제': () => (typeof CH9_CLAUSES !== 'undefined' ? CH9_CLAUSES : null),
};

function _clauseForReason(chapterKey, reason, gubun) {
  const table = _CLAUSE_TABLES[chapterKey]?.();
  if (!table) return null;
  const r = String(reason || '');
  const g = String(gubun || '');

  // 근거 조건이 붙은 조항만 모아, 좁은 것(우선 큰 것)부터 본다
  const cands = table
    .filter(row => row[3])
    .map(row => ({ sec: row[0], no: row[1], c: row[3] }))
    .sort((a, b) => (b.c.우선 ?? 0) - (a.c.우선 ?? 0) || a.no - b.no);

  for (const { sec, no, c } of cands) {
    if (c.구분 && !c.구분.test(g)) continue;
    if (c.사유 && !c.사유.test(r)) continue;
    const SEC_KEY = { '종류': '유효성분의_종류', '분량': '유효성분의_분량',
                      '배합': '배합성분의_종류_및_배합한도' };
    const arr = DB[chapterKey]?.['기준']?.[SEC_KEY[sec]];
    if (!Array.isArray(arr) || !arr[no - 1]) continue;
    const LABEL = { '종류': '유효성분의 종류', '분량': '유효성분의 분량',
                    '배합': '배합성분의 종류 및 배합한도' };
    return { label: `${LABEL[sec]} ${no})`, text: arr[no - 1] };
  }
  return null;
}

function generateFullWordDoc(mode) {
  _exportMode = (mode === 'pdf') ? 'pdf' : 'word';
  try { return _generateFullWordDoc(); }
  finally { _exportMode = 'word'; }   // 다음 호출에 영향이 남지 않게
}

function _generateFullWordDoc() {
  const rawProductName = ($('product-name')?.value || '').trim() || '(제품명)';
  const ch = chaptersMap[currentKey];
  const form = $('sel-dosage-form').value;

  // 허가사항에 쓰는 품목명은 제형까지 붙인 이름이다.
  // 캡슐제인데 제품명에 "연질캡슐"이 없으면 붙여 준다 (푸루콜드 → 푸루콜드연질캡슐).
  // 이미 들어 있으면 두 번 붙이지 않는다.
  const productName = (form && form.includes('캡슐') && !rawProductName.includes('연질캡슐'))
    ? rawProductName + '연질캡슐'
    : rawProductName;
  const validDosageRows = dosageRows.filter(dr => dr.age);
  const activeRows = currentKey === '제1장_비타민미네랄' ? getCh1ActiveRows()
                   : isMatrixMode() ? getMatrixActiveRows()
                   : ingredientRows.filter(r => r.ingr && r.dose);
  if (!ch || !form || !validDosageRows.length || !activeRows.length) {
    alert('장·제형·연령·성분을 모두 입력한 후 실행해 주세요.');
    return;
  }

  const unit = dosageUnit || '정';
  const refDr = validDosageRows[0];
  const refDosage = { freqMin: refDr.freqMin, freqMax: refDr.freqMax,
                      amtMin: refDr.amtMin,   amtMax: refDr.amtMax };

  const allValidations = [];
  for (const dr of validDosageRows) {
    const dosage = { freqMin: dr.freqMin, freqMax: dr.freqMax,
                     amtMin: dr.amtMin,   amtMax: dr.amtMax, unit };
    let v = null;
    if (currentKey === '제1장_비타민미네랄')
      v = validateChapter1(DB['제1장_비타민미네랄']['표'], form, dr.age, activeRows, dosage);
    else if (currentKey === '제2장_해열진통제')
      v = validateChapter2(DB['제2장_해열진통제']['표'], form, dr.age, activeRows, dosage);
    else if (currentKey === '제3장_감기약')
      v = validateChapter3(DB['제3장_감기약']['표'], form, dr.age, activeRows, dosage);
    else if (currentKey === '제7장_진해거담제')
      v = validateChapter7(DB['제7장_진해거담제']['표'], form, dr.age, activeRows, dosage);
    else if (currentKey === '제9장_비염용경구제')
      v = validateChapter9(DB['제9장_비염용경구제']['표'], form, dr.age, activeRows, dosage);
    if (v) allValidations.push({ dr, v });
  }

  const effResult    = generateEfficacy(currentKey, form, activeRows, refDosage);
  const precSections = generatePrecautions(currentKey, form, activeRows, selectedExcipients, dosageRows);

  // Shared styles
  const FN   = "font-family:'맑은 고딕',Arial,sans-serif;";
  const HL   = 'background:#FFFF00;';
  const DIM  = 'color:#bbb;';
  const BORD = 'border:1px solid #a0a0a0;';
  const TD   = `${FN}font-size:10pt;padding:4pt 6pt;${BORD}vertical-align:top;`;
  const TH   = `${FN}font-size:10pt;padding:4pt 6pt;${BORD}font-weight:bold;text-align:center;background:#E8EEF7;`;
  const TH2  = `${FN}font-size:10pt;padding:4pt 6pt;${BORD}font-weight:bold;text-align:center;background:#d6e4f5;`;
  const TH3  = `${FN}font-size:10pt;padding:4pt 6pt;${BORD}font-weight:bold;text-align:center;background:#d9f0e0;`;
  const SEC  = `${FN}font-size:11pt;font-weight:bold;color:#1a4b8c;margin:16pt 0 5pt;line-height:1.3;`;
  const fmt  = v => v != null ? (+v).toLocaleString('ko-KR', { maximumFractionDigits: 4 }) : '—';
  const chLabel = ch.label || currentKey;

  let body = '';

  // ── ch2 전용 서식 (해열진통제) ──
  if (currentKey === '제2장_해열진통제') {
    // (1) 제목 — 좌측 정렬, 제품명 + 연질캡슐 고정
    body += `<p style="${FN}font-size:16pt;font-weight:bold;color:#1a4b8c;text-align:left;margin:0 0 16pt;">${esc(productName)}</p>`;

    // (1-a) [원료약품 및 그 분량]
    // 7열 표를 Word 페이지 너비에 맞게: table-layout:fixed + colgroup + 소형 폰트/패딩
    const THRAW  = `${FN}font-size:9pt;padding:2pt 4pt;${BORD}font-weight:bold;text-align:center;word-break:keep-all;vertical-align:middle;mso-vertical-align-alt:middle;line-height:1.15;`;
    const TH2R   = THRAW + 'background:#d5e2f2;';
    const TH3R   = THRAW + 'background:#daebdd;';
    const TDRAW  = `${FN}font-size:9.5pt;padding:2pt 5pt;${BORD}vertical-align:middle;mso-vertical-align-alt:middle;word-break:keep-all;line-height:1.2;`;
    body += `<p class="sec-head" style="${FN}font-size:11pt;font-weight:bold;color:#1a4b8c;margin:16pt 0 5pt;line-height:1.3;">[원료약품 및 그 분량]</p>`;
    {
      // 연령별로 각각 표 출력 — 연령계수로 인해 표제기 기준값(1회최대/최소, 1일최대)이
      // 연령마다 다르므로 동일 용법이더라도 병합하지 않음
      const ingrGroups2 = allValidations.map(({ dr, v }) => ({
        key: String(dr.id),
        dr,
        v,
        labels: [displayAgeLabel(dr.age, currentKey, currentForm) || dr.age],
      }));
      const multiGrp2 = ingrGroups2.length > 1;
      // 그룹이 없는 경우(검토 전) fallback: activeRows로 빈 표 1개 출력
      if (!ingrGroups2.length) {
        body += `<table style="width:100%;border-collapse:collapse;margin-bottom:12pt;table-layout:fixed;mso-table-layout-alt:fixed;">`;
        body += `<colgroup><col style="width:8%;mso-width-source:userset;"><col style="width:22%;mso-width-source:userset;"><col style="width:12%;mso-width-source:userset;"><col style="width:13%;mso-width-source:userset;"><col style="width:12%;mso-width-source:userset;"><col style="width:16%;mso-width-source:userset;"><col style="width:17%;mso-width-source:userset;"></colgroup>`;
        body += `<thead><tr><th colspan="5" style="${TH2R}">의약품 표준제조기준</th><th colspan="2" style="${TH3R}">${esc(productName)}</th></tr>`;
        body += `<tr><th style="${TH2R}">구분</th><th style="${TH2R}">유효성분명</th><th style="${TH2R}">1회최대<br>분량(mg)</th><th style="${TH2R}">1일최대<br>분량(mg)</th><th style="${TH2R}">1회최소<br>분량(mg)</th><th style="${TH3R}">1회<br>용량(mg)</th><th style="${TH3R}">1일용량(mg)</th></tr></thead><tbody>`;
        for (const r of activeRows) {
          body += `<tr><td style="${TDRAW}text-align:center;">${esc(r.gubun||'—')}</td><td style="${TDRAW}">${esc(r.ingr)}</td><td style="${TDRAW}text-align:center;">—</td><td style="${TDRAW}text-align:center;">—</td><td style="${TDRAW}text-align:center;">—</td><td style="${TDRAW}text-align:right;">${esc(r.dose)}</td><td style="${TDRAW}text-align:center;">—</td></tr>`;
        }
        body += `</tbody></table>`;
      }
      for (const grp of ingrGroups2) {
        const { dr, v, labels } = grp;
        // 병합 연령 레이블 생성
        let ageLbl2;
        if (labels.length === 1) {
          ageLbl2 = labels[0];
        } else {
          const firstLbl = labels[0];
          const lastLbl  = labels[labels.length - 1];
          const lowerM   = lastLbl.match(/^(.+?이상)/);
          const lower    = lowerM ? lowerM[1] : lastLbl;
          const upperM   = firstLbl.match(/(만\s*\d+세\s*미만)$/);
          ageLbl2 = upperM ? `${lower} ~ ${upperM[1]}` : lower;
        }
        // 연령 소제목 (복수 그룹일 때만)
        if (multiGrp2) {
          body += `<p style="${FN}font-size:9.5pt;font-weight:bold;color:#1a4b8c;margin:5pt 0 2pt;">▶ ${esc(ageLbl2)}</p>`;
        }
        body += `<table style="width:100%;border-collapse:collapse;margin-bottom:${multiGrp2?'8':'12'}pt;table-layout:fixed;mso-table-layout-alt:fixed;">`;
        body += `<colgroup>`;
        body += `<col style="width:8%;mso-width-source:userset;">`;
        body += `<col style="width:22%;mso-width-source:userset;">`;
        body += `<col style="width:12%;mso-width-source:userset;">`;
        body += `<col style="width:13%;mso-width-source:userset;">`;
        body += `<col style="width:12%;mso-width-source:userset;">`;
        body += `<col style="width:16%;mso-width-source:userset;">`;
        body += `<col style="width:17%;mso-width-source:userset;">`;
        body += `</colgroup>`;
        body += `<thead><tr>`;
        body += `<th colspan="5" style="${TH2R}">의약품 표준제조기준</th>`;
        body += `<th colspan="2" style="${TH3R}">${esc(productName)}</th>`;
        body += `</tr><tr>`;
        body += `<th style="${TH2R}">구분</th>`;
        body += `<th style="${TH2R}">유효성분명</th>`;
        body += `<th style="${TH2R}">1회최대<br>분량(mg)</th>`;
        body += `<th style="${TH2R}">1일최대<br>분량(mg)</th>`;
        body += `<th style="${TH2R}">1회최소<br>분량(mg)</th>`;
        body += `<th style="${TH3R}">1회<br>용량(mg)</th>`;
        {
          const freqDispW = dr.freqMin === dr.freqMax ? `1일 ${dr.freqMax}회` : `1일 ${dr.freqMin}~${dr.freqMax}회`;
          const amtDispW  = dr.amtMin  === dr.amtMax  ? `1회 ${dr.amtMax}${unit}` : `1회 ${dr.amtMin}~${dr.amtMax}${unit}`;
          body += `<th style="${TH3R}">1일용량(mg)<br>(${esc(freqDispW)},<br>${esc(amtDispW)})</th>`;
        }
        body += `</tr></thead><tbody>`;
        if (v && v.itemResults && v.itemResults.length) {
          for (const r of v.itemResults) {
            const fail2   = r.ok === false;
            const rowBg2  = fail2 ? 'background:#fff5f5;' : '';
            const ingrRow2 = activeRows.find(ar => ar.ingr === r.ingr);
            const std1max2  = r.allowed?.max1dose ?? null;
            const std1dmax2 = r.allowed?.max1d    ?? r.critMax ?? null;
            const std1min2  = r.allowed?.min1dose ?? null;
            const act12     = r.actual?.max1dose  ?? (ingrRow2 ? +(parseFloat(ingrRow2.dose) * dr.amtMax).toFixed(4) : null);
            const act1d2    = r.actual?.max1d     ?? r.dailyMax ?? null;
            body += `<tr style="${rowBg2}">`;
            body += `<td style="${TDRAW}text-align:center;">${esc(r.gubun || '—')}</td>`;
            body += `<td style="${TDRAW}">${esc(r.ingr)}</td>`;
            body += `<td style="${TDRAW}text-align:right;background:#edf3fb;">${fmt(std1max2)}</td>`;
            body += `<td style="${TDRAW}text-align:right;background:#edf3fb;">${fmt(std1dmax2)}</td>`;
            body += `<td style="${TDRAW}text-align:right;background:#edf3fb;">${fmt(std1min2)}</td>`;
            body += `<td style="${TDRAW}text-align:right;background:#edfaf1;">${fmt(act12)}</td>`;
            body += `<td style="${TDRAW}text-align:right;background:#edfaf1;">${fmt(act1d2)}</td>`;
            body += `</tr>`;
            if (fail2 && r.reason && r.reason !== '부적합') {
              body += `<tr style="background:#fdf2f2;"><td colspan="7" style="${TDRAW}font-size:8pt;color:#c62828;padding:1pt 6pt;">↳ ${esc(r.reason)}</td></tr>`;
            }
          }
        } else {
          for (const r of activeRows) {
            body += `<tr>`;
            body += `<td style="${TDRAW}text-align:center;">${esc(r.gubun || '—')}</td>`;
            body += `<td style="${TDRAW}">${esc(r.ingr)}</td>`;
            body += `<td style="${TDRAW}text-align:center;">—</td>`;
            body += `<td style="${TDRAW}text-align:center;">—</td>`;
            body += `<td style="${TDRAW}text-align:center;">—</td>`;
            body += `<td style="${TDRAW}text-align:right;">${esc(r.dose)}</td>`;
            body += `<td style="${TDRAW}text-align:center;">—</td>`;
            body += `</tr>`;
          }
        }
        body += `</tbody></table>`;
      }
    }

    // (1-b) [유효성분의 종류] & [유효성분의 분량] — O/X 자동 검증
    {
      const kinds2 = DB['제2장_해열진통제']?.['기준']?.['유효성분의_종류'] ?? [];
      const amts2  = DB['제2장_해열진통제']?.['기준']?.['유효성분의_분량'] ?? [];
      const { kindsSt: kSt2, amtsSt: aSt2 } = computeCh2KindsAmtsStatus(allValidations);

      // O/X 셀 스타일
      const OKST  = `${FN}font-size:13pt;font-weight:bold;color:#2e7d32;text-align:center;padding:2pt 3pt;${BORD}`;
      const NGST  = `${FN}font-size:13pt;font-weight:bold;color:#c62828;text-align:center;padding:2pt 3pt;${BORD}`;
      const NAST  = `${FN}font-size:10pt;color:#aaa;text-align:center;padding:2pt 3pt;${BORD}`;

      const renderCheckTable2 = (items, statusArr) => {
        if (!items.length) return '';
        let s = `<table style="width:100%;border-collapse:collapse;margin-bottom:10pt;table-layout:fixed;">`;
        s += `<colgroup><col style="width:87%;mso-width-source:userset;"><col style="width:13%;mso-width-source:userset;"></colgroup>`;
        s += `<thead><tr>`;
        s += `<th style="${TH}">세부내용</th>`;
        s += `<th style="${TH}text-align:center;">확인<br>(적합&amp;부적합)</th>`;
        s += `</tr></thead><tbody>`;
        items.forEach((item, i) => {
          const st = statusArr?.[i];
          let mark = '', cellStyle = NAST;
          if (st && !st.na) {
            if (st.ok)  { mark = 'O'; cellStyle = OKST; }
            else        { mark = 'X'; cellStyle = NGST; }
          } else { mark = '—'; }
          const reasonTxt = (st && !st.ok && !st.na && st.reason)
            ? `<br><span style="${FN}font-size:8pt;color:#c62828;">↳ ${esc(st.reason)}</span>` : '';
          const rowBg = (st && !st.ok && !st.na) ? 'background:#fff5f5;' : '';
          s += `<tr style="${rowBg}">`;
          s += `<td style="${TD}">${i+1}) ${esc(item)}${reasonTxt}</td>`;
          s += `<td style="${cellStyle}">${mark}</td>`;
          s += `</tr>`;
        });
        s += `</tbody></table>`;
        return s;
      };
      if (kinds2.length) {
        body += `<p class="sec-head" style="${FN}font-size:11pt;font-weight:bold;color:#1a4b8c;margin:16pt 0 5pt;line-height:1.3;">[유효성분의 종류]</p>`;
        body += renderCheckTable2(kinds2, kSt2);
      }
      if (amts2.length) {
        body += `<p class="sec-head" style="${FN}font-size:11pt;font-weight:bold;color:#1a4b8c;margin:16pt 0 5pt;line-height:1.3;">[유효성분의 분량]</p>`;
        body += renderCheckTable2(amts2, aSt2);
      }
    }

    // (2) [효능효과] — plain text, no table
    body += `<p>&nbsp;</p><p>&nbsp;</p>`;
    body += `<p class="sec-head" style="${FN}font-size:11pt;font-weight:bold;color:#1a4b8c;margin:16pt 0 5pt;line-height:1.3;">[효능효과]</p>`;
    const effDbItems2 = DB['제2장_해열진통제']?.['기준']?.['효능효과'] ?? [];
    body += `<p style="${FN}font-size:10pt;margin:0 0 4pt;">효능 및 효과의 범위는 다음 범위로 한다.</p>`;
    effDbItems2.forEach((t, i) => {
      body += `<p style="${FN}font-size:10pt;margin:0 0 3pt;padding-left:12pt;">${i+1}) ${esc(applyEasyTerms(t))}</p>`;
    });
    body += `<p>&nbsp;</p><p>&nbsp;</p>`;

    // (3) [용법용량] — 2-col table
    body += `<p class="sec-head" style="${FN}font-size:11pt;font-weight:bold;color:#1a4b8c;margin:16pt 0 5pt;line-height:1.3;">[용법용량]</p>`;
    body += `<table class="tall-rows" style="width:100%;border-collapse:collapse;margin-bottom:14pt;"><thead><tr>`;
    body += `<th style="${TH}width:50%;">의약품 표준제조기준</th>`;
    body += `<th style="${TH}width:50%;">${esc(productName)}</th>`;
    body += `</tr></thead><tbody><tr>`;
    let dos2L = '', dos2R = '';
    {
      const tbl3 = DB[currentKey]?.['표']?.['표3_연령구분계수'] ?? [];
      dos2L += `<p style="margin:0 0 4pt;font-weight:bold;">(4) 용법&#xB7;용량</p>`;
      dos2L += `<p style="margin:0 0 2pt;font-weight:bold;">1) 용법은 다음과 같이 한다.</p>`;
      dos2L += `<p style="margin:0 0 1pt;padding-left:10pt;">① 1일 1회 복용하는 경우</p>`;
      dos2L += `<p style="margin:0 0 5pt;padding-left:20pt;">1일 1회까지로 하고 공복시를 피하여 복용한다.</p>`;
      dos2L += `<p style="margin:0 0 1pt;padding-left:10pt;">② 1일 2회 복용하는 경우</p>`;
      dos2L += `<p style="margin:0 0 1pt;padding-left:20pt;">1일 2회까지로 하고 공복시를 피하여 복용한다.</p>`;
      dos2L += `<p style="margin:0 0 5pt;padding-left:20pt;">복용 간격은 6시간 이상으로 한다.</p>`;
      dos2L += `<p style="margin:0 0 1pt;padding-left:10pt;">③ 1일 3회 복용하는 경우</p>`;
      dos2L += `<p style="margin:0 0 1pt;padding-left:20pt;">1일 3회까지로 하고 공복시를 피하여 복용한다.</p>`;
      dos2L += `<p style="margin:0 0 8pt;padding-left:20pt;">복용간격은 4시간 이상으로 한다.</p>`;
      dos2L += `<p style="margin:0 0 4pt;"><b>3)</b> 캡슐제, 정제(추어블정 및 발포정 제외)는 만 7세 이하의 영&#xB7;유아의 복용은 인정하지 아니한다. 또한, 추어블정에 대해서는 원칙적으로 만 3세 미만을 대상으로 하는 용법은 인정하지 않는다.</p>`;
      if (tbl3.length) {
        dos2L += `<p style="margin:6pt 0 3pt;font-weight:bold;">&lt;표3&gt; 연령 구분별 용량의 환산 계수표</p>`;
        dos2L += `<table style="width:100%;border-collapse:collapse;font-size:9pt;font-family:'맑은 고딕',Arial,sans-serif;margin-bottom:4pt;">`;
        dos2L += `<tr><th style="border:1px solid #888;padding:3pt 6pt;background:#e8eef7;text-align:center;width:75%;">연령구분</th>`;
        dos2L += `<th style="border:1px solid #888;padding:3pt 6pt;background:#e8eef7;text-align:center;width:25%;">계수</th></tr>`;
        tbl3.forEach(row => {
          dos2L += `<tr><td style="border:1px solid #888;padding:3pt 6pt;">${esc(row['연령구분'])}</td>`;
          dos2L += `<td style="border:1px solid #888;padding:3pt 6pt;text-align:center;">${esc(row['계수'])}</td></tr>`;
        });
        dos2L += `</table>`;
      }
      // DB 용법용량에서 공복/복용간격 부가 설명 추출 (freq → {hasFasting, interval})
      const freqSupp = {};
      for (const entry of (DB[currentKey]?.['기준']?.['용법용량'] ?? [])) {
        const fm = entry.match(/^1일\s*(\d+)회/);
        if (!fm) continue;
        const freq = parseInt(fm[1]);
        const hasFasting = entry.includes('공복');
        const intM = entry.match(/(복용\s*간격은\s*\d+시간\s*이상으로 한다)/);
        freqSupp[freq] = { hasFasting, interval: intM ? intM[1] : null };
      }

      // 연속된 동일 용량 연령군 합치기
      const dKey = dr => `${dr.freqMin}|${dr.freqMax}|${dr.amtMin}|${dr.amtMax}`;
      const groups2 = [];
      for (const dr of validDosageRows) {
        const lbl = displayAgeLabel(dr.age, currentKey, currentForm) || dr.age;
        if (groups2.length && groups2[groups2.length-1].key === dKey(dr)) {
          groups2[groups2.length-1].labels.push(lbl);
        } else {
          groups2.push({ key: dKey(dr), dr, labels: [lbl] });
        }
      }
      for (const g of groups2) {
        const { dr, labels } = g;
        const freqStr = dr.freqMin === dr.freqMax ? `1일 ${dr.freqMax}회` : `1일 ${dr.freqMin}~${dr.freqMax}회`;
        const amtStr  = dr.amtMin  === dr.amtMax  ? `1회 ${dr.amtMax}${unit}` : `1회 ${dr.amtMin}~${dr.amtMax}${unit}`;
        let ageLbl;
        if (labels.length === 1) {
          ageLbl = labels[0];
        } else {
          const firstLbl = labels[0];
          const lastLbl  = labels[labels.length - 1];
          const lowerM = lastLbl.match(/^(.+?이상)/);
          const lower  = lowerM ? lowerM[1] : lastLbl;
          const upperM = firstLbl.match(/(만\s*\d+세\s*미만)$/);
          ageLbl = upperM ? `${lower} - ${upperM[1]}` : lower;
        }
        dos2R += `<p style="margin:0 0 2pt;"><b>${esc(ageLbl)}</b>: ${esc(freqStr)}, ${esc(amtStr)}</p>`;
      }
      // 부가 문구(공복/복용간격)는 중복 제거 후 연령군 전체 아래에 한 번만 출력
      let needFasting = false;
      const intervals = new Set();
      for (const g of groups2) {
        const supp = freqSupp[g.dr.freqMax];
        if (supp?.hasFasting) needFasting = true;
        if (supp?.interval) intervals.add(supp.interval);
      }
      if (needFasting || intervals.size) {
        dos2R += `<p style="margin:4pt 0 1pt;">`;
        dos2R += `</p>`;
        if (needFasting)
          dos2R += `<p style="margin:0 0 1pt;">공복(빈 속)시를 피하여 복용한다.</p>`;
        for (const iv of intervals)
          dos2R += `<p style="margin:0 0 1pt;">${esc(iv)}.</p>`;
      }
    }
    body += `<td style="${TD}">${dos2L}</td>`;
    body += `<td style="${TD}">${dos2R || `<span style="color:#aaa;">(입력 없음)</span>`}</td>`;
    body += `</tr></tbody></table>`;

    // [사용상의 주의사항] — 공용 함수 (모든 장이 같은 표를 쓴다)
    body += _wordPrecautionSection({
      chapterKey: currentKey, form, activeRows, doseRows: dosageRows, precSections,
      productName, FN, TH, TD, HL, DIM,
    });

    _wordDownload(productName, body);
    return;
  }

  // ── ch3/ch7/ch9 감기약·진해거담제·비염 전용 서식 (ch2와 동일 레이아웃) ──
  if (isMatrixMode() && currentKey !== '제1장_비타민미네랄') {
    const THRAW  = `${FN}font-size:9pt;padding:2pt 4pt;${BORD}font-weight:bold;text-align:center;word-break:keep-all;vertical-align:middle;mso-vertical-align-alt:middle;line-height:1.15;`;
    const TH2R   = THRAW + 'background:#d5e2f2;';
    const TH3R   = THRAW + 'background:#daebdd;';
    const TDRAW  = `${FN}font-size:9.5pt;padding:2pt 5pt;${BORD}vertical-align:middle;mso-vertical-align-alt:middle;word-break:keep-all;line-height:1.2;`;

    // (1) 제목 — 제품명만
    body += `<p style="${FN}font-size:16pt;font-weight:bold;color:#1a4b8c;text-align:left;margin:0 0 16pt;">${esc(productName)}</p>`;

    // (2) [원료약품 및 그 분량]
    body += `<p class="sec-head" style="${FN}font-size:11pt;font-weight:bold;color:#1a4b8c;margin:0 0 4pt;">[원료약품 및 그 분량]</p>`;
    {
      const ingrGrpsMx = allValidations.map(({ dr, v }) => ({
        dr, v, labels: [displayAgeLabel(dr.age, currentKey, currentForm) || dr.age],
      }));
      const multiGrpMx = ingrGrpsMx.length > 1;
      // 연령 그룹이 없으면 activeRows로 빈 표 출력
      if (!ingrGrpsMx.length) {
        body += `<table style="width:100%;border-collapse:collapse;margin-bottom:12pt;table-layout:fixed;mso-table-layout-alt:fixed;">`;
        body += `<colgroup><col style="width:28%;mso-width-source:userset;"><col style="width:13%;mso-width-source:userset;"><col style="width:13%;mso-width-source:userset;"><col style="width:15%;mso-width-source:userset;"><col style="width:16%;mso-width-source:userset;"><col style="width:15%;mso-width-source:userset;"></colgroup>`;
        body += `<thead><tr><th colspan="3" style="${TH2R}">의약품 표준제조기준</th><th colspan="2" style="${TH3R}">${esc(productName)}</th><th style="${TH2R}">적합<br>여부</th></tr>`;
        body += `<tr><th style="${TH2R}">유효성분명</th><th style="${TH2R}">1일최대<br>(mg)</th><th style="${TH2R}">1일최소<br>(mg)</th><th style="${TH3R}">1회용량<br>(mg)</th><th style="${TH3R}">1일용량<br>(mg)</th><th style="${TH2R}"></th></tr></thead><tbody>`;
        for (const r of activeRows) {
          body += `<tr><td style="${TDRAW}">${esc(r.ingr)}</td><td style="${TDRAW}text-align:center;">—</td><td style="${TDRAW}text-align:center;">—</td><td style="${TDRAW}text-align:right;">${esc(r.dose)}</td><td style="${TDRAW}text-align:center;">—</td><td style="${TDRAW}text-align:center;">—</td></tr>`;
        }
        body += `</tbody></table>`;
      }
      for (const grp of ingrGrpsMx) {
        const { dr, v, labels } = grp;
        const ageLblMx = labels[0];
        const freqDispW = dr.freqMin === dr.freqMax ? `1일 ${dr.freqMax}회` : `1일 ${dr.freqMin}~${dr.freqMax}회`;
        const amtDispW  = dr.amtMin  === dr.amtMax  ? `1회 ${dr.amtMax}${unit}` : `1회 ${dr.amtMin}~${dr.amtMax}${unit}`;
        if (multiGrpMx) {
          // 연령별로 기준값이 달라지는 근거(연령구분계수)와 그 연령의 용법용량을 함께 적는다
          const coefMx = _ageCoefLabel(currentKey, dr.age);
          body += `<p class="sec-head" style="${FN}font-size:9.5pt;font-weight:bold;color:#1a4b8c;margin:6pt 0 2pt;">▶ ${esc(ageLblMx)}`
                + (coefMx ? `<span style="font-weight:normal;color:#555;"> · 연령구분계수 ${esc(coefMx)}</span>` : '')
                + `<span style="font-weight:normal;color:#555;"> · ${esc(freqDispW)}, ${esc(amtDispW)}</span></p>`;
        }
        body += `<table style="width:100%;border-collapse:collapse;margin-bottom:${multiGrpMx?'8':'12'}pt;table-layout:fixed;mso-table-layout-alt:fixed;">`;
        body += `<colgroup><col style="width:9%;mso-width-source:userset;"><col style="width:31%;mso-width-source:userset;"><col style="width:11%;mso-width-source:userset;"><col style="width:11%;mso-width-source:userset;"><col style="width:13%;mso-width-source:userset;"><col style="width:13%;mso-width-source:userset;"><col style="width:12%;mso-width-source:userset;"></colgroup>`;
        body += `<thead><tr>`;
        body += `<th colspan="4" style="${TH2R}">의약품 표준제조기준</th>`;
        body += `<th colspan="2" style="${TH3R}">${esc(productName)}</th>`;
        body += `<th style="${TH2R}" rowspan="2">적합<br>여부</th>`;
        body += `</tr><tr>`;
        body += `<th style="${TH2R}">구분</th>`;
        body += `<th style="${TH2R}">유효성분명</th>`;
        body += `<th style="${TH2R}">1일최대<br>(mg)</th>`;
        body += `<th style="${TH2R}">1일최소<br>(mg)</th>`;
        body += `<th style="${TH3R}">1회용량<br>(mg)</th>`;
        body += `<th style="${TH3R}">1일용량<br>(mg)</th>`;
        body += `</tr></thead><tbody>`;
        if (v && v.itemResults && v.itemResults.length) {
          let lastGubun = null;
          for (const r of v.itemResults) {
            /* 구분은 행마다 적는다. 같은 항이 이어질 때 비워 두었더니
               "육계는 다란인데 인삼은 빈칸"으로 보여 빠뜨린 것처럼 읽혔다.
               괄호 안 설명(항히스타민제 등)은 떼고 항 번호만 남긴다 —
               열이 좁아 통째로 넣으면 두세 줄로 접힌다. */
            const gubunShort = g => String(g || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
            const gubunCell = gubunShort(r.gubun);
            const fail = r.ok === false;
            const rowBg = fail ? 'background:#fff5f5;' : '';
            const ingrRow = activeRows.find(ar => ar.ingr === r.ingr);
            const act1 = r.dose1 != null ? +(r.dose1 * dr.amtMax).toFixed(4) : (ingrRow ? +(parseFloat(ingrRow.dose) * dr.amtMax).toFixed(4) : null);
            const act1d = r.dailyMax ?? null;
            // 동그라미 대신 그냥 문구로 — 인쇄물에서 더 잘 읽힌다
            const okMark = r.ok === true ? '적합' : r.ok === false ? '부적합' : '—';
            const okSt = `${FN}font-size:9pt;text-align:center;padding:3pt;${BORD}word-break:keep-all;`
                       + (r.ok === false ? 'color:#c62828;font-weight:bold;' : r.ok === true ? '' : 'color:#aaa;');
            body += `<tr style="${rowBg}">`;
            body += `<td style="${TDRAW}font-size:8.5pt;color:#3d4d63;">${esc(gubunCell)}</td>`;
            /* 실제 성분명을 적어 두었으면 그 이름을 앞세우고 표1 이름을
               괄호로 남긴다 — 허가사항에는 실제 이름이 들어가고,
               어느 기준으로 봤는지도 함께 보여야 한다. */
            const _act = (activeRows.find(a => a.ingr === r.ingr) || {}).actualName;
            body += `<td style="${TDRAW}">`
                  + (_act ? `${esc(_act)}<br><span style="font-size:8pt;color:#6a7686;">(${esc(r.ingr)})</span>`
                          : esc(r.ingr))
                  + `</td>`;
            body += `<td style="${TDRAW}text-align:right;background:#f2f6fb;">${fmt(r.critMax)}</td>`;
            body += `<td style="${TDRAW}text-align:right;background:#f2f6fb;">${fmt(r.critMin)}</td>`;
            body += `<td style="${TDRAW}text-align:right;background:#f1f8f3;">${fmt(act1)}</td>`;
            body += `<td style="${TDRAW}text-align:right;background:#f1f8f3;">${fmt(act1d)}</td>`;
            body += `<td style="${okSt}">${okMark}</td>`;
            body += `</tr>`;
            if (fail && r.reason) {
              const cite = _clauseForReason(currentKey, r.reason, r.gubun);
              body += `<tr style="background:#fdf2f2;"><td colspan="7" style="${TDRAW}font-size:8.5pt;color:#b3261e;padding:1pt 6pt 2pt 6pt;">↳ ${esc(r.reason)}`
                    + (cite ? `<br><span style="color:#6a7686;font-size:8pt;">〔${esc(cite.label)}〕 ${esc(cite.text)}</span>` : '')
                    + `</td></tr>`;
            }
          }
          // 배합 규칙 위반 별도 표시
          if (v.ruleErrors && v.ruleErrors.some(e => !e.ok)) {
            body += `<tr style="background:#fdf2f2;"><td colspan="7" style="${TDRAW}font-size:8.5pt;color:#b3261e;font-weight:bold;padding:2pt 6pt;">⚠ 배합 규칙 위반</td></tr>`;
            for (const re of v.ruleErrors.filter(e => !e.ok)) {
              body += `<tr style="background:#fdf2f2;"><td colspan="7" style="${TDRAW}font-size:8.5pt;color:#b3261e;padding:1pt 6pt;">↳ ${esc(re.reason || re.key)}</td></tr>`;
            }
          }
        } else {
          for (const r of activeRows) {
            body += `<tr><td style="${TDRAW}text-align:center;">${esc(r.gubun||'—')}</td><td style="${TDRAW}">${esc(r.ingr)}</td><td style="${TDRAW}text-align:center;">—</td><td style="${TDRAW}text-align:center;">—</td><td style="${TDRAW}text-align:right;">${esc(r.dose)}</td><td style="${TDRAW}text-align:center;">—</td><td style="${TDRAW}text-align:center;">—</td></tr>`;
          }
        }
        body += `</tbody></table>`;
      }

      // 배합 규칙 체크 표 (유효성분의 종류/분량)
      const kinds3 = DB[currentKey]?.['기준']?.['유효성분의_종류'] ?? [];
      const amts3  = DB[currentKey]?.['기준']?.['유효성분의_분량'] ?? [];
      // 조항별 적합여부 — 장마다 계산기가 따로 있다.
      // 계산기가 없는 장은 빈 배열이 되어 모든 칸이 "판정보류(—)"로 남는다
      // (근거 없는 "적합"이 나가지 않도록 일부러 이렇게 둔다).
      const RULE_STATUS_FN = {
        '제3장_감기약':       'computeCh3KindsAmtsStatus',
        '제7장_진해거담제':   'computeCh7KindsAmtsStatus',
        '제9장_비염용경구제': 'computeCh9KindsAmtsStatus',
      };
      const stFnName = RULE_STATUS_FN[currentKey];
      const st3 = (stFnName && typeof window[stFnName] === 'function')
        ? window[stFnName](allValidations, form, activeRows)
        : { kindsSt: [], amtsSt: [] };

      const renderCheckMx = (items, stList) => {
        if (!items.length) return '';
        let s = `<table style="width:100%;border-collapse:collapse;margin-bottom:10pt;table-layout:fixed;">`;
        // "해당사항 없음"이 한 줄에 들어가도록 확인 열을 넓혔다
        s += `<colgroup><col style="width:73%;mso-width-source:userset;"><col style="width:27%;mso-width-source:userset;"></colgroup>`;
        s += `<thead><tr><th style="${TH}">세부내용</th><th style="${TH}text-align:center;">확인</th></tr></thead><tbody>`;
        items.forEach((item, i) => {
          const st = (stList || [])[i] || { ok: null, na: false, reason: '' };
          // 슬래시 한 글자로는 무슨 뜻인지 알 수 없어 말로 적는다
          const mark = st.na ? '해당사항 없음'
                     : st.ok === true ? '적합'
                     : st.ok === false ? '부적합'
                     : '직접 확인 필요';
          const cellSt = `${FN}font-size:9pt;text-align:center;padding:3pt;${BORD}word-break:keep-all;`
            + (st.ok === false ? 'color:#c62828;font-weight:bold;'
               : st.ok === true ? '' : 'color:#aaa;');
          const why = (st.ok === false && st.reason)
            ? `<br><span style="font-size:8pt;color:#c62828;">↳ ${esc(st.reason)}</span>` : '';
          s += `<tr><td style="${TD}">${i+1}) ${esc(item)}${why}</td><td style="${cellSt}">${mark}</td></tr>`;
        });
        s += `</tbody></table>`;
        return s;
      };
      // 범례는 빼기로 했다 — 표만으로 읽힌다
      const legendMx = '';
      if (kinds3.length) {
        body += `<p class="sec-head" style="${FN}font-size:11pt;font-weight:bold;color:#1a4b8c;margin:16pt 0 5pt;line-height:1.3;">[유효성분의 종류]</p>`;
        body += legendMx;
        body += renderCheckMx(kinds3, st3.kindsSt);
      }
      if (amts3.length) {
        body += `<p class="sec-head" style="${FN}font-size:11pt;font-weight:bold;color:#1a4b8c;margin:16pt 0 5pt;line-height:1.3;">[유효성분의 분량]</p>`;
        body += renderCheckMx(amts3, st3.amtsSt);
      }
    }

    // (3) [효능효과]
    body += `<p>&nbsp;</p><p>&nbsp;</p>`;
    body += `<p class="sec-head" style="${FN}font-size:11pt;font-weight:bold;color:#1a4b8c;margin:16pt 0 5pt;line-height:1.3;">[효능효과]</p>`;
    if (effResult?.finalTexts?.length) {
      effResult.finalTexts.forEach(t => {
        body += `<p style="${FN}font-size:10pt;margin:0 0 4pt;">${esc(applyEasyTerms(t))}</p>`;
      });
    }
    // 표제기 원문은 어떤 성분이 있어야 그 효능을 쓸 수 있는지 표로 정해 두었다.
    // 어느 효능이 왜 들어갔는지(또는 왜 빠졌는지) 근거가 되므로 함께 싣는다.
    {
      const effCond = DB[currentKey]?.['기준']?.['효능효과']?.['효능효과_조건'] ?? [];
      if (effCond.length) {
        const okByLabel = new Map((effResult?.items ?? []).map(it => [it.label, it]));
        body += `<p style="${FN}font-size:9.5pt;font-weight:bold;color:#1a4b8c;margin:8pt 0 3pt;">효능효과 기재조건</p>`;
        body += `<table style="width:100%;border-collapse:collapse;margin-bottom:10pt;table-layout:fixed;">`;
        body += `<colgroup><col style="width:22%;"><col style="width:58%;"><col style="width:20%;"></colgroup>`;
        body += `<thead><tr><th style="${TH}">효능</th><th style="${TH}">필수 배합성분</th>`
              + `<th style="${TH}">기재<br>가능여부</th></tr></thead><tbody>`;
        for (const c of effCond) {
          // 판정 결과의 label은 "콧물·코막힘·재채기"처럼 가운뎃점, 원문은 쉼표를 쓴다
          const key = String(c['효능'] ?? '');
          const hit = okByLabel.get(key) ?? okByLabel.get(key.replace(/,\s*/g, '·'));
          const mark = hit ? (hit.ok ? '기재 가능' : '기재 불가') : '—';
          const st = `${FN}font-size:9pt;padding:3pt 4pt;${BORD}text-align:center;word-break:keep-all;`
                   + (hit && !hit.ok ? 'color:#c62828;' : hit ? '' : 'color:#aaa;');
          body += `<tr>`;
          body += `<td style="${FN}font-size:9pt;padding:3pt 4pt;${BORD}word-break:keep-all;">${esc(key)}</td>`;
          body += `<td style="${FN}font-size:9pt;padding:3pt 4pt;${BORD}word-break:keep-all;">${esc(c['필수성분'] ?? '')}</td>`;
          body += `<td style="${st}">${mark}</td>`;
          body += `</tr>`;
        }
        body += `</tbody></table>`;
      }
    }
    body += `<p>&nbsp;</p><p>&nbsp;</p>`;

    // (4) [용법용량] — 2-col
    body += `<p class="sec-head" style="${FN}font-size:11pt;font-weight:bold;color:#1a4b8c;margin:16pt 0 5pt;line-height:1.3;">[용법용량]</p>`;
    body += `<table class="tall-rows" style="width:100%;border-collapse:collapse;margin-bottom:14pt;"><thead><tr>`;
    body += `<th style="${TH}width:50%;">의약품 표준제조기준</th>`;
    body += `<th style="${TH}width:50%;">${esc(productName)}</th>`;
    body += `</tr></thead><tbody><tr>`;
    {
      let dosL = '', dosR = '';
      const dosDB = DB[currentKey]?.['기준']?.['용법용량'] ?? [];
      // 원문처럼 조항 번호를 붙인다 — 어느 조항인지 짚어 말할 수 있어야 한다
      dosDB.forEach((t, i) => {
        dosL += `<p style="margin:0 0 3pt;padding-left:14pt;text-indent:-14pt;">${i+1}) ${esc(t)}</p>`;
      });
      const tbl3mx = DB[currentKey]?.['표']?.['표3_연령구분계수'] ?? [];
      if (tbl3mx.length) {
        dosL += `<p style="margin:6pt 0 3pt;font-weight:bold;">&lt;표3&gt; 연령 구분별 용량의 환산 계수표</p>`;
        dosL += `<table style="width:100%;border-collapse:collapse;font-size:9pt;font-family:'맑은 고딕',Arial,sans-serif;margin-bottom:4pt;">`;
        dosL += `<tr><th style="border:1px solid #888;padding:3pt 6pt;background:#e8eef7;text-align:center;width:75%;">연령구분</th><th style="border:1px solid #888;padding:3pt 6pt;background:#e8eef7;text-align:center;width:25%;">계수</th></tr>`;
        tbl3mx.forEach(row => { dosL += `<tr><td style="border:1px solid #888;padding:3pt 6pt;">${esc(row['연령구분'])}</td><td style="border:1px solid #888;padding:3pt 6pt;text-align:center;">${esc(row['계수'])}</td></tr>`; });
        dosL += `</table>`;
      }
      const dGroups = [];
      const dKey = dr => `${dr.freqMin}|${dr.freqMax}|${dr.amtMin}|${dr.amtMax}`;
      for (const dr of validDosageRows) {
        const lbl = displayAgeLabel(dr.age, currentKey, currentForm) || dr.age;
        if (dGroups.length && dGroups[dGroups.length-1].key === dKey(dr)) {
          dGroups[dGroups.length-1].labels.push(lbl);
        } else { dGroups.push({ key: dKey(dr), dr, labels: [lbl] }); }
      }
      for (const g of dGroups) {
        const { dr, labels } = g;
        const freqStr = dr.freqMin === dr.freqMax ? `1일 ${dr.freqMax}회` : `1일 ${dr.freqMin}~${dr.freqMax}회`;
        const amtStr  = dr.amtMin  === dr.amtMax  ? `1회 ${dr.amtMax}${unit}` : `1회 ${dr.amtMin}~${dr.amtMax}${unit}`;
        dosR += `<p style="margin:0 0 2pt;"><b>${esc(labels.join(', '))}</b>: ${esc(freqStr)}, ${esc(amtStr)}</p>`;
      }
      body += `<td style="${TD}">${dosL || '<span style="color:#aaa;">(해당 없음)</span>'}</td>`;
      body += `<td style="${TD}">${dosR || '<span style="color:#aaa;">(입력 없음)</span>'}</td>`;
    }
    body += `</tr></tbody></table>`;

    // [사용상의 주의사항] — 공용 함수 (모든 장이 같은 표를 쓴다)
    body += _wordPrecautionSection({
      chapterKey: currentKey, form, activeRows, doseRows: dosageRows, precSections,
      productName, FN, TH, TD, HL, DIM,
    });

    _wordDownload(productName, body);
    return;
  }

  // ── 문서 제목 ──
  body += `<p style="${FN}font-size:16pt;font-weight:bold;color:#1a4b8c;text-align:left;margin:0 0 8pt;">${esc(productName)}${form && productName.includes(form) ? "" : esc(form)}</p>`;
  body += `<p style="${FN}font-size:14pt;font-weight:bold;text-align:center;margin:0 0 5pt;">의약품 표준제조기준 검토</p>`;
  body += `<p style="${FN}font-size:10pt;text-align:center;color:#555;margin:0 0 14pt;">`
        + `${esc(chLabel)} &nbsp;|&nbsp; 제형: ${esc(form)} &nbsp;|&nbsp; 제품명: <b>${esc(productName)}</b>`
        + ` &nbsp;|&nbsp; 생성일: ${new Date().toLocaleDateString('ko-KR')}</p>`;

  // ══════════════════════════════════════════
  // 1. [원료약품 및 그 분량]
  // ══════════════════════════════════════════
  body += `<p style="${SEC}">[원료약품 및 그 분량]</p>`;

  if (currentKey === '제1장_비타민미네랄') {
    // ch1 전용: 연령별 고정폭 7열 표
    const THRAW1 = `${FN}font-size:8pt;padding:2pt 3pt;${BORD}font-weight:bold;text-align:center;word-break:break-all;word-wrap:break-word;vertical-align:middle;`;
    const TH2R1  = THRAW1 + 'background:#d6e4f5;';
    const TH3R1  = THRAW1 + 'background:#d9f0e0;';
    const TDRAW1 = `${FN}font-size:8.5pt;padding:2pt 3pt;${BORD}vertical-align:middle;word-break:break-word;word-wrap:break-word;`;
    const ingrGrps1  = allValidations.map(({dr, v}) => ({ dr, v, lbl: displayAgeLabel(dr.age, currentKey, currentForm) || dr.age }));
    const multi1 = ingrGrps1.length > 1;
    const buildCh1IngrTable = (dr, v) => {
      const freqDispW = dr.freqMin === dr.freqMax ? `1일 ${dr.freqMax}회` : `1일 ${dr.freqMin}~${dr.freqMax}회`;
      const amtDispW  = dr.amtMin  === dr.amtMax  ? `1회 ${dr.amtMax}${unit}` : `1회 ${dr.amtMin}~${dr.amtMax}${unit}`;
      let t = `<table style="width:100%;border-collapse:collapse;margin-bottom:${multi1?'8':'12'}pt;table-layout:fixed;mso-table-layout-alt:fixed;">`;
      t += `<colgroup>`;
      t += `<col style="width:9%;mso-width-source:userset;">`;
      t += `<col style="width:23%;mso-width-source:userset;">`;
      t += `<col style="width:12%;mso-width-source:userset;">`;
      t += `<col style="width:13%;mso-width-source:userset;">`;
      t += `<col style="width:8%;mso-width-source:userset;">`;
      t += `<col style="width:17%;mso-width-source:userset;">`;
      t += `<col style="width:18%;mso-width-source:userset;">`;
      t += `</colgroup>`;
      t += `<thead><tr>`;
      t += `<th colspan="5" style="${TH2R1}">의약품 표준제조기준</th>`;
      t += `<th colspan="2" style="${TH3R1}">${esc(productName)}</th>`;
      t += `</tr><tr>`;
      t += `<th style="${TH2R1}">구분</th>`;
      t += `<th style="${TH2R1}">유효성분명</th>`;
      t += `<th style="${TH2R1}">1일최소분량</th>`;
      t += `<th style="${TH2R1}">1일최대분량</th>`;
      t += `<th style="${TH2R1}">단위</th>`;
      t += `<th style="${TH3R1}">1회용량</th>`;
      t += `<th style="${TH3R1}">1일용량<br>(${esc(freqDispW)},<br>${esc(amtDispW)})</th>`;
      t += `</tr></thead><tbody>`;
      if (v && v.itemResults && v.itemResults.length) {
        for (const r of v.itemResults) {
          const fail1 = r.ok === false;
          const rowBg1 = fail1 ? 'background:#fff5f5;' : '';
          const ingrRow1 = activeRows.find(ar => ar.ingr === r.ingr);
          const act1  = ingrRow1 ? +(parseFloat(ingrRow1.dose) * dr.amtMax).toFixed(4) : null;
          const act1d = r.dailyMax ?? null;
          const stdMin1 = r.critMin ?? null;
          const stdMax1 = r.critMax ?? null;
          const useU = r.useUnit ?? '';
          t += `<tr style="${rowBg1}">`;
          t += `<td style="${TDRAW1}text-align:center;">${esc(r.gubun || '—')}</td>`;
          t += `<td style="${TDRAW1}">${esc(r.ingr)}</td>`;
          t += `<td style="${TDRAW1}text-align:right;background:#edf3fb;">${fmt(stdMin1)}</td>`;
          t += `<td style="${TDRAW1}text-align:right;background:#edf3fb;">${fmt(stdMax1)}</td>`;
          t += `<td style="${TDRAW1}text-align:center;background:#edf3fb;">${esc(useU)}</td>`;
          t += `<td style="${TDRAW1}text-align:right;background:#edfaf1;">${fmt(act1)}</td>`;
          t += `<td style="${TDRAW1}text-align:right;background:#edfaf1;">${fmt(act1d)}</td>`;
          t += `</tr>`;
          if (fail1 && r.reason && r.reason !== '부적합') {
            t += `<tr style="background:#fdf2f2;"><td colspan="7" style="${TDRAW1}font-size:8pt;color:#c62828;padding:1pt 6pt;">↳ ${esc(r.reason)}</td></tr>`;
          }
        }
      } else {
        for (const r of activeRows) {
          t += `<tr><td style="${TDRAW1}text-align:center;">${esc(r.gubun||'—')}</td>`;
          t += `<td style="${TDRAW1}">${esc(r.ingr)}</td>`;
          t += `<td style="${TDRAW1}text-align:center;">—</td><td style="${TDRAW1}text-align:center;">—</td>`;
          t += `<td style="${TDRAW1}text-align:center;">${esc(r.unit||'')}</td>`;
          t += `<td style="${TDRAW1}text-align:right;">${esc(r.dose)}</td>`;
          t += `<td style="${TDRAW1}text-align:center;">—</td></tr>`;
        }
      }
      t += `</tbody></table>`;
      return t;
    };
    if (!ingrGrps1.length) {
      body += buildCh1IngrTable(refDr, null);
    }
    for (const { dr, v, lbl } of ingrGrps1) {
      if (multi1) body += `<p style="${FN}font-size:9.5pt;font-weight:bold;color:#1a4b8c;margin:5pt 0 2pt;">▶ ${esc(lbl)}</p>`;
      body += buildCh1IngrTable(dr, v);
    }
  } else {
    // 기타 장: 기존 형식
    body += `<table style="width:100%;border-collapse:collapse;margin-bottom:12pt;table-layout:fixed;">`;
    body += `<colgroup>`;
    body += `<col style="width:9%;"><col style="width:22%;"><col style="width:14%;"><col style="width:14%;"><col style="width:14%;"><col style="width:13%;"><col style="width:14%;">`;
    body += `</colgroup>`;
    body += `<thead><tr>`;
    body += `<th colspan="5" style="${TH2}">의약품 표준제조기준</th>`;
    body += `<th colspan="2" style="${TH3}">${esc(productName)}</th>`;
    body += `</tr><tr>`;
    body += `<th style="${TH2}">구분</th>`;
    body += `<th style="${TH2}">유효성분명</th>`;
    body += `<th style="${TH2}">1회최대분량(mg)</th>`;
    body += `<th style="${TH2}">1일최대분량(mg)</th>`;
    body += `<th style="${TH2}">1회최소분량(mg)</th>`;
    body += `<th style="${TH3}">1회용량(mg)</th>`;
    body += `<th style="${TH3}">1일용량(mg)<br>(1일 ${esc(String(refDr.freqMax))}회)</th>`;
    body += `</tr></thead><tbody>`;
    const v0 = allValidations[0]?.v;
    if (v0 && v0.itemResults && v0.itemResults.length) {
      for (const r of v0.itemResults) {
        const fail = r.ok === false;
        const rowBg = fail ? 'background:#fff5f5;' : '';
        const ingrRow = activeRows.find(ar => ar.ingr === r.ingr);
        const std1max  = r.allowed?.max1dose ?? null;
        const std1dmax = r.allowed?.max1d    ?? r.critMax ?? null;
        const std1min  = r.allowed?.min1dose ?? null;
        const act1     = r.actual?.max1dose  ?? (ingrRow ? +(parseFloat(ingrRow.dose) * refDr.amtMax).toFixed(4) : null);
        const act1d    = r.actual?.max1d     ?? r.dailyMax ?? null;
        body += `<tr style="${rowBg}">`;
        body += `<td style="${TD}text-align:center;font-size:9pt;">${esc(r.gubun || '—')}</td>`;
        body += `<td style="${TD}">${esc(r.ingr)}</td>`;
        body += `<td style="${TD}text-align:right;background:#edf3fb;">${fmt(std1max)}</td>`;
        body += `<td style="${TD}text-align:right;background:#edf3fb;">${fmt(std1dmax)}</td>`;
        body += `<td style="${TD}text-align:right;background:#edf3fb;">${fmt(std1min)}</td>`;
        body += `<td style="${TD}text-align:right;background:#edfaf1;">${fmt(act1)}</td>`;
        body += `<td style="${TD}text-align:right;background:#edfaf1;">${fmt(act1d)}</td>`;
        body += `</tr>`;
        if (fail && r.reason && r.reason !== '부적합') {
          body += `<tr style="background:#fdf2f2;"><td colspan="7" style="${TD}font-size:9pt;color:#c62828;padding:2pt 8pt;">↳ ${esc(r.reason)}</td></tr>`;
        }
      }
      if (allValidations.length > 1) {
        body += `<tr><td colspan="7" style="${TD}font-size:9pt;color:#666;font-style:italic;">※ 위 배합량은 첫 번째 연령군(${esc(displayAgeLabel(allValidations[0].dr.age, currentKey, currentForm))}) 기준입니다.</td></tr>`;
      }
    } else {
      for (const r of activeRows) {
        body += `<tr>`;
        body += `<td style="${TD}text-align:center;">${esc(r.gubun || '—')}</td>`;
        body += `<td style="${TD}">${esc(r.ingr)}</td>`;
        body += `<td style="${TD}text-align:center;">—</td>`;
        body += `<td style="${TD}text-align:center;">—</td>`;
        body += `<td style="${TD}text-align:center;">—</td>`;
        body += `<td style="${TD}text-align:right;">${esc(r.dose)}</td>`;
        body += `<td style="${TD}text-align:center;">—</td>`;
        body += `</tr>`;
      }
    }
    body += `</tbody></table>`;
  }

  // ══════════════════════════════════════════
  // 2. [유효성분의 종류 및 배합한도]
  // ══════════════════════════════════════════
  {
    const chDbObj2 = DB[currentKey];
    const v0c = allValidations[0]?.v;
    const failedRules = v0c ? (v0c.ruleErrors || []).filter(e => e.ok === false) : [];
    const failedItems = v0c ? (v0c.itemResults || []).filter(r => r.ok === false) : [];
    const SEC2 = `${FN}font-size:10pt;font-weight:bold;color:#1a4b8c;margin:10pt 0 3pt;`;

    const renderCriteriaTable = (items, startNum) => {
      if (!items.length) return '';
      let s = `<table style="width:100%;border-collapse:collapse;margin-bottom:8pt;">`;
      s += `<thead><tr>`;
      s += `<th style="${TH}width:6%;">번호</th>`;
      s += `<th style="${TH}width:94%;">의약품 표준제조기준 내용</th>`;
      s += `</tr></thead><tbody>`;
      items.forEach((item, i) => {
        s += `<tr><td style="${TD}text-align:center;font-weight:bold;">${startNum + i}</td>`;
        s += `<td style="${TD}">${esc(item)}</td></tr>`;
      });
      s += `</tbody></table>`;
      return s;
    };

    if (currentKey !== '제1장_비타민미네랄')
      body += `<p style="${SEC}">[유효성분의 종류 및 배합한도]</p>`;

    /* 제1장 조항별 적합여부는 아래 "2. [배합성분의 종류 및 배합한도]"에서
       조항 표로 낸다. 여기서 손으로 O/X를 매기던 것을 걷어냈다 —
       그 코드는 "예)"가 별도 조항으로 잘못 들어가 있던 것을 걸러 내는
       임시방편까지 안고 있었는데, 데이터를 원문에 맞추면서 필요 없어졌다. */
    if (currentKey === '제1장_비타민미네랄') {
      // 제목만 두고 표는 아래 조항 표가 그린다
    } else {
      const kinds = chDbObj2?.['기준']?.['유효성분의_종류'] ?? [];
      const amts  = chDbObj2?.['기준']?.['유효성분의_분량'] ?? [];
      if (kinds.length) {
        body += `<p style="${SEC2}">유효성분의 종류</p>`;
        body += renderCriteriaTable(kinds, 1);
      }
      if (amts.length) {
        body += `<p style="${SEC2}">유효성분의 분량</p>`;
        body += renderCriteriaTable(amts, 1);
      }
    }
    if (failedRules.length || failedItems.length) {
      const msgs = [
        ...failedRules.map(e => e.reason || e.key),
        ...failedItems.map(r => `${r.ingr}: ${r.reason}`),
      ];
      body += `<p style="${FN}font-size:9pt;color:#c62828;margin:0 0 8pt;"><b>부적합 항목:</b> ${msgs.map(esc).join(' / ')}</p>`;
    }
  }

  // ══════════════════════════════════════════
  // 2. [배합성분의 종류 및 배합한도] — 조항별 적합여부
  // ══════════════════════════════════════════
  if (currentKey === '제1장_비타민미네랄' && typeof computeCh1KindsAmtsStatus === 'function') {
    const mixItems = DB[currentKey]?.['기준']?.['배합성분의_종류_및_배합한도'] ?? [];
    if (mixItems.length) {
      const st1 = computeCh1KindsAmtsStatus(allValidations, form, activeRows);
      body += `<p class="sec-head" style="${SEC}">[배합성분의 종류 및 배합한도]</p>`;
      body += `<table style="width:100%;border-collapse:collapse;margin-bottom:10pt;table-layout:fixed;">`;
      body += `<colgroup><col style="width:73%;"><col style="width:27%;"></colgroup>`;
      body += `<thead><tr><th style="${TH}">세부내용</th><th style="${TH}text-align:center;">확인</th></tr></thead><tbody>`;
      mixItems.forEach((item, i) => {
        const st = (st1.kindsSt || [])[i] || { ok: null, na: false, reason: '' };
        const mark = st.na ? '해당사항 없음'
                   : st.ok === true ? '적합'
                   : st.ok === false ? '부적합'
                   : '직접 확인 필요';
        const cst = `${FN}font-size:9pt;text-align:center;padding:3pt;${BORD}word-break:keep-all;`
                  + (st.ok === false ? 'color:#b3261e;font-weight:bold;' : st.ok === true ? '' : 'color:#8a8f98;');
        const why = (st.ok === false && st.reason)
          ? `<br><span style="font-size:8pt;color:#b3261e;">↳ ${esc(st.reason)}</span>` : '';
        body += `<tr><td style="${TD}">${i + 1}) ${esc(item)}${why}</td><td style="${cst}">${mark}</td></tr>`;
      });
      body += `</tbody></table>`;
    }
  }

  // ══════════════════════════════════════════
  // 3. [효능효과]
  // ══════════════════════════════════════════
  body += `<p style="${SEC}">[효능효과]</p>`;
  body += `<table class="tall-rows" style="width:100%;border-collapse:collapse;margin-bottom:12pt;">`;
  body += `<thead><tr>`;
  body += `<th style="${TH}width:60%;">의약품 표준제조기준</th>`;
  body += `<th style="${TH}width:40%;">${esc(productName)}</th>`;
  body += `</tr></thead><tbody><tr>`;
  let effLeft = '', effRight = '';
  if (currentKey === '제2장_해열진통제') {
    const effDbItems = DB['제2장_해열진통제']?.['기준']?.['효능효과'] ?? [];
    const effHeader = '효능 및 효과의 범위는 다음 범위로 한다.';
    effLeft  += `<p style="margin:0 0 4pt;">${esc(effHeader)}</p>`;
    effRight += `<p style="margin:0 0 4pt;">${esc(effHeader)}</p>`;
    effDbItems.forEach((t, i) => {
      const easyT = applyEasyTerms(t);
      effLeft  += `<p style="margin:0 0 3pt;padding-left:8pt;">${i+1}) ${esc(easyT)}</p>`;
      effRight += `<p style="margin:0 0 3pt;padding-left:8pt;">${i+1}) ${esc(easyT)}</p>`;
    });
  } else if (effResult) {
    const { items = [], basicText, basicItems = [], finalTexts = [] } = effResult;
    if (basicText) {
      const anyOk = basicItems.some(bi => bi.ok);
      effLeft += `<p style="margin:0 0 3pt;${anyOk ? HL : DIM}">${esc(basicText)}</p>`;
    }
    for (const bi of basicItems) {
      effLeft += `<p style="margin:0 0 2pt;padding-left:10pt;${bi.ok ? HL : DIM}">${esc(bi.label)}(${esc(bi.cond)})</p>`;
    }
    for (const it of items) {
      for (const t of (it.texts || [])) {
        effLeft += `<p style="margin:0 0 2pt;${it.ok ? HL : DIM}">${esc(t)}</p>`;
      }
    }
    if (!basicText && basicItems.length === 0 && items.length === 0) {
      for (const t of finalTexts) effLeft += `<p style="margin:0 0 2pt;${HL}">${esc(t)}</p>`;
    }
    for (const t of finalTexts) {
      effRight += `<p style="margin:0 0 3pt;">${esc(applyEasyTerms(t))}</p>`;
    }
  }
  body += `<td style="${TD}">${effLeft || `<span style="color:#aaa;">효능효과 데이터 없음</span>`}</td>`;
  body += `<td style="${TD}">${effRight || `<span style="color:#aaa;">(해당 없음)</span>`}</td>`;
  body += `</tr></tbody></table>`;

  // ══════════════════════════════════════════
  // 4. [용법용량]
  // ══════════════════════════════════════════
  body += `<p style="${SEC}">[용법용량]</p>`;
  body += `<table class="tall-rows" style="width:100%;border-collapse:collapse;margin-bottom:12pt;">`;
  body += `<thead><tr>`;
  body += `<th style="${TH}width:60%;">의약품 표준제조기준</th>`;
  body += `<th style="${TH}width:40%;">${esc(productName)}</th>`;
  body += `</tr></thead><tbody><tr>`;
  let dosLeft = '', dosRight = '';
  {
    const chDbObj3 = DB[currentKey];
    if (currentKey === '제2장_해열진통제') {
      const tbl3 = chDbObj3?.['표']?.['표3_연령구분계수'] ?? [];
      dosLeft += `<p style="margin:0 0 4pt;font-weight:bold;">(4) 용법&#xB7;용량</p>`;
      dosLeft += `<p style="margin:0 0 2pt;font-weight:bold;">1) 용법은 다음과 같이 한다.</p>`;
      dosLeft += `<p style="margin:0 0 1pt;padding-left:10pt;">① 1일 1회 복용하는 경우</p>`;
      dosLeft += `<p style="margin:0 0 5pt;padding-left:20pt;">1일 1회까지로 하고 공복시를 피하여 복용한다.</p>`;
      dosLeft += `<p style="margin:0 0 1pt;padding-left:10pt;">② 1일 2회 복용하는 경우</p>`;
      dosLeft += `<p style="margin:0 0 1pt;padding-left:20pt;">1일 2회까지로 하고 공복시를 피하여 복용한다.</p>`;
      dosLeft += `<p style="margin:0 0 5pt;padding-left:20pt;">복용 간격은 6시간 이상으로 한다.</p>`;
      dosLeft += `<p style="margin:0 0 1pt;padding-left:10pt;">③ 1일 3회 복용하는 경우</p>`;
      dosLeft += `<p style="margin:0 0 1pt;padding-left:20pt;">1일 3회까지로 하고 공복시를 피하여 복용한다.</p>`;
      dosLeft += `<p style="margin:0 0 8pt;padding-left:20pt;">복용간격은 4시간 이상으로 한다.</p>`;
      dosLeft += `<p style="margin:0 0 4pt;"><b>3)</b> 캡슐제, 정제(추어블정 및 발포정 제외)는 만 7세 이하의 영&#xB7;유아의 복용은 인정하지 아니한다. 또한, 추어블정에 대해서는 원칙적으로 만 3세 미만을 대상으로 하는 용법은 인정하지 않는다.</p>`;
      if (tbl3.length) {
        dosLeft += `<p style="margin:6pt 0 3pt;font-weight:bold;">&lt;표3&gt; 연령 구분별 용량의 환산 계수표</p>`;
        dosLeft += `<table style="width:100%;border-collapse:collapse;font-size:9pt;font-family:'맑은 고딕',Arial,sans-serif;margin-bottom:4pt;">`;
        dosLeft += `<tr><th style="border:1px solid #888;padding:3pt 6pt;background:#e8eef7;text-align:center;width:75%;">연령구분</th>`;
        dosLeft += `<th style="border:1px solid #888;padding:3pt 6pt;background:#e8eef7;text-align:center;width:25%;">계수</th></tr>`;
        tbl3.forEach(row => {
          dosLeft += `<tr>`;
          dosLeft += `<td style="border:1px solid #888;padding:3pt 6pt;">${esc(row['연령구분'])}</td>`;
          dosLeft += `<td style="border:1px solid #888;padding:3pt 6pt;text-align:center;">${esc(row['계수'])}</td>`;
          dosLeft += `</tr>`;
        });
        dosLeft += `</table>`;
      }
    } else {
      const dosDbItems = chDbObj3?.['기준']?.['용법용량'] ?? [];
      const formSpecificKws = ['추어블정','발포정','발포과립','구강용해필름','구강붕해정','경구용젤리제','트로키제','건조시럽제','건조시럽'];
      dosDbItems.forEach((item, i) => {
        const mentionsSpecific = formSpecificKws.some(kw => item.includes(kw));
        const mentionsCurrent  = form && item.includes(form);
        const isRelevant = mentionsCurrent || !mentionsSpecific;
        dosLeft += `<p style="margin:0 0 4pt;${isRelevant ? HL : DIM}"><b>${i + 1}.</b> ${esc(item)}</p>`;
      });
    }
    for (const dr of validDosageRows) {
      const ageLbl = displayAgeLabel(dr.age, currentKey, currentForm) || dr.age;
      const freqStr = dr.freqMin === dr.freqMax ? `1일 ${dr.freqMax}회` : `1일 ${dr.freqMin}~${dr.freqMax}회`;
      const amtStr  = dr.amtMin  === dr.amtMax  ? `1회 ${dr.amtMax}${unit}` : `1회 ${dr.amtMin}~${dr.amtMax}${unit}`;
      dosRight += `<p style="margin:0 0 4pt;"><b>${esc(ageLbl)}</b>: ${esc(freqStr)}, ${esc(amtStr)}</p>`;
    }
  }
  body += `<td style="${TD}">${dosLeft || `<span style="color:#aaa;">데이터 없음</span>`}</td>`;
  body += `<td style="${TD}">${dosRight || `<span style="color:#aaa;">(입력 없음)</span>`}</td>`;
  body += `</tr></tbody></table>`;

  // ══════════════════════════════════════════
  // 5. [사용상의 주의사항]
  // ══════════════════════════════════════════
  body += `<p style="${SEC}">[사용상의 주의사항]</p>`;
  body += `<table class="tall-rows" style="width:100%;border-collapse:collapse;margin-bottom:12pt;">`;
  body += `<thead><tr>`;
  body += `<th style="${TH}width:60%;">의약품 표준제조기준</th>`;
  body += `<th style="${TH}width:40%;">${esc(productName)}</th>`;
  body += `</tr></thead><tbody>`;

  const CAT_LABELS_FW = [
    ['경고',                 '경고'],
    ['복용하지_말_것',       '다음과 같은 사람은 이 약을 복용하지 말 것'],
    ['병용금기',             '이 약을 복용하는 동안 다음의 약을 복용하지 말 것'],
    ['복용전_상의',          '다음과 같은 사람(경우)은 이 약을 복용하기 전에 의사, 치과의사, 약사와 상의할 것.'],
    ['이상반응_및_즉각중지', '다음과 같은 경우 이 약의 복용을 즉각 중지하고 의사, 치과의사, 약사와 상의할 것. 상담 시 가능한 한 이 첨부문서를 소지할 것.'],
    ['기타주의사항',         '기타 주의사항'],
    ['소아투여',             '소아에 대한 투여'],
    ['임부수유부투여',       '임부 및 수유부에 대한 투여'],
    ['복용시_주의',          '기타 이 약의 복용 시 주의할 사항'],
    ['저장상의_주의',        '저장상의 주의사항'],
  ];
  const chDb   = DB[currentKey];
  const prec   = chDb?.['사용상의_주의사항'];
  const ctx    = prec ? buildPrecautionCtx(currentKey, form, activeRows, dosageRows) : null;
  const fnMaps = prec?.['각주_맵'] || {};   // 섹션별 인라인 각주 성분명 맵
  const displayedMap = new Map();
  if (precSections) {
    precSections.forEach(sec => {
      if (!displayedMap.has(sec.cat)) displayedMap.set(sec.cat, new Set());
      sec.items.forEach(it => displayedMap.get(sec.cat).add(it.origIdx));
    });
  }
  let commentDefs2 = '', commentSeq2 = 0;

  for (const [cat, label] of CAT_LABELS_FW) {
    const hasDbCat = prec && cat in prec;
    const excItemsInCat = (selectedExcipients || []).some(n => (EXCIPIENT_PREC_DB[n] || {})[cat]);
    const dirItemsInCat = (precSections || []).find(s => s.cat === cat)?.items.filter(it => it.isDirective) || [];
    if (!hasDbCat && !excItemsInCat && !dirItemsInCat.length) continue;
    const dispSet = displayedMap.get(cat) || new Set();
    const fnMap   = fnMaps[cat] || null;   // 이 섹션의 각주 성분명 맵

    let leftH = `<p style="margin:0 0 4pt;font-weight:bold;font-size:10pt;">${esc(label)}</p>`;
    const rightItems = [];

    if (hasDbCat && cat === '이상반응_및_즉각중지' && prec['이상반응_성분매핑']) {
      const advArr = prec[cat];
      const mapping = prec['이상반응_성분매핑'];
      const rawLines = advArr[0].split('\n').filter(l => l.trim());
      leftH += `<p style="margin:0 0 2pt;">${esc(_stripInlineMarkers(rawLines[0]))}</p>`;
      rawLines.slice(1).forEach((line, idx) => {
        const entry = mapping[idx];
        const isActive = entry ? ctx.classes.has(entry.class) : false;
        if (isActive) {
          leftH += `<p style="margin:0;padding-left:10pt;${HL}">${_renderPrecWithInlineHL(line, ctx, HL, fnMap, true)}</p>`;
        } else {
          leftH += `<p style="margin:0;padding-left:10pt;${DIM}">${esc(_stripInlineMarkers(line))}</p>`;
        }
      });
      for (let i = 1; i < advArr.length; i++) {
        const disp = dispSet.has(i);
        leftH += `<p style="margin:0 0 2pt;${disp ? '' : DIM}">${i}) ${esc(_stripInlineMarkers(advArr[i]))}</p>`;
      }
    } else if (hasDbCat) {
      const flatItems = _flattenPrecItems(cat, prec[cat]);
      let dispNum = 0;
      flatItems.forEach((item, i) => {
        const isIndent = !!item.indent;
        const isCircledW = !!item.circled;
        if (!isIndent && !isCircledW) dispNum++;
        const disp = dispSet.has(i);
        const indent = isIndent ? 'padding-left:10pt;' : '';
        const prefix = (isIndent || isCircledW) ? '' : `${dispNum}) `;
        if (disp) {
          leftH += `<p style="margin:0 0 2pt;${indent + HL}">${prefix}${_renderPrecWithInlineHL(item.text, ctx, HL, fnMap, true)}</p>`;
        } else {
          leftH += `<p style="margin:0 0 2pt;${indent}${DIM}">${prefix}${esc(_stripInlineMarkers(item.text)).replace(/\n/g,'<br>')}</p>`;
        }
      });
    }
    if (dirItemsInCat.length) {
      leftH += `<p style="font-size:9pt;color:#E65100;margin:4pt 0 2pt;font-style:italic;">[품목허가사항 변경지시]</p>`;
      dirItemsInCat.forEach(it => {
        const cmtId = `fw${++commentSeq2}`;
        const cmtRef = `<span style="mso-comment-reference:${cmtId};mso-comment-date:20240101T000000"><span style="mso-special-character:comment"> </span></span>`;
        leftH += `<p style="margin:0 0 1pt;background:#FFF3E0;">${it.displayNum}) ${esc(it.text)}${cmtRef}</p>`;
        if (it.citation) leftH += `<p style="margin:0 0 4pt;padding-left:8pt;font-size:8pt;font-style:italic;color:#888;font-family:'맑은 고딕',sans-serif;">○ ${esc(it.citation)}</p>`;
        commentDefs2 += `<div style="mso-element:comment" id="${cmtId}"><p class="MsoNormal" style="font-size:9pt;font-family:'맑은 고딕',sans-serif;"><b>기재 사유:</b> ${esc(it.citation)}</p></div>`;
      });
    }
    if (selectedExcipients && selectedExcipients.length) {
      for (const excName of selectedExcipients) {
        const excItems = (EXCIPIENT_PREC_DB[excName] || {})[cat];
        if (!excItems) continue;
        leftH += `<p style="font-size:9pt;color:#1565c0;margin:4pt 0 2pt;font-style:italic;">[첨가제: ${esc(excName)}]</p>`;
        excItems.forEach(text => {
          leftH += `<p style="margin:0 0 2pt;${HL}">${esc(text)}</p>`;
        });
      }
    }
    // 우측 열: precSections에서 직접 구성 (화면과 동일한 번호·텍스트)
    const precSec = precSections?.find(s => s.cat === cat);
    if (precSec) {
      precSec.items.forEach(it => {
        if (it.text && it.text.includes('<삭제>')) return;
        const clean = applyEasyTerms(removeEditorial(_stripIngredientParens(it.text)));
        if (it.indent || it.isMapping) {
          rightItems.push(`   ${clean}`);
        } else if (it.circled) {
          rightItems.push(clean);
        } else {
          rightItems.push(`${it.displayNum}) ${clean}`);
        }
      });
    }
    const rightH = rightItems.length
      ? `<p style="margin:0 0 4pt;font-weight:bold;font-size:10pt;">${esc(label)}</p>`
        + rightItems.map(t => `<p style="margin:0 0 2pt;">${esc(t).replace(/\n/g,'<br>')}</p>`).join('')
      : `<span style="color:#aaa;">(해당 없음)</span>`;
    body += `<tr><td style="${TD}">${leftH}</td><td style="${TD}">${rightH}</td></tr>`;
  }
  body += `</tbody></table>`;

  const commentListHtml2 = commentDefs2
    ? `<div style="mso-element:comment-list">${commentDefs2}</div>` : '';

  _wordDownload(productName, body,
    "  .MsoCommentText { font-size:9pt; font-family:'맑은 고딕',sans-serif; }",
    commentListHtml2);
}

/* =========================================================
   제품 DB (Firebase Firestore — 실시간 공유)
   ========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyCPVskzgCYINmVTiVcmpi6xmLhqI7BKNp8",
  authDomain: "rpbiodb.firebaseapp.com",
  projectId: "rpbiodb",
  storageBucket: "rpbiodb.firebasestorage.app",
  messagingSenderId: "588114091397",
  appId: "1:588114091397:web:d7d074eca144bbf3e478ec"
};
