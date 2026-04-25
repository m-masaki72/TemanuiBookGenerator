# てまぬい図鑑ジェネレーター — 作業コンテキスト

## 概要

「てまぬい図鑑」テンプレートに沿った人形紹介カード画像ジェネレーター。
バニラJS + Canvas API のみ。ビルド不要の静的サイト。

参考プロジェクト: `C:\Users\memen\Desktop\IdPhotoGenerator`（実装パターンを流用）

## ファイル構成

```
TemanuiBookGenerator/
├── index.html        — メインSPA（4ステップ）
├── app.js            — 全ロジック（Canvas描画・BG除去・エディター）
├── style.css         — スタイル（teal #4AADAD テーマ）
├── template.jpg      — 元画像素材 1280×960px（@metewo_shooting）
├── package.json      — npx serve のみ
├── _headers          — COOP/COEP（Cloudflare Pages用）
├── CLAUDE.md         — Claude Code向けアーキテクチャ説明
├── CONTEXT.md        — このファイル
└── tools/
    └── calibrate.html — 座標キャリブレーションツール
```

## 起動方法

```bash
npm run dev
# → http://localhost:3000
```

## Canvasレイアウト仕様（1280×960px）

template.jpgを背景として描画し、その上に写真・テキストだけ合成する方式。

```js
CANVAS_W = 1280, CANVAS_H = 960

// 写真パネル（テンプレート実測値）
PHOTO = { x: 78, y: 203, w: 508, h: 687 }

// テキストエリア（ラベルタブ下の入力域）
PANELS = [
  { key: 'encounter', x: 670, y: 231, w: 540, h: 157 },
  { key: 'feature',   x: 670, y: 482, w: 540, h: 154 },
  { key: 'appeal',    x: 670, y: 741, w: 540, h: 148 },
]
```

座標変更は `tools/calibrate.html` で再計測して貼り付け。

## 4ステップフロー

1. **写真アップロード** (`#step-upload`) — ファイル選択・AI背景除去トグル
2. **写真調整** (`#step-crop`) — ドラッグ+スライダーでトリミング
3. **文字入力** (`#step-edit`) — 3セクションテキスト + プレビュー + フォント選択
4. **完成** (`#step-result`) — PNG 1280×960 ダウンロード

## 主要実装ポイント

- **テンプレート合成**: `drawTemplate()` がプレビュー/エクスポート共用（scale引数で切り替え）
- **写真処理**: アップロード → BG除去（@imgly/background-removal@1.5.5, CDN lazy import）→ クリップ合成
- **エディター**: ドラッグ + scale/x/y スライダー、仮想300×400座標系
- **テキスト**: 各パネルにcalcLines()で折り返し計算 → 縦中央揃えで描画
- **フォント**: Canvas描画前に `await document.fonts.ready` で確実にロード
- **プレビュー**: テキスト入力から500msデバウンスで自動更新
- **エクスポート**: `canvas.toBlob()` → PNG download

## フォント選択肢

| id | ラベル | フォント |
|---|---|---|
| zen | まる | Zen Maru Gothic |
| hachi | ぽわぽわ | Hachi Maru Pop |
| klee | てがき | Klee One |
| noto | すっきり | Noto Sans JP |

## state 構造

```js
state = {
  photo: { original, processed, objectUrl, transform: {scale:100, x:0, y:0} },
  texts: { encounter:'', feature:'', appeal:'' },
  font: 'zen',
  bgRemoveEnabled: false,
  bgRemover: null,  // lazy cached module
}
```

## 実装済み機能

- [x] 写真アップロード・削除
- [x] AI背景除去トグル（失敗時は元画像にフォールバック）
- [x] ドラッグ+スライダーによる写真位置・サイズ調整（専用ステップ）
- [x] 3セクション（出会った時期・特徴・アピールポイント）テキスト入力
- [x] テキスト変更でプレビュー自動更新（500msデバウンス）
- [x] テキスト縦中央揃え＋文字サイズ自動調整（文字量に応じて11〜26px）
- [x] フォント選択（4種類）
- [x] template.jpg合成方式（元画像を活かす）
- [x] キャリブレーションツール（tools/calibrate.html）
- [x] PNG高解像度（1280×960px）ダウンロード
- [x] レスポンシブ対応

## 未着手・改善候補

- [ ] スマホでのタッチ操作確認
- [ ] Cloudflare Pages等へのデプロイ

## 使用ライブラリ

| ライブラリ | 用途 | ライセンス |
|---|---|---|
| @imgly/background-removal@1.5.5 | AI背景除去 | AGPL-3.0 |
| Google Fonts: Stick | タイトル描画 | SIL OFL 1.1 |
| Google Fonts: Zen Maru Gothic | テキスト | SIL OFL 1.1 |
| Google Fonts: Hachi Maru Pop | テキスト | SIL OFL 1.1 |
| Google Fonts: Klee One | テキスト | SIL OFL 1.1 |
| Google Fonts: Noto Sans JP | テキスト | SIL OFL 1.1 |
| Google Fonts: M PLUS Rounded 1c | UI全般 | SIL OFL 1.1 |
