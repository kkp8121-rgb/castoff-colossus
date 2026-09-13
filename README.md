# CASTOFF COLOSSUS · 벗어던진 거인

장갑을 탄환으로 쏠수록 더 높이 도약하는 거대 로봇으로, 버리고 되찾는 전투를 펼칩니다.

횡스크롤 2.5D 메카 액션 플랫폼 게임입니다. 여섯 장의 장갑은 방어구·탄약·무게를 함께 담당합니다. 가볍게 뛰어 높은 릴레이를 연결하고, 장갑을 회수해 보스의 반격을 버티십시오. 세 임무를 마치면 대피 네트워크가 복구됩니다.

## 실행

`index.html`을 직접 열 수 있습니다. 인터넷 연결이나 런타임 CDN이 필요하지 않습니다. WebGL을 지원하는 브라우저가 필요하며, 소리는 첫 입력 후 시작합니다.

```text
C:\Projects\castoff-colossus\index.html
```

키보드: A/D 또는 ←/→ 이동, Space 점프, Shift 대시, J 펀치, K 장갑 발사, 지상에서 R 홀드 회수, Esc 일시정지, M 음소거. 임무 선택은 방향키와 Enter, 패배 후 Enter/R로 재시도합니다. 터치 화면에는 일곱 조작 패드가 표시됩니다.

## 임무와 규칙

1. **빈 장갑의 도약** — 첫 고지와 낮은 충격파.
2. **허공의 회수선** — 끊어진 교량, 낮은 파동과 높은 광선.
3. **가장 가벼운 거인** — 세 릴레이, 연속 파동과 광선을 교대로 사용하는 왕관형 보스.

모든 릴레이를 공격해 켜고, 방패가 열린 보스를 쓰러뜨린 뒤 오른쪽 출구에 도착하면 완료됩니다. 지상에서 0.8초 동안 회수 신호를 보내면 흩어진 장갑이 돌아옵니다. 추락은 코어를 손상시키며 실제 도달한 체크포인트에서 재기동합니다. 코어가 소진되면 해당 임무를 처음부터 재시도합니다.

표준 모드는 코어 3, 완화 모드는 코어 5와 느린 공격 예고·탄속을 제공합니다. 난이도별 최고 등급과 시간이 로컬에 저장됩니다. S는 코어 피해 없이 총 피격 3회 이하·180초 이내, A는 코어 피해 1회 이하, 나머지 완료는 B입니다. 진행 중인 임무는 저장하지 않습니다.

## 제작과 검증

```sh
npm ci
npm run build
npm test
npm run test:browser
npm run test:interaction
npm run test:campaign
npm run pack
npm run test:package
```

`npm run serve`는 로컬 서버만 실행합니다. 브라우저를 자동으로 열지 않습니다. 모든 브라우저 검증은 headless Playwright로 실행합니다. `CASTOFF_URL`로 GitHub Pages 등 실제 배포 주소를 지정할 수 있습니다.

Three.js로 직접 작성한 관절 모델과 환경, 원본 ImageGen 키아트, Web Audio 합성 음악·효과음을 사용합니다. 개발 의존성은 번들에 포함되며 외부 서비스 호출이 없습니다. Three.js 라이선스는 `licenses/three.txt`, 원본 그림과 프롬프트는 `art-source/`와 `docs/ART.md`, 실제 검증 범위는 `docs/QA.md`를 참조하십시오.

공개 저장소: https://github.com/kkp8121-rgb/castoff-colossus

GitHub Pages는 push 승인 후 활성화할 예정이며, 아직 플레이 주소로 안내하지 않습니다.
