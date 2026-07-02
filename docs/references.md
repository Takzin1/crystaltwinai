# 参考文献一覧 / References

CrystalTwin-AIの設計に用いた文献・Web資料を、**一軍文献(設計の中核)/ 補助資料(背景・比較)/ 除外・要確認**の3層で整理しています。

> **注意**: 信頼度は本プロジェクト内での相対評価です。論文・レポート等で正式に引用する前に、**著者名・発行年・掲載誌/会議・DOI・査読状況を必ず原典で確認**してください。特にプレプリント・スライド・ブログは扱いに注意してください。

---

## 1. 一軍文献(設計の中核に使用)

| # | タイトル | 分野 | 本プロジェクトへの反映 |
|---|---|---|---|
| 8 | Batch Crystallization of KCl: the Influence of the Cooling Conditions | 結晶化 | 温度・冷却速度と結晶成長/品質の関係。スコア設計の根拠 |
| 9 | A tutorial overview of model predictive control for continuous crystallization (arXiv:2506.17146) | MPC/結晶化 | 制御変数の選定、MPC的推薦、拡張ロードマップ |
| 10 | Safe-SDL: Establishing Safety Boundaries and Control Mechanisms for AI-Driven Self-Driving Laboratories (arXiv:2602.15061) | 安全/AI制御 | `safety_and_scope.md`、README免責、Human final responsibility |
| 13 | Simulation and Control of Crystallization Processes Using Population Models | 結晶化モデリング | 成長速度・粒径・安定性のモデル化背景(人口収支モデル) |
| 14 | Machine Learning Modeling and Predictive Control of the Batch Crystallization Process | ML/MPC | AI支援制御・品質予測・MPC風ロードマップ |
| 17 | EXPLAIN Guidebook: Human-Centered Explainable AI for Process Industries | XAI/HITL | 推薦に理由文を必須化した設計、HITL、利用者向け説明 |
| 18 | Immersive Simulation-Based Learning (ISBL) framework | 教育 | 学習目標・教育用UI・学習ログの設計根拠 |
| 21 | A Perspective on Integrating Process Dynamics Simulation into Process Control Education at Undergraduate Level | プロセス制御教育 | 教育用シミュレータとしての正当化・学習目標 |
| 23 | Modeling and Control of a Continuous Crystallization Process Using Neural Networks and Model Predictive Control | NN/MPC | AI/MPC高度化ロードマップ |
| 26 | Empowering operators with a human-in-the-loop/on-the-loop simulation-based digital twin: the case of a smart learning factory | HITL/DT/教育 | HITL教育設計の中核 |

## 2. 補助資料(背景説明・比較・将来拡張の根拠)

| # | タイトル | 分野 | 使い方 |
|---|---|---|---|
| 2 | DWSIM – Open-Source Chemical Process Simulator | OSSシミュレータ | 先行OSSツールとの位置づけ比較 |
| 3 | Experiment data: Human-in-the-loop decision support in process control rooms (TU Dublin) | HITL | 制御室におけるHITL意思決定支援の背景 |
| 4 | Gamification in Chemical Engineering Education – Part I (ブログ) | 教育 | 学習体験設計の補助 |
| 5 | OTS – ISS International SpA (商用ページ) | 実務例 | Operator Training Simulatorの業界事例 |
| 6 | Simulating the Manufacturing Process with Digital Twin (Dassault Systèmes blog) | DT | 製造DTの一般向け背景説明 |
| 7 | [レビュー] Transforming Engineering Education Using Generative AI and Digital Twin Technologies | 教育×DT | 教育変革の背景。**元論文の確認推奨** |
| 11 | HiRes: Inspectable Precedent Memory for Reaction Condition Recommendation (arXiv:2605.21420) | AI推薦 | 説明可能・事例ベース推薦の将来拡張 |
| 12 | RADAR – Proactive Decision Support (PDS) system | 意思決定支援 | 警告・推奨表示の設計思想の補助 |
| 15 | Extended Abstract – Mariana Monteiro | 結晶化 | 変数設計の裏取り。詳細確認推奨 |
| 16 | A Comparative Study of Rule-Based AI vs. Generative AI Models in Decision-Making Systems | ルールベースAI | 初期版をルールベース推薦とする根拠。質確認要 |
| 19 | Learn-To-Design: Reinforcement Learning-Assisted Chemical Process Optimization | RL | RL最適化ロードマップの根拠 |
| 20 | Reinforcement Learning Training Setup for the Batch Crystallisation Process (スライド) | RL/結晶化 | 教育用RLシナリオの将来拡張 |
| 22 | John L. Falconer – Educational Resources Development | 教育リソース | 教材設計の参考 |
| 24 | Digital Twins in Manufacturing: A Review | DTレビュー | DT背景・関連研究整理。査読状況の確認推奨 |
| 25 | Digital Twin Technology and Process Validation in Pharmaceutical Manufacturing (プレプリント) | DT/製薬 | 製薬DTの応用例・品質管理文脈 |
| 27 | Artificial Intelligence in Chemical Process Optimization | AI最適化 | AI支援最適化の背景。品質確認のうえ補助使用 |

## 3. 除外・再取得候補

| # | タイトル | 理由 |
|---|---|---|
| 1 | "Checking your browser" (pmc.ncbi.nlm.nih.gov) | 取得失敗ページの可能性が高く文献として不使用。元論文のタイトル・著者・DOIを再確認のこと |

---

## 4. 文献→実装の対応関係

| 実装要素 | 主な根拠文献 |
|---|---|
| 6入力変数(温度/濃度/撹拌/冷却/不純物/時間) | [8] [9] [13] [15] |
| 成長速度・安定性・品質のスコア化 | [8] [13] [14] |
| リスクレベル表示と閾値設計 | [10] [17] |
| 理由文つきルールベースAI推薦 | [16] [17] [11] |
| Human-in-the-loop前提のUI/ログ | [3] [17] [26] |
| 教育用シミュレータとしての位置づけ | [18] [21] [22] [26] |
| 免責・安全境界(実設備制御禁止) | [10] [17] [26] |
| ML/MPC/RLへの拡張ロードマップ | [9] [14] [19] [20] [23] [27] |
| OSSシミュレータとしての位置づけ | [2] [6] [24] |
