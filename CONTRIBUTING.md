# Contributing to CrystalTwinAI / 開発への参加

Thank you for considering a contribution. CrystalTwinAI is an **educational and research software** project—not a safety-qualified process control system.

## Quick start / 開発

Use Node.js 20.9+ (CI: Node 20/22), npm, and Git:

```bash
git clone https://github.com/Takzin1/crystaltwinai.git
cd crystaltwinai
npm ci
npm run dev
npm run typecheck
npm test
npm run build
```

## Contribution workflow

1. Open a GitHub Issue to discuss features or scientific assumptions. For small fixes, directly submit a focused PR.
2. Fork the repository and create a topic branch; use one concept per PR. Keep issue numbers and relevant source URLs in the description.
3. Add regression tests for source, unit, schema, security, numerical-solver, or UI changes. Run all checks above.
4. Mark **synthetic**, **literature-compiled**, and **primary measured** evidence explicitly. Never call a fitted educational model scientifically validated without an independent experiment.
5. Include licenses, author/source attribution, versioned raw-data fingerprints, conversion method, and original DOI where applicable. Never add raw full datasets, sensitive lab files, secrets or proprietary content without documented permission.
6. A reviewer may ask for changes. Technical merge authority remains with repository maintainers.

Code contributions are offered under the repository's **MIT license**, unless a separate file clearly and lawfully carries another license. Do not add code or media you cannot license.

## Good first issues / 初参加のおすすめ

- Improve keyboard and screen-reader behavior without changing numerical results.
- Document a failed synthetic solver invariant with a minimal reproducible test.
- Add reproducibility checks for an independently redistributable published dataset.
- Improve the Japanese/English documentation.

For problems involving security or leaked data, follow [SECURITY.md](SECURITY.md); do not open a public issue. For ordinary help, use GitHub Issues.

本プロジェクトはオープンな研究基盤を目指しますが、モデルは実装検証と物理的妥当性検証を厳密に区別します。投稿時に、単位・データの出典・ライセンス・検証手順を必ず記載してください。
