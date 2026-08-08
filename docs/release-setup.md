# Release setup — decisions & research (2026-07-17)

## 経緯

draft-siro から siro への移行時に、CI からの publish 構成について調査した。
2026年5月に TanStack への supply-chain 攻撃があり、OIDC の限界が明らかになったため、
OIDC + Staged Publishing の組み合わせを採用。

## 最終構成

| 要素               | 内容                                                                             |
| ------------------ | -------------------------------------------------------------------------------- |
| 認証               | OIDC (Trusted Publisher) — `NPM_TOKEN` 不要                                      |
| 公開フロー         | `npm stage publish` (CI) → `npm stage approve` (メンテナー、2FA)                 |
| 来歴               | `provenance=true` (`.npmrc`)                                                     |
| インストール元制限 | `allow-git=none`, `allow-file=none`, `allow-remote=none`, `allow-directory=none` |
| ワークフロー       | `.github/workflows/publish.yaml` — `v*` タグで発動                               |

### ワークフローファイル

```yaml
name: Publish
on:
  push:
    tags: ['v*']
permissions:
  contents: read
  id-token: write # OIDC
jobs:
  publish:
    runs-on: ubuntu-slim
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          registry-url: 'https://registry.npmjs.org'
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm test
      - run: pnpm pack
      - run: npm stage publish *.tgz --access public --allow-file=all
```

### npmjs.com 設定

パッケージ設定 → Trusted Publisher → GitHub Actions:

| 項目                 | 値                                                         |
| -------------------- | ---------------------------------------------------------- |
| Organization or user | `pHo9UBenaA`                                               |
| Repository           | `siro`                                                     |
| Workflow filename    | `publish.yaml`                                             |
| Allowed actions      | `npm stage publish` **のみ**（`npm publish` は許可しない） |

### 承認方法

```sh
npm stage list @pho9ubenaa/siro
npm stage approve <stage-id>   # 2FA 要求
```

## 背景: TanStack 攻撃 (2026-05-11)

- 42 パッケージに 84 の悪意あるバージョンが公開された
- 認証は正規の OIDC trusted publisher 経由
- 攻撃チェーン:
  1. `pull_request_target` の misconfiguration（fork PR に write 権限）
  2. GitHub Actions cache poisoning（fork→base の信頼境界越え）
  3. ランタイムメモリから OIDC トークンを抽出
- **OIDC だけでは防げない** — CI 内でコード実行できれば OIDC トークンは抽出可能
- GitHub Advisory: GHSA-g7cv-rxg3-hmpx

### TanStack のその後の対応

- PR workflow: `pull_request_target` → `pull_request` に変更
- Release workflow: 変更なし（OIDC + changesets/action のまま）
- Staged Publishing: **導入せず**（1段階目を塞げば連鎖全体が成立しないため）

## 背景: Staged Publishing (2026-05-22)

- npm CLI 11.15.0+ / Node 22.14.0+
- パッケージが既にレジストリに存在する必要あり（初回公開不可）
- Trusted Publisher を stage-only に設定可能
- TanStack 攻撃への直接的な対策として発表された
- 記事: https://gihyo.jp/article/2026/05/npm-staged-publishing

## 初回公開時の注意

v0.0.1 は Staged Publishing が使えない（パッケージ未登録のため）。
初回のみ手動で `pnpm publish --access public --no-provenance`（+ OTP）。
v0.0.2 以降は上記ワークフローで自動化。

## pnpm workspace catalog

`pnpm-workspace.yaml` で全依存バージョンを一元管理。
`package.json` の依存は `"catalog:"` で参照。

## siro lint dogfooding

siro 自身が siro の lint 対象。現在 `✔ No security best-practice issues found.`

設定内容:

- `.npmrc`: `provenance=true`, `save-exact=true`, `allow-*=none`
- `pnpm-workspace.yaml`: `frozenLockfile`, `frozenStore`, `blockExoticSubdeps`, `strictDepBuilds`, `trustPolicy: no-downgrade`, `minimumReleaseAge: 4320`
- `package.json`: `publishConfig.access: "public"`, `pnpm.onlyBuiltDependencies: ["esbuild"]`
