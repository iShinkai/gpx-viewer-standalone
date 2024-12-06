# gpx-viewer-standalone / GPV Viewer スタンドアロン版

静的に配置した GPX データや写真データを読み取り MapLibre で描画する実証アプリです。

コンテンツは以下のURLで公開しています。

https://ishinkai.github.io/gpx-viewer-standalone/dist/

初期表示やリスト選択時にそこそこ待たされることもあるかも知れませんが、処理中なだけなのでしばらく待てばちゃんと表示されます。

## インストールとセットアップ

volta と corepack、pnpm を使用しています。
以下のコマンドでインストールを行います。

```bash
volta install node@22.11.0
volta install corepack
corepack enable
corepack enable pnpm
pnpm install
```

次に、ローカルビルドを参照するための環境を作ります。
ローカルビルドは Vite のローカルサーバでホストするわけではなく、 VS Code の拡張機能である [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) を利用します。
Live Server で HTTPS リクエストができるよう証明書の作成が必要です。

```bash
openssl req -x509 -newkey rsa:4096 -sha256 -nodes -keyout ./vscode_live_server.key.pem -out ./vscode_live_server.cert.pem
```

諸々訊かれますが `Common Name` だけ `localhost` などの値、あとは全て空エンターで構いません。
作成した `vscode_live_server.key.pem`、`vscode_live_server.cert.pem` を Live Server で参照するよう `.vscode/settings.json` に記述します。

```json
{
  "liveServer.settings.https": {
    "enable": true,
    "cert": "/path/to/vscode_live_server.cert.pem",
    "key": "/path/to/vscode_live_server.key.pem",
    "passphrase": ""
  },
  "liveServer.settings.root": "/dist",
  "liveServer.settings.port": 5512
}
```

`liveServer.settings.https` の `cert` と `key` のパスはフルパスである必要があります（`/path/to` は然るべき内容に書き換えてください）。
また `liveServer.settings.port` は好きなポートで良いと思います。
デフォルトだと `5500` です。

## 開発について

`src` 以下にソースコードが配置されています。
エントリポイントは `main.js` です。

### データについて

`dist/data` 以下にサンプルのデータを配置しています。
はじめに `records.json` をフェッチし、その内容に沿ってサブディレクトリから個々のデータを取得して描画する手順になっています。

## ビルドについて

### 開発ビルド

console 出力が残る開発・デバッグ用のビルドです。
以下のコマンドで実行します。

```bash
pnpm devel
```

`dist/` 以下に `main.js` ファイルが生成されます。

### ウォッチモード

LiveServer でウォッチするためのモードです。
以下のコマンドで実行します。

```bash
pnpm watch
```

コマンド実行後、コードが修正されるたびにビルドが実行されます。
上述通りウォッチには LiveServer を使用しますので、事前に証明書の作成や `.vscode/settings.json` の記述など適切な設定を行ってください。

### リリースビルド

本番環境適用のためのビルドです。
とは言え開発ビルドとの違いは console が残るかどうかだけです。
以下のコマンドで実行します。

```bash
pnpm build
```

## kintone 版

サイボウズの業務改善プラットフォーム kintone 上のアプリで動かす事ができるバージョンは以下で公開しています。

[GPX Viewer kintone 版（リポジトリ）](https://github.com/iShinkai/gpx-viewer-kintone)

Qiita の記事は以下を参照してください。
[kintone × MapLibre で旅の想い出を可視化する](https://qiita.com/iShinkai/items/f20edc14c5689df8e0cd)

## ライセンス

`dist/data` 以下のファイルを除き MIT ライセンスです。
[LICENSE](LICENSE) を参照してください。
`dist/data` 以下のファイルはサンプルとして同梱しているものであり、著作権等各種権利は放棄しておりません。
