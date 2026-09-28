# 사주 RPG

명리학 사주(四柱)를 기반으로 한 온라인 정통 RPG.

## 기술 스택

- TypeScript
- [Phaser 3](https://phaser.io/) (브라우저 2D 게임 엔진)
- Vite (개발 서버, 빌드), Vitest (테스트)

## 실행

```bash
npm install
npm run dev    # http://localhost:5173
npm test
npm run build
```

## 구조

- `src/saju/` 사주 계산 (천간, 지지, 오행, 일주). 게임 화면과 분리된 순수 로직입니다.
- `src/scenes/` Phaser 게임 화면
