# 開運オロチ神社 - 拡張開発用リポジトリ

## 📌 このリポジトリについて
https://github.com/Borax601/orochi_web46

**目的**: 開運オロチ神社サイトの新機能・新コンテンツ追加のための開発用リポジトリ

## 🎯 現在の構成

### メインページ
- **本殿** (`index.html`) - トップページ、ヒーローアニメーション
- **奉納作品** (`gallery.html`) - イラスト作品ギャラリー
- **時すでにオロチ** (`toki-sude-ni-orochi.html`) - AI生成作品ギャラリー  
- **動くオロチ奉納殿** (`video.html`) - 動画作品ギャラリー

### 主要機能
- ✅ レスポンシブデザイン
- ✅ いいねシステム（simple-likes.js）
- ✅ 月別フィルタリング
- ✅ ハンバーガーメニュー
- ✅ スムーススクロール

### ファイル構成
```
├── index.html          # メインページ
├── gallery.html        # 奉納作品
├── toki-sude-ni-orochi.html  # AI作品
├── video.html          # 動画作品
├── main.js             # メインJavaScript
├── simple-likes.js     # いいねシステム
├── styles.css          # メインCSS
├── header-white.css    # ヘッダースタイル
├── assets/             # 画像・SVGファイル
├── icons/              # アイコンファイル
└── scripts/            # 追加スクリプト
```

## 🚀 今後の拡張アイデア

### 新コンテンツ追加予定
- [ ] 新しいギャラリーセクション
- [ ] オロチ占い機能
- [ ] ユーザー投稿システム
- [ ] コメント機能
- [ ] SNSシェア機能
- [ ] おみくじ機能

### 技術的改善
- [ ] PWA対応
- [ ] パフォーマンス最適化
- [ ] SEO強化
- [ ] アクセシビリティ向上

## 💻 開発環境

### 必要な環境
- モダンブラウザ
- ローカルサーバー（開発時）
- Git

### 開発の始め方
```bash
# リポジトリクローン
git clone https://github.com/Borax601/orochi_web46.git

# ディレクトリ移動
cd orochi_web46

# ローカルサーバー起動（例）
python3 -m http.server 8000
# または
npx serve .
```

## 📝 変更履歴
- 2025-08-28: orochi_web45からフォーク、拡張開発用リポジトリとして設定
- フッター表記を「Borax601」→「Borax」に変更
- いいねシステムをsimple-likes.jsに移行

## 🔗 関連リンク
- **本番サイト**: https://borax601.github.io/orochi_web45/
- **開発用サイト**: https://borax601.github.io/orochi_web46/
- **作者**: Borax

---
**メモ**: このリポジトリは開運オロチ神社の新機能追加・拡張開発専用です。新しいアイデアを実装する際の実験場として活用してください。