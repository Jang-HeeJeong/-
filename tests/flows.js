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
          effTextHas: '감기의 여러 증상',
          // 아스피린류·이부프로펜류(위통·소화관출혈·위부불쾌감·난청·이명)는
          // 아세트아미노펜만으로는 해당하지 않는다
          precTextHasNot: ['난청', '이명'],
          // 항히스타민제(클로르페니라민)는 실제로 있으니 그쪽 증상은 남아야 한다
          precTextHas: ['목마름(지속적이거나 심한)'],
        } },
    ],
  },
];
