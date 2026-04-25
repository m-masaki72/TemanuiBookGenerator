# てまぬい図鑑ジェネレーター — 作業コンテキスト

## 現在の状態（2026-04-26）

実装完了・git管理済み。`npm run dev` → http://localhost:3000 で動作確認できる。

## キャリブレーション済み座標

```js
PHOTO   = { x: 78, y: 203, w: 508, h: 687 }
PANELS  = [
  { key: 'encounter', x: 670, y: 231, w: 540, h: 157 },
  { key: 'feature',   x: 670, y: 482, w: 540, h: 154 },
  { key: 'appeal',    x: 670, y: 741, w: 540, h: 148 },
]
```

再計測が必要なときは `tools/calibrate.html` を使う。

## 次にやること

- [ ] スマホ実機でタッチドラッグ動作確認
- [ ] Cloudflare Pages デプロイ
- [ ] Stick フォント未使用なら `index.html` の Google Fonts 読み込みから削除
