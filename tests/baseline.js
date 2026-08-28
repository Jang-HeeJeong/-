/* ═══════════════════════════════════════════════════════════════════
   기준값 (baseline) — 2026-08-26 시점의 판정 결과를 고정한 것

   ⚠ 이 값들은 "지금 코드가 내는 답"이지 "고시가 정한 정답"이 아닙니다.
     처음 한 번은 담당자가 고시와 대조해 검토해 주세요.
     이후로는 이 값이 바뀌면 = 판정이 바뀐 것이므로 원인을 확인해야 합니다.

   갱신 방법
     tests.html 하단 [기준값 새로 저장] → 출력된 내용으로 이 파일 전체를 교체
     (표제기 개정 등으로 판정이 "의도적으로" 바뀐 경우에만)

   ※ 성분명 매칭·장 추정 테스트는 tests/cases.js에 기대값이 직접 적혀 있어
     이 파일에는 들어오지 않습니다 (스냅샷이 아니라 사람이 정한 정답이므로).
   ═══════════════════════════════════════════════════════════════════ */
window.EXPECTED = {
  "validation": {
    "ch1-basic-ok": {
      "items": [
        {
          "ingr": "티아민질산염",
          "ok": true,
          "dailyMin": 5,
          "dailyMax": 15,
          "critMin": 1,
          "critMax": 100,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "아스코르브산",
          "ok": true,
          "dailyMin": 50,
          "dailyMax": 150,
          "critMin": 50,
          "critMax": 1500,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 1
    },
    "ch1-over-max": {
      "items": [
        {
          "ingr": "아스코르브산",
          "ok": false,
          "dailyMin": 2700,
          "dailyMax": 2700,
          "critMin": 50,
          "critMax": 1500,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": "1일 최대 초과: 2700 > 1500 mg"
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 1
    },
    "ch1-under-min": {
      "items": [
        {
          "ingr": "아스코르브산",
          "ok": false,
          "dailyMin": 10,
          "dailyMax": 10,
          "critMin": 50,
          "critMax": 1500,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": "1일 최소 미달: 10 < 50 mg"
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 1
    },
    "ch1-child-coeff": {
      "items": [
        {
          "ingr": "아스코르브산",
          "ok": true,
          "dailyMin": 20,
          "dailyMax": 60,
          "critMin": 8.3333,
          "critMax": 250,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "티아민질산염",
          "ok": true,
          "dailyMin": 1,
          "dailyMax": 3,
          "critMin": 0.1667,
          "critMax": 16.6667,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 0.16666666666666666
    },
    "ch1-b2-salt-differs": {
      "items": [
        {
          "ingr": "리보플라빈부티레이트(테트로부티르산리보플라빈)",
          "ok": true,
          "dailyMin": 3,
          "dailyMax": 3,
          "critMin": 2,
          "critMax": 100,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 1
    },
    "ch1-etc-taurine": {
      "items": [
        {
          "ingr": "아미노에틸설폰산(타우린)",
          "ok": true,
          "dailyMin": 250,
          "dailyMax": 1500,
          "critMin": null,
          "critMax": 2000,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 1
    },
    "ch1-etc-udca": {
      "items": [
        {
          "ingr": "우르소데옥시콜산",
          "ok": true,
          "dailyMin": 5,
          "dailyMax": 30,
          "critMin": null,
          "critMax": 30,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 1
    },
    "ch1-boost-jelly": {
      "items": [
        {
          "ingr": "아미노에틸설폰산(타우린)",
          "ok": true,
          "dailyMin": 250,
          "dailyMax": 1500,
          "critMin": null,
          "critMax": 2000,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "아스코르브산",
          "ok": true,
          "dailyMin": 50,
          "dailyMax": 300,
          "critMin": 50,
          "critMax": 1500,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "티아민질산염",
          "ok": true,
          "dailyMin": 5,
          "dailyMax": 30,
          "critMin": 1,
          "critMax": 100,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "리보플라빈부티레이트(테트로부티르산리보플라빈)",
          "ok": true,
          "dailyMin": 3,
          "dailyMax": 18,
          "critMin": 2,
          "critMax": 100,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "우르소데옥시콜산",
          "ok": true,
          "dailyMin": 5,
          "dailyMax": 30,
          "critMin": null,
          "critMax": 30,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 1
    },
    "ch1-mineral": {
      "items": [
        {
          "ingr": "마그네슘으로서",
          "ok": true,
          "dailyMin": 100,
          "dailyMax": 300,
          "critMin": null,
          "critMax": 500,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 1
    },
    "ch1-vitamin-e-iu": {
      "items": [
        {
          "ingr": "토코페롤아세테이트(비타민E로서)",
          "ok": true,
          "dailyMin": 500,
          "dailyMax": 500,
          "critMin": 10,
          "critMax": 1000,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "IU",
          "reason": ""
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 1
    },
    "ch1-edge-exact-max": {
      "items": [
        {
          "ingr": "아스코르브산",
          "ok": true,
          "dailyMin": 1500,
          "dailyMax": 1500,
          "critMin": 50,
          "critMax": 1500,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 1
    },
    "ch1-edge-exact-min": {
      "items": [
        {
          "ingr": "티아민질산염",
          "ok": true,
          "dailyMin": 1,
          "dailyMax": 1,
          "critMin": 1,
          "critMax": 100,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 1
    },
    "ch1-edge-decimal": {
      "items": [
        {
          "ingr": "시아노코발라민",
          "ok": false,
          "dailyMin": 0.3,
          "dailyMax": 0.3,
          "critMin": 1,
          "critMax": 1500,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "μg",
          "reason": "1일 최소 미달: 0.3 < 1 μg"
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 1
    },
    "ch2-apap-ok": {
      "items": [
        {
          "ingr": "아세트아미노펜",
          "ok": true,
          "dailyMin": 900,
          "dailyMax": 900,
          "critMin": null,
          "critMax": 1500,
          "dose1Min": 300,
          "dose1Max": 300,
          "crit1Min": 250,
          "crit1Max": 500,
          "unit": null,
          "reason": ""
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 1
    },
    "ch2-apap-over": {
      "items": [
        {
          "ingr": "아세트아미노펜",
          "ok": false,
          "dailyMin": 2100,
          "dailyMax": 2100,
          "critMin": null,
          "critMax": 1500,
          "dose1Min": 700,
          "dose1Max": 700,
          "crit1Min": 250,
          "crit1Max": 500,
          "unit": null,
          "reason": "1회 최대 초과: 700 > 500 mg; 1일 최대 초과: 2100(=700×3) > 1500 mg"
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 1
    },
    "ch2-missing-required": {
      "items": [
        {
          "ingr": "카페인무수물",
          "ok": true,
          "dailyMin": 90,
          "dailyMax": 90,
          "critMin": null,
          "critMax": 150,
          "dose1Min": 30,
          "dose1Max": 30,
          "crit1Min": 10,
          "crit1Max": 50,
          "unit": null,
          "reason": ""
        }
      ],
      "sums": [],
      "rules": [
        {
          "key": "필수 성분 누락",
          "ok": false
        }
      ],
      "prop": null,
      "coeff": 1
    },
    "ch2-child": {
      "items": [
        {
          "ingr": "아세트아미노펜",
          "ok": true,
          "dailyMin": 450,
          "dailyMax": 450,
          "critMin": null,
          "critMax": 750,
          "dose1Min": 150,
          "dose1Max": 150,
          "crit1Min": 125,
          "crit1Max": 250,
          "unit": null,
          "reason": ""
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 0.5
    },
    "ch3-basic-ok": {
      "items": [
        {
          "ingr": "아세트아미노펜",
          "ok": true,
          "dailyMin": 900,
          "dailyMax": 900,
          "critMin": 750,
          "critMax": 1500,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "클로르페니라민말레산염",
          "ok": true,
          "dailyMin": 6,
          "dailyMax": 6,
          "critMin": 3.75,
          "critMax": 7.5,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 1
    },
    "ch3-antihist-two": {
      "items": [
        {
          "ingr": "아세트아미노펜",
          "ok": true,
          "dailyMin": 900,
          "dailyMax": 900,
          "critMin": 750,
          "critMax": 1500,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "클로르페니라민말레산염",
          "ok": true,
          "dailyMin": 6,
          "dailyMax": 6,
          "critMin": 3.75,
          "critMax": 7.5,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "디펜히드라민염산염",
          "ok": false,
          "dailyMin": 36,
          "dailyMax": 36,
          "critMin": 37.5,
          "critMax": 75,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": "배합 최소 미달: 36<37.5"
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 1
    },
    "ch3-modcol-adult": {
      "items": [
        {
          "ingr": "이부프로펜",
          "ok": true,
          "dailyMin": 450,
          "dailyMax": 450,
          "critMin": 225,
          "critMax": 450,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "클로르페니라민말레산염",
          "ok": true,
          "dailyMin": 7.5,
          "dailyMax": 7.5,
          "critMin": 3.75,
          "critMax": 7.5,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "덱스트로메토르판브롬화수소산염수화물",
          "ok": true,
          "dailyMin": 48,
          "dailyMax": 48,
          "critMin": 24,
          "critMax": 48,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "dl-메틸에페드린염산염",
          "ok": true,
          "dailyMin": 75,
          "dailyMax": 75,
          "critMin": 37.5,
          "critMax": 75,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "슈도에페드린염산염",
          "ok": true,
          "dailyMin": 90,
          "dailyMax": 90,
          "critMin": 45,
          "critMax": 90,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "구아이페네신",
          "ok": true,
          "dailyMin": 249.6,
          "dailyMax": 249.6,
          "critMin": 125,
          "critMax": 250,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "브롬헥신염산염",
          "ok": true,
          "dailyMin": 12,
          "dailyMax": 12,
          "critMin": 6,
          "critMax": 12,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 1
    },
    "ch3-modcol-11to15": {
      "items": [
        {
          "ingr": "이부프로펜",
          "ok": true,
          "dailyMin": 225,
          "dailyMax": 225,
          "critMin": 150,
          "critMax": 300,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "클로르페니라민말레산염",
          "ok": true,
          "dailyMin": 3.75,
          "dailyMax": 3.75,
          "critMin": 2.5,
          "critMax": 5,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "덱스트로메토르판브롬화수소산염수화물",
          "ok": true,
          "dailyMin": 24,
          "dailyMax": 24,
          "critMin": 16,
          "critMax": 32,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "dl-메틸에페드린염산염",
          "ok": true,
          "dailyMin": 37.5,
          "dailyMax": 37.5,
          "critMin": 25,
          "critMax": 50,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "슈도에페드린염산염",
          "ok": true,
          "dailyMin": 45,
          "dailyMax": 45,
          "critMin": 30,
          "critMax": 60,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "구아이페네신",
          "ok": true,
          "dailyMin": 124.8,
          "dailyMax": 124.8,
          "critMin": 83.3333,
          "critMax": 166.6667,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "브롬헥신염산염",
          "ok": true,
          "dailyMin": 6,
          "dailyMax": 6,
          "critMin": 4,
          "critMax": 8,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 0.6666666666666666
    },
    "ch3-modcol-7to11": {
      "items": [
        {
          "ingr": "이부프로펜",
          "ok": true,
          "dailyMin": 225,
          "dailyMax": 225,
          "critMin": 112.5,
          "critMax": 225,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "클로르페니라민말레산염",
          "ok": true,
          "dailyMin": 3.75,
          "dailyMax": 3.75,
          "critMin": 1.875,
          "critMax": 3.75,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "덱스트로메토르판브롬화수소산염수화물",
          "ok": true,
          "dailyMin": 24,
          "dailyMax": 24,
          "critMin": 12,
          "critMax": 24,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "dl-메틸에페드린염산염",
          "ok": true,
          "dailyMin": 37.5,
          "dailyMax": 37.5,
          "critMin": 18.75,
          "critMax": 37.5,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "슈도에페드린염산염",
          "ok": true,
          "dailyMin": 45,
          "dailyMax": 45,
          "critMin": 22.5,
          "critMax": 45,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "구아이페네신",
          "ok": true,
          "dailyMin": 124.8,
          "dailyMax": 124.8,
          "critMin": 62.5,
          "critMax": 125,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "브롬헥신염산염",
          "ok": true,
          "dailyMin": 6,
          "dailyMax": 6,
          "critMin": 3,
          "critMax": 6,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 0.5
    },
    "ch7-basic": {
      "items": [
        {
          "ingr": "덱스트로메토르판브롬화수소산염수화물",
          "ok": true,
          "dailyMin": 30,
          "dailyMax": 30,
          "critMin": 30,
          "critMax": 60,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "△구아이페네신",
          "ok": true,
          "dailyMin": 150,
          "dailyMax": 150,
          "critMin": 150,
          "critMax": 300,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 1
    },
    "ch9-basic": {
      "items": [
        {
          "ingr": "클로르페니라민말레산염",
          "ok": true,
          "dailyMin": 6,
          "dailyMax": 6,
          "critMin": 6,
          "critMax": 12,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "슈도에페드린염산염",
          "ok": true,
          "dailyMin": 90,
          "dailyMax": 90,
          "critMin": 36,
          "critMax": 180,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 1
    },
    "ch9-over": {
      "items": [
        {
          "ingr": "슈도에페드린염산염",
          "ok": false,
          "dailyMin": 600,
          "dailyMax": 600,
          "critMin": 36,
          "critMax": 180,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": "1회 최대 초과: 200>60mg; 1일 최대 초과: 600>180mg"
        }
      ],
      "sums": [],
      "rules": [
        {
          "key": "Ⅰ란 필수",
          "ok": false
        }
      ],
      "prop": null,
      "coeff": 1
    },
    "ch2-evebidual-age1": {
      "items": [
        {
          "ingr": "이부프로펜",
          "ok": true,
          "dailyMin": 200,
          "dailyMax": 1200,
          "critMin": null,
          "critMax": 1200,
          "dose1Min": 200,
          "dose1Max": 400,
          "crit1Min": null,
          "crit1Max": 400,
          "unit": null,
          "reason": ""
        },
        {
          "ingr": "비타민B2 및 그 유도체와 염류",
          "ok": true,
          "dailyMin": 2,
          "dailyMax": 12,
          "critMin": 2,
          "critMax": 12,
          "dose1Min": 2,
          "dose1Max": 4,
          "crit1Min": null,
          "crit1Max": null,
          "unit": null,
          "reason": ""
        },
        {
          "ingr": "파마브롬",
          "ok": true,
          "dailyMin": 25,
          "dailyMax": 150,
          "critMin": null,
          "critMax": 200,
          "dose1Min": 25,
          "dose1Max": 50,
          "crit1Min": 10,
          "crit1Max": 50,
          "unit": null,
          "reason": ""
        },
        {
          "ingr": "산화마그네슘",
          "ok": true,
          "dailyMin": 50,
          "dailyMax": 300,
          "critMin": null,
          "critMax": 500,
          "dose1Min": 50,
          "dose1Max": 100,
          "crit1Min": 33.3333,
          "crit1Max": null,
          "unit": null,
          "reason": ""
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 1
    },
    "ch2-evebidual-age2": {
      "items": [
        {
          "ingr": "이부프로펜",
          "ok": true,
          "dailyMin": 200,
          "dailyMax": 600,
          "critMin": null,
          "critMax": 800,
          "dose1Min": 200,
          "dose1Max": 200,
          "crit1Min": null,
          "crit1Max": 266.6667,
          "unit": null,
          "reason": ""
        },
        {
          "ingr": "비타민B2 및 그 유도체와 염류",
          "ok": true,
          "dailyMin": 2,
          "dailyMax": 6,
          "critMin": 2,
          "critMax": 8,
          "dose1Min": 2,
          "dose1Max": 2,
          "crit1Min": null,
          "crit1Max": null,
          "unit": null,
          "reason": ""
        },
        {
          "ingr": "파마브롬",
          "ok": true,
          "dailyMin": 25,
          "dailyMax": 75,
          "critMin": null,
          "critMax": 133.3333,
          "dose1Min": 25,
          "dose1Max": 25,
          "crit1Min": 6.6667,
          "crit1Max": 33.3333,
          "unit": null,
          "reason": ""
        },
        {
          "ingr": "산화마그네슘",
          "ok": true,
          "dailyMin": 50,
          "dailyMax": 150,
          "critMin": null,
          "critMax": 333.3333,
          "dose1Min": 50,
          "dose1Max": 50,
          "crit1Min": 22.2222,
          "crit1Max": null,
          "unit": null,
          "reason": ""
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 0.6666666666666666
    },
    "ch2-evebidual-age3": {
      "items": [
        {
          "ingr": "이부프로펜",
          "ok": true,
          "dailyMin": 200,
          "dailyMax": 600,
          "critMin": null,
          "critMax": 600,
          "dose1Min": 200,
          "dose1Max": 200,
          "crit1Min": null,
          "crit1Max": 200,
          "unit": null,
          "reason": ""
        },
        {
          "ingr": "비타민B2 및 그 유도체와 염류",
          "ok": true,
          "dailyMin": 2,
          "dailyMax": 6,
          "critMin": 2,
          "critMax": 6,
          "dose1Min": 2,
          "dose1Max": 2,
          "crit1Min": null,
          "crit1Max": null,
          "unit": null,
          "reason": ""
        },
        {
          "ingr": "파마브롬",
          "ok": true,
          "dailyMin": 25,
          "dailyMax": 75,
          "critMin": null,
          "critMax": 100,
          "dose1Min": 25,
          "dose1Max": 25,
          "crit1Min": 5,
          "crit1Max": 25,
          "unit": null,
          "reason": ""
        },
        {
          "ingr": "산화마그네슘",
          "ok": true,
          "dailyMin": 50,
          "dailyMax": 150,
          "critMin": null,
          "critMax": 250,
          "dose1Min": 50,
          "dose1Max": 50,
          "crit1Min": 16.6667,
          "crit1Max": null,
          "unit": null,
          "reason": ""
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 0.5
    },
    "ch1-aiganyu": {
      "items": [
        {
          "ingr": "간유(비타민A로서)",
          "ok": true,
          "dailyMin": 2000,
          "dailyMax": 2000,
          "critMin": 500,
          "critMax": 10000,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "IU",
          "reason": ""
        },
        {
          "ingr": "티아민질산염",
          "ok": true,
          "dailyMin": 25.2,
          "dailyMax": 25.2,
          "critMin": 1,
          "critMax": 100,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "리보플라빈",
          "ok": true,
          "dailyMin": 12,
          "dailyMax": 12,
          "critMin": 1,
          "critMax": 100,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "콘드로이틴설페이트나트륨",
          "ok": true,
          "dailyMin": 100,
          "dailyMax": 100,
          "critMin": null,
          "critMax": 800,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 1
    },
    "ch2-evessendual": {
      "items": [
        {
          "ingr": "산화마그네슘",
          "ok": true,
          "dailyMin": 80,
          "dailyMax": 240,
          "critMin": null,
          "critMax": 500,
          "dose1Min": 80,
          "dose1Max": 80,
          "crit1Min": 33.3333,
          "crit1Max": null,
          "unit": null,
          "reason": ""
        },
        {
          "ingr": "이부프로펜",
          "ok": true,
          "dailyMin": 400,
          "dailyMax": 1200,
          "critMin": null,
          "critMax": 1200,
          "dose1Min": 400,
          "dose1Max": 400,
          "crit1Min": null,
          "crit1Max": 400,
          "unit": null,
          "reason": ""
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 1
    },
    "ch2-poevebalance-age1": {
      "items": [
        {
          "ingr": "산화마그네슘",
          "ok": true,
          "dailyMin": 83,
          "dailyMax": 498,
          "critMin": null,
          "critMax": 500,
          "dose1Min": 83,
          "dose1Max": 166,
          "crit1Min": 33.3333,
          "crit1Max": null,
          "unit": null,
          "reason": ""
        },
        {
          "ingr": "파마브롬",
          "ok": true,
          "dailyMin": 25,
          "dailyMax": 150,
          "critMin": null,
          "critMax": 200,
          "dose1Min": 25,
          "dose1Max": 50,
          "crit1Min": 10,
          "crit1Max": 50,
          "unit": null,
          "reason": ""
        },
        {
          "ingr": "이부프로펜",
          "ok": true,
          "dailyMin": 200,
          "dailyMax": 1200,
          "critMin": null,
          "critMax": 1200,
          "dose1Min": 200,
          "dose1Max": 400,
          "crit1Min": null,
          "crit1Max": 400,
          "unit": null,
          "reason": ""
        },
        {
          "ingr": "수산화알루미늄겔(건조수산화알루미늄겔로서)",
          "ok": true,
          "dailyMin": 66.7,
          "dailyMax": 400.2,
          "critMin": null,
          "critMax": 1000,
          "dose1Min": 66.7,
          "dose1Max": 133.4,
          "crit1Min": 66.6667,
          "crit1Max": null,
          "unit": null,
          "reason": ""
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 1
    },
    "ch2-poevebalance-age2": {
      "items": [
        {
          "ingr": "산화마그네슘",
          "ok": true,
          "dailyMin": 83,
          "dailyMax": 249,
          "critMin": null,
          "critMax": 333.3333,
          "dose1Min": 83,
          "dose1Max": 83,
          "crit1Min": 22.2222,
          "crit1Max": null,
          "unit": null,
          "reason": ""
        },
        {
          "ingr": "파마브롬",
          "ok": true,
          "dailyMin": 25,
          "dailyMax": 75,
          "critMin": null,
          "critMax": 133.3333,
          "dose1Min": 25,
          "dose1Max": 25,
          "crit1Min": 6.6667,
          "crit1Max": 33.3333,
          "unit": null,
          "reason": ""
        },
        {
          "ingr": "이부프로펜",
          "ok": true,
          "dailyMin": 200,
          "dailyMax": 600,
          "critMin": null,
          "critMax": 800,
          "dose1Min": 200,
          "dose1Max": 200,
          "crit1Min": null,
          "crit1Max": 266.6667,
          "unit": null,
          "reason": ""
        },
        {
          "ingr": "수산화알루미늄겔(건조수산화알루미늄겔로서)",
          "ok": true,
          "dailyMin": 66.7,
          "dailyMax": 200.1,
          "critMin": null,
          "critMax": 666.6667,
          "dose1Min": 66.7,
          "dose1Max": 66.7,
          "crit1Min": 44.4444,
          "crit1Max": null,
          "unit": null,
          "reason": ""
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 0.6666666666666666
    },
    "ch2-poevebalance-age3": {
      "items": [
        {
          "ingr": "산화마그네슘",
          "ok": true,
          "dailyMin": 83,
          "dailyMax": 249,
          "critMin": null,
          "critMax": 250,
          "dose1Min": 83,
          "dose1Max": 83,
          "crit1Min": 16.6667,
          "crit1Max": null,
          "unit": null,
          "reason": ""
        },
        {
          "ingr": "파마브롬",
          "ok": true,
          "dailyMin": 25,
          "dailyMax": 75,
          "critMin": null,
          "critMax": 100,
          "dose1Min": 25,
          "dose1Max": 25,
          "crit1Min": 5,
          "crit1Max": 25,
          "unit": null,
          "reason": ""
        },
        {
          "ingr": "이부프로펜",
          "ok": true,
          "dailyMin": 200,
          "dailyMax": 600,
          "critMin": null,
          "critMax": 600,
          "dose1Min": 200,
          "dose1Max": 200,
          "crit1Min": null,
          "crit1Max": 200,
          "unit": null,
          "reason": ""
        },
        {
          "ingr": "수산화알루미늄겔(건조수산화알루미늄겔로서)",
          "ok": true,
          "dailyMin": 66.7,
          "dailyMax": 200.1,
          "critMin": null,
          "critMax": 500,
          "dose1Min": 66.7,
          "dose1Max": 66.7,
          "crit1Min": 33.3333,
          "crit1Max": null,
          "unit": null,
          "reason": ""
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 0.5
    },
    "ch9-bifreestrong": {
      "items": [
        {
          "ingr": "클로르페니라민말레산염",
          "ok": true,
          "dailyMin": 12,
          "dailyMax": 12,
          "critMin": 6,
          "critMax": 12,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "dl-메틸에페드린염산염",
          "ok": true,
          "dailyMin": 30,
          "dailyMax": 30,
          "critMin": 22,
          "critMax": 110,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "벨라돈나(총)알카로이드",
          "ok": true,
          "dailyMin": 0.6,
          "dailyMax": 0.6,
          "critMin": 0.12,
          "critMax": 0.6,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 1
    },
    "ch1-chamq": {
      "items": [
        {
          "ingr": "레티놀아세테이트(비타민A로서)",
          "ok": true,
          "dailyMin": 2000,
          "dailyMax": 2000,
          "critMin": 500,
          "critMax": 10000,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "IU",
          "reason": ""
        },
        {
          "ingr": "콜레칼시페롤(비타민D로서)",
          "ok": true,
          "dailyMin": 1000,
          "dailyMax": 1000,
          "critMin": 50,
          "critMax": 1000,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "IU",
          "reason": ""
        },
        {
          "ingr": "토코페롤아세테이트(비타민E로서)",
          "ok": true,
          "dailyMin": 20,
          "dailyMax": 20,
          "critMin": 10,
          "critMax": 1000,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "IU",
          "reason": ""
        },
        {
          "ingr": "티아민질산염",
          "ok": true,
          "dailyMin": 4,
          "dailyMax": 4,
          "critMin": 1,
          "critMax": 100,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "리보플라빈",
          "ok": true,
          "dailyMin": 3.6,
          "dailyMax": 3.6,
          "critMin": 1,
          "critMax": 100,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "피리독신염산염",
          "ok": true,
          "dailyMin": 4,
          "dailyMax": 4,
          "critMin": 1,
          "critMax": 250,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "시아노코발라민",
          "ok": true,
          "dailyMin": 12,
          "dailyMax": 12,
          "critMin": 1,
          "critMax": 1500,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "μg",
          "reason": ""
        },
        {
          "ingr": "아스코르브산",
          "ok": true,
          "dailyMin": 100,
          "dailyMax": 100,
          "critMin": 50,
          "critMax": 1500,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "판토텐산칼슘",
          "ok": true,
          "dailyMin": 6,
          "dailyMax": 6,
          "critMin": 5,
          "critMax": 500,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "폴산",
          "ok": true,
          "dailyMin": 40,
          "dailyMax": 40,
          "critMin": 10,
          "critMax": 500,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "μg",
          "reason": ""
        },
        {
          "ingr": "마그네슘으로서",
          "ok": true,
          "dailyMin": 40,
          "dailyMax": 40,
          "critMin": null,
          "critMax": 500,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "아연으로서",
          "ok": true,
          "dailyMin": 10,
          "dailyMax": 10,
          "critMin": null,
          "critMax": 50,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "오로트산수화물",
          "ok": true,
          "dailyMin": 40,
          "dailyMax": 40,
          "critMin": null,
          "critMax": 200,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        },
        {
          "ingr": "유비테카레논(코엔자임 Q10)",
          "ok": true,
          "dailyMin": 4,
          "dailyMax": 4,
          "critMin": null,
          "critMax": 10,
          "dose1Min": null,
          "dose1Max": null,
          "crit1Min": null,
          "crit1Max": null,
          "unit": "mg",
          "reason": ""
        }
      ],
      "sums": [],
      "rules": [],
      "prop": null,
      "coeff": 1
    }
  }
};
