/* ═══════════════════════════════════════════════════════════════════
   전환 흐름 테스트 — 제품·장을 갈아끼울 때 이전 상태가 남지 않는지 확인

   판정 로직 테스트(cases.js)는 "값을 넣으면 올바른 답이 나오는가"를 보고,
   이쪽은 "화면을 갈아끼울 때 이전 제품 내용이 섞이지 않는가"를 본다.

   이번 세션에 실제로 났던 버그들이 여기 들어 있다.
     - 두 제품 성분이 섞여 실재하지 않는 처방이 만들어짐
     - 제품을 바꿔도 적용 기준(장)이 안 바뀜
     - 이전 제품의 안내 문구가 남음
     - 첨가제·연령 선택이 이전 제품 것으로 남음

   기대값은 스냅샷이 아니라 손으로 적은 값이다. "이렇게 동작해야 한다"는
   의도를 적어 두는 것이므로, 실패하면 코드를 의심하는 게 먼저다.
   ═══════════════════════════════════════════════════════════════════ */

window.FLOW_CASES = [
  {
    id: 'flow-chapter-switch',
    desc: '장이 다른 제품으로 전환 — 제1장 ↔ 제3장 왕복',
    steps: [
      { pick: '부스트젤리',
        expect: { chapter: '제1장_비타민미네랄', form: '경구용젤리제', filled: 5 } },
      { pick: '미리코프파워연질캡슐',
        expect: { chapter: '제3장_감기약', filled: 4 } },
      { pick: '부스트젤리',
        expect: { chapter: '제1장_비타민미네랄', form: '경구용젤리제', filled: 5 } },
    ],
  },
  {
    id: 'flow-same-chapter-no-mix',
    desc: '같은 장의 다른 제품 — 이전 제품 성분이 섞이지 않아야 함',
    steps: [
      { pick: '부스트젤리',
        expect: { chapter: '제1장_비타민미네랄', filled: 5 } },
      // 엠지파워는 성분 2개 중 토코페롤만 표에 매칭된다 (산화마그네슘은 복합염 별도 입력)
      { pick: '엠지파워연질캡슐',
        expect: { chapter: '제1장_비타민미네랄', filled: 1,
                  filledHas: ['토코페롤아세테이트(비타민E로서)'],
                  filledHasNot: ['아스코르브산', '티아민질산염', '아미노에틸설폰산(타우린)'] } },
      { pick: '부스트젤리',
        expect: { chapter: '제1장_비타민미네랄', filled: 5,
                  filledHasNot: ['토코페롤아세테이트(비타민E로서)'] } },
    ],
  },
  {
    id: 'flow-excipients-cleared',
    desc: '첨가제가 있는 제품 → 없는 제품으로 전환 시 첨가제가 비워져야 함',
    steps: [
      { restore: { name: '테스트제품(첨가제)', chapter: '제2장_해열진통제', form: '캡슐제',
                   excipients: ['대두유'],
                   dosageRows: [{ age: '만 15세 이상', freqMin: 1, freqMax: 3, amtMin: 1, amtMax: 1 }],
                   matrix: { shown: [], custom: [], doses: { '이부프로펜': '200' } } },
        expect: { chapter: '제2장_해열진통제', excipients: ['대두유'] } },
      { pick: '부스트젤리',
        expect: { chapter: '제1장_비타민미네랄', excipients: [] } },
    ],
  },
  {
    id: 'flow-age-back-to-auto',
    desc: '작업자가 고른 연령은 제품이 바뀌면 자동값으로 돌아가야 함',
    steps: [
      { pick: '부스트젤리', expect: { ageUserSet: [false] } },
      { chooseFirstAge: true, expect: { ageUserSet: [true] } },
      { pick: '엠지파워연질캡슐', expect: { ageUserSet: [false] } },
    ],
  },
  {
    id: 'flow-user-chapter-respected',
    desc: '작업자가 직접 고른 장은 부분 일치 제품에도 유지되어야 함',
    steps: [
      { setChapter: '제1장_비타민미네랄', expect: { chapter: '제1장_비타민미네랄', chapterUserSet: true } },
      { pick: '엠지파워연질캡슐',
        expect: { chapter: '제1장_비타민미네랄', chapterUserSet: true } },
    ],
  },
  {
    id: 'flow-notice-not-stale',
    desc: '이전 제품의 안내 문구가 다음 제품 화면에 남지 않아야 함',
    steps: [
      // 표제기 대상이 아닌 품목 → 경고 문구가 뜬다
      { pick: '알피레보플록사신정250mg(레보플록사신수화물)',
        expect: { chapter: '', noticeHas: '표준제조기준 대상 품목이 아닐 수 있습니다' } },
      // 다음 제품으로 넘어가면 그 문구는 사라져야 한다
      { pick: '부스트젤리',
        expect: { chapter: '제1장_비타민미네랄',
                  noticeHasNot: '표준제조기준 대상 품목이 아닐 수 있습니다' } },
    ],
  },
  {
    id: 'flow-bad-dose-blocks',
    desc: '음수 배합량은 조용히 빠지지 않고 검토를 막아야 함 (R-01)',
    steps: [
      { setChapter: '제1장_비타민미네랄' },
      // 정상값 하나 + 오타값 하나
      { setDose: { 3: 5 },   expect: { badCount: 0, validateDisabled: false } },
      { setDose: { 4: -30 }, expect: { badCount: 1, validateDisabled: true } },
      // 이 상태로 검토를 눌러도 결과가 나오면 안 된다
      { runValidation: true, expect: { resultShown: false } },
      // 값을 고치면 다시 검토할 수 있다
      { setDose: { 4: 30 },  expect: { badCount: 0, validateDisabled: false } },
      { runValidation: true, expect: { resultShown: true } },
    ],
  },
  {
    id: 'flow-bad-dose-stays-visible',
    desc: '못 쓰는 값이 든 행은 "입력된 성분만 보기"에도 남아야 함 (R-01)',
    steps: [
      { setChapter: '제1장_비타민미네랄' },
      { setDose: { 3: 5, 4: -30 }, expect: { filled: 2 } },
    ],
  },
  {
    id: 'flow-ch3-acetaminophen-not-aspirin-class',
    desc: '아세트아미노펜은 아스피린류가 아니다 — 위통·난청 등 살리실산 부작용이 잘못 나오면 안 됨 (캐롤비콜드)',
    steps: [
      { pick: '캐롤비콜드연질캡슐', expect: { chapter: '제3장_감기약' } },
      { runValidation: true, expect: {
          // "제증상" 쉬운말 치환 — 뒤에 괄호가 바로 이어져도 바뀌어야 한다
          effTextHas: '감기의 제증상(여러 증상)',
          // 아스피린류·이부프로펜류(위통·소화관출혈·위부불쾌감·난청·이명)는
          // 아세트아미노펜만으로는 해당하지 않는다
          precTextHasNot: ['난청', '이명'],
          // 항히스타민제(클로르페니라민)는 실제로 있으니 그쪽 증상은 남아야 한다
          precTextHas: ['목마름(지속적이거나 심한)'],
        } },
    ],
  },
  {
    id: 'flow-ch3-rule-status',
    desc: '제3장 조항별 적합여부 — 해당없는 조항은 /, 판정보류(-)는 없어야 함',
    steps: [
      { pick: '캐롤비콜드연질캡슐' },
      // 종류 12개 / 분량 12개.  O=적합  X=부적합  /=해당없음  -=판정보류
      // 생약·한약처방이 없는 일반 감기약이라 대부분 "해당없음"이 된다.
      // '-'가 하나라도 보이면 조항 매핑이 빠진 것이다.
      // 2026-57호 개정으로 종류가 12 → 14개가 되었다 (13 메퀴타진, 14 ⅩⅤ항).
      // 캐롤비콜드에는 둘 다 없으므로 새 두 칸은 "해당없음"이다.
      // 분량 8번이 ⅩⅢ항(비타민) 하한이다. 예전에는 이 판정이 10번 자리에
      // 있었는데, 데이터 순서를 원문에 맞추면서 제자리로 왔다.
      { setAmt: 2, expect: { ch3Status: 'O/OOOO//////// O///OO/O////' } },
    ],
  },
  {
    id: 'flow-ch3-apap-600-lower-bound',
    desc: '아세트아미노펜만 배합하면 하한은 600mg이지 1/2(750)이 아니다',
    steps: [
      { pick: '캐롤비콜드연질캡슐' },
      { setAmt: 2 },
      /* 원문 분량 5)는 "별도로 정하는 경우를 제외하고" 1/2이고,
         분량 6)이 바로 그 별도 조항이다. 아세트아미노펜만 배합하면
         750이 아니라 600이 하한이므로 1일 700mg은 적합이어야 한다.
         (감기약은 거의 다 Ⅰ항이 아세트아미노펜 하나뿐이다) */
      { setDoseByName: { '아세트아미노펜': 116.6667 } },   // 1일 700mg
      { expect: { ch3AmtRule: { '5': 'O', '6': 'O' } } },
      // 600에도 못 미치면 둘 다 걸려야 한다
      { setDoseByName: { '아세트아미노펜': 83.3333 } },    // 1일 500mg
      { expect: { ch3AmtRule: { '5': 'X', '6': 'X' } } },
    ],
  },
  {
    id: 'flow-default-dose-not-verdict',
    desc: '용법용량이 기본값이면 "부적합"이라 단정하지 않는다 (캐롤비콜드)',
    steps: [
      // 허가목록에는 용법이 없어 1회 1캡슐이 임시로 들어간다.
      // 그 값으로 나온 미달은 이 제품의 부적합이 아니다.
      { pick: '캐롤비콜드연질캡슐' },
      { runValidation: true, expect: {
          statusHas: '용법용량 확인 필요',
          statusHasNot: '부적합 항목 있음',
        } },
      // 실제 용법(1회 2캡슐)을 넣으면 정상 판정으로 돌아와야 한다
      { setAmt: 2 },
      { runValidation: true, expect: { statusHas: '적합', statusHasNot: '용법용량 확인 필요' } },
    ],
  },
  {
    id: 'flow-draft-autosave',
    desc: '작업 중 내용이 임시저장에 담긴다 — 새로고침해도 잃지 않아야 함',
    steps: [
      { clearDraft: true },
      { pick: '캐롤비콜드연질캡슐' },
      { flushDraft: true, expect: { draftDosesAtLeast: 7 } },
      { clearDraft: true },
    ],
  },
  {
    id: 'flow-range-not-reversed',
    desc: '1회 2~1캡슐처럼 거꾸로 넣으면 자동으로 바로잡힌다',
    steps: [
      { pick: '캐롤비콜드연질캡슐' },
      // 최소를 2로 올리면 최대도 따라 올라가야 한다 (2~2)
      { setAmtMin: 2, expect: { amtRange: '2~2' } },
      // 최대를 1로 내리면 최소도 따라 내려가야 한다 (1~1)
      { setAmtMax: 1, expect: { amtRange: '1~1' } },
      // 정상 범위는 그대로 둔다
      { setAmtMax: 3, expect: { amtRange: '1~3' } },
    ],
  },
  {
    id: 'flow-added-ingr-stays-visible',
    desc: '직접 추가한 성분은 "입력된 성분만 보기"에도 남아야 함 (인삼)',
    steps: [
      { pick: '캐롤비콜드연질캡슐' },
      // 고르기만 하면 담긴다 — [추가] 버튼을 누르지 않는다
      { addMxIngr: '인삼', expect: { visibleHas: ['인삼'] } },
      // 다른 성분에 값을 넣어 다시 그려도 사라지면 안 된다 (원래 버그)
      { setDoseByName: { '아세트아미노펜': 150 }, expect: { visibleHas: ['인삼'] } },
    ],
  },
  {
    id: 'flow-unjudged-not-ok',
    desc: '판정하지 못한 성분이 있으면 "기준에 맞습니다"가 뜨면 안 됨',
    steps: [
      { pick: '캐롤비콜드연질캡슐' },
      // 정상 상태에서는 종전대로 적합
      { setAmt: 2 },
      { runValidation: true, expect: { statusHas: '적합', statusHasNot: '부적합' } },
      /* 표에 없는 성분을 직접 넣으면 그 행은 "판정할 수 없음"이 된다.
         예전에는 "부적합만 아니면 적합"으로 봐서 전체가 적합으로 나왔다. */
      { addCustomIngr: { name: '표에없는성분', dose: 50 } },
      { runValidation: true, expect: { statusHasNot: '검토 완료' } },
    ],
  },
];