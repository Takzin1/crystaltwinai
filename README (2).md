# CrystalTwin-AI

**AI支援プロセス制御を学ぶ、教育・研究用デジタルツインシミュレータ**
*Educational Digital Twin Simulator for AI-assisted Process Control*

> 🧪 教育・研究・PoC用 | Education / Research / PoC use only — 実設備制御には使用できません

---

## 概要

CrystalTwin-AIは、結晶成長・溶液プロセス制御を題材にした**教育・研究用のデジタルツインAI制御シミュレータ**です。温度・濃度・撹拌速度・冷却速度・不純物濃度・時間ステップという仮想パラメータを操作し、成長速度・安定性・品質・リスクレベル・AI推薦・シミュレーションログの変化をリアルタイムに観察することで、AI支援型プロセス制御の考え方を体験的に学べます。

- **AIは判断主体ではなく支援役** — 推薦はすべてルールベースで、「なぜその推薦が出たか」を必ず表示します(説明可能性)
- **Human-in-the-loop前提** — 最終判断・責任・安全境界は人間側に残す設計です
- **モジュール化されたロジック** — スコアリング・リスク判定・推薦は設定ファイルと独立モジュールに分離されており、業界別ロジック・機械学習モデル・外部APIに差し替え可能です

## 目的

1. 学部〜大学院レベルのプロセス制御教育に、動的シミュレーションによる体験学習を提供する
2. Human-in-the-loop型のAI意思決定支援・説明可能AI(XAI)の設計パターンを実装例として示す
3. 企業研修・研究室演習・業界別PoCへカスタマイズ可能なOSS基盤を提供する

## デモの見どころ

- **結晶ツインビュー** — 収量・品質・核発生バーストが1つの結晶グラフィックに反映される「デジタルツイン」表示
- **失敗シナリオ内蔵** — 「不安定運転(失敗例)」プリセットで、急冷×高濃度による核発生バーストとリスク警告・改善推薦の連鎖を体験できます
- **日英切替UI** — 授業・学会発表・海外向けデモにそのまま使えます

## セットアップ

```bash
git clone https://github.com/<your-org>/crystaltwin-ai.git
cd crystaltwin-ai
npm install
npm run dev
# → http://localhost:3000
```

要件: Node.js 18.17以上。外部APIキーは不要です(初期版は完全ローカル動作)。

本番ビルド:

```bash
npm run build && npm run start
```

## 使い方

1. 左パネルの**シナリオ**からプリセット(教育用ベース / 医薬品原薬 / 食品 / 不安定運転)を選択
2. スライダーで各パラメータを変更 — 出力は即時に再計算されます
3. スコアカード・リスクレベル・AI推薦・時系列チャート・ログの変化を観察
4. AI推薦の「推薦理由」を読み、なぜその改善案が出たのかを確認
5. 推薦に従ってパラメータを調整し、スコアが改善するかを検証

## 入力変数

| 変数 | 範囲 | 説明 |
|---|---|---|
| 初期温度 | 20–90 °C | 溶解度を通じて過飽和度に影響 |
| 溶質濃度 | 0.10–0.60 g/mL | 飽和濃度超過で結晶成長が開始 |
| 撹拌速度 | 0–1000 rpm | 物質移動を促進。過剰で結晶破砕 |
| 冷却速度 | 0.05–2.0 °C/min | 急冷は核発生バーストを誘発 |
| 不純物濃度 | 0–5 % | 成長阻害・品質低下の要因 |
| 時間ステップ数 | 10–200 | 1ステップ = 仮想1分 |

定義は `src/config/parameters.ts` にあり、ラベル・単位・範囲を自由に変更できます。

## 出力指標

| 指標 | 内容 |
|---|---|
| 平均成長速度 | 過飽和度・撹拌・不純物から算出される線形成長速度(a.u./min) |
| 安定性スコア | 0–100。過飽和逸脱・急冷・撹拌異常・不純物のペナルティ合成 |
| 品質スコア | 0–100。過速成長による欠陥・不純物取り込み・核発生の影響 |
| 最終収量 | 累積結晶収量(a.u. 0–100) |
| リスクレベル | 低 / 中 / 高。判定理由を必ず併記 |
| AI推薦 | ルールベースの改善提案。推薦理由(Why)を必ず併記 |
| シミュレーションログ | 成長開始・核発生バースト・溶質枯渇などのイベント記録 |

## アーキテクチャとカスタマイズ可能箇所

```
src/
├── config/                  ← ★カスタマイズはここから
│   ├── parameters.ts        入力変数の種類・範囲・ラベル・単位
│   ├── scoring.config.ts    物理モデル係数・スコアリング式の全係数
│   ├── risk.config.ts       リスク判定ルールと閾値(理由文つき)
│   ├── recommendations.config.ts  AI推薦ルール・文言(理由文つき)
│   ├── scenarios.ts         業界別・教育用シナリオプリセット
│   └── labels.ts            全UI表示ラベル(日/英)
├── lib/
│   ├── engine.ts            時間発展エンジン(決定論的)
│   ├── scoring.ts           スコア計算(差し替え可能モジュール)
│   ├── risk.ts              リスク評価(差し替え可能モジュール)
│   ├── recommend.ts         推薦生成(ML/MPC/API差し替えポイント)
│   └── types.ts             共有型定義
└── components/              UIコンポーネント
```

**典型的なカスタマイズ例**(詳細は [docs/customization_guide.md](docs/customization_guide.md)):

- 業界向けの変数名・単位・範囲の変更 → `parameters.ts` と `labels.ts` のみ
- リスク閾値・推薦文言の変更 → `risk.config.ts` / `recommendations.config.ts` のみ
- 推薦ロジックのML/MPC/外部API化 → `recommend.ts` を同一インターフェースで差し替え
- 食品加工・農業環境制御・製薬・材料開発などへの横展開 → config層の書き換えのみでUI・エンジンは共通

## 免責事項 / Disclaimer

**日本語:** CrystalTwin-AIは、AI支援型プロセス制御の考え方を学ぶための教育・研究用プロトタイプです。特定企業の製造工程、機密ノウハウ、実設備制御を再現するものではありません。本システムは安全上重要な判断、実設備制御、医療判断、生産工程の妥当性確認には使用できません。内部モデルは教育目的の簡略化モデルであり、実プロセスの検証済みモデルではありません。推薦はルールベースの例示であり、最終的な解釈と責任は人間の利用者にあります。

**English:** CrystalTwin-AI is an educational and research-oriented prototype for learning AI-assisted process control concepts. It does not reproduce any specific industrial process, proprietary manufacturing method, or confidential operational know-how. The simulator is not intended for real equipment control, safety-critical decision-making, medical use, or production process validation. The internal model is a simplified pedagogical approximation, not a validated process model. All recommendations are rule-based and illustrative. Final interpretation and responsibility remain with human users.

詳細な安全境界と責任分界は [docs/safety_and_scope.md](docs/safety_and_scope.md) を参照してください。

## 設計思想

AIとデジタルツインで無駄な作業や理解コストを減らし、**人間が本質的な判断・学習・安全責任に集中できるようにする**。AIは判断主体ではなく、意思決定支援・学習支援・仮説検証支援のための道具です。詳細は [docs/design_principles.md](docs/design_principles.md) を参照。

## 参考文献(主要)

設計の中核に用いた一軍文献(正式引用前に著者・発行年・DOI・査読状況の確認を推奨):

1. Batch Crystallization of KCl: the Influence of the Cooling Conditions — 温度・冷却速度と結晶化の関係
2. A tutorial overview of model predictive control for continuous crystallization — 制御思想・MPC拡張ロードマップ
3. Safe-SDL: Establishing Safety Boundaries and Control Mechanisms for AI-Driven Self-Driving Laboratories — 安全境界・免責設計
4. Simulation and Control of Crystallization Processes Using Population Models — 成長・粒径・安定性のモデル化背景
5. Machine Learning Modeling and Predictive Control of the Batch Crystallization Process — ML/MPC拡張の根拠
6. EXPLAIN Guidebook: Human-Centered Explainable AI for Process Industries — 説明可能な推薦・HITL設計
7. Immersive Simulation-Based Learning (ISBL) framework — 教育用シミュレータの設計根拠
8. A Perspective on Integrating Process Dynamics Simulation into Process Control Education — 教育的正当化
9. Modeling and Control of a Continuous Crystallization Process Using Neural Networks and MPC — 高度化ロードマップ
10. Empowering operators with a human-in-the-loop/on-the-loop simulation-based digital twin — HITL教育設計の中核

補助資料を含む全文献リストと使い分けは [docs/references.md](docs/references.md) を参照。

## 今後の拡張方針

- **制御の高度化**: PID制御デモ → MPC風推薦 → 強化学習(RL)エージェントの段階的追加
- **学習機能**: 学習者モード(課題+採点)、教員用シナリオエディタ、学習ログのエクスポート
- **データ連携**: CSVインポートによる実験データとの比較、パラメータ推定
- **横展開**: 食品加工・農業環境制御・製薬プロセス・材料開発・化学教育・スマートファクトリー研修向けconfigセット

## カスタマイズ・研修・PoCのご相談

CrystalTwin-AIはOSSとして公開しています。以下のようなご要望に有償で対応可能です。

| メニュー | 内容 |
|---|---|
| **Basic Demo Custom** | 業界・研究テーマに合わせた変数・シナリオ・ラベルの軽カスタム |
| **Workshop Package** | 企業研修・大学授業・研究室演習向けの教材化(演習課題・講師用資料つき) |
| **Industry Custom PoC** | 業界別のPoCデモ化(貴社ドメインの制御課題を模擬) |
| **Academic Lab Adaptation** | 研究室テーマに合わせたモデル・変数・出力の改造 |
| **Enterprise / Data Integration** | 社内データ・実験データとの連携、ML/MPCモジュール開発のご相談 |

企業研修、大学授業、研究室演習、業界別PoC、デジタルツイン教育教材としてのカスタマイズをご希望の場合は、[Issues](../../issues) または下記までお問い合わせください。

📧 **Contact**: `<e2470308@ipc.fukushima-u.ac.jp>` / GitHub Issues / `<https://www.linkedin.com/in/takahito-yumita-91b1bb2b4/>`

## License

MIT License — see [LICENSE](LICENSE).
