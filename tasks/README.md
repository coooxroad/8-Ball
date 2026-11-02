# 다른 AI에게 맡기는 일

소유자가 GPT(또는 Gemini 등)에게 일을 맡길 때 쓰는 작업 지시서. 파일 하나 = 작업 하나.
소유자는 해당 파일의 내용을 **통째로** 붙여 넣고 "이대로 해 줘"라고만 하면 된다.

| 파일 | 일 | 건드리는 곳 |
|---|---|---|
| `gpt-skins.md` | 스킨(큐·공·테이블·트레일·장갑) 추가, 스킨별 소리 | `web/content/`, `web/ui/`, `web/tex/`, `web/sound/` |
| `gpt-puzzles.md` | 4구 퍼즐 생성기와 퍼즐 목록 | `web/tools/puzzles/`, `web/puzzles.js` |
| `gpt-puzzles-walls.md` | 퍼즐 7단계 바리케이드 10문제 (퍼즐 작업 이어서) | `web/tools/puzzles/`, `web/puzzles.js` |
| `gpt-assets-2.md` | 새 스킨 그림·소리 묶음(감자 A안, 트레일 효과, 수영장·만화 테이블, 큐 카드) | `web/tex/`, `web/ui/`, `web/sound/` |
| `gpt-human-ai.md` | 사람 같은 컴퓨터 상대(랭킹전 빈자리 채우기) | `web/ai/50-human.js`, `web/ai/51-people.js`, `web/test/ai-human.js` |
| `gpt-lessons.md` | 레슨 4권 채우기(8볼·9볼 코드, 3구·4구는 형식 제안) — 8볼을 다 깨면 보상 | `web/drills.js` |
| `gpt-assets-3.md` | 소리 묶음 3: 당구드롭 효과음, 통기타·플루트·크리스탈·농구공 타격음 | `web/sound/` |

세 작업은 서로 다른 파일만 건드리므로 동시에 해도 된다. Claude가 같은 때 하는 일(매칭, 능력치, 폰 화면, 바리케이드)과도
겹치지 않게 나눴다. 겹치는 파일이 생기면 PR 첫 줄의 파일 목록을 보고 나중에 온 쪽이 기다린다.

PR이 오면 Claude가 검토하고 합친다. 소유자는 PR 주소만 Claude에게 알려 주면 된다.
