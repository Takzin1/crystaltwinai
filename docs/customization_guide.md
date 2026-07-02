# カスタマイズガイド / Customization Guide

CrystalTwin-AIは「config層を書き換えるだけで別ドメインのデモに変わる」ことを設計目標にしています。
本ガイドでは、変更したい内容ごとに **どのファイルを触ればよいか** と、具体的な手順を示します。

> 原則: **UIコンポーネントとエンジン本体(`src/lib/engine.ts`)は触らずに済むように、変更点は `src/config/` に集約されています。**

---

## 0. 変更ポイント早見表

| やりたいこと | 触るファイル | 難易度 |
|---|---|---|
| 変数名・単位・範囲・初期値の変更 | `src/config/parameters.ts` | ★ |
| UI表示ラベル(日/英)の変更 | `src/config/labels.ts` | ★ |
| 業界別シナリオの追加・変更 | `src/config/scenarios.ts` | ★ |
| リスク判定の閾値・文言の変更 | `src/config/risk.config.ts` | ★ |
| AI推薦ルール・文言の追加/変更 | `src/config/recommendations.config.ts` | ★★ |
| スコアリング式の係数調整 | `src/config/scoring.config.ts` | ★★ |
| スコア計算ロジック自体の差し替え | `src/lib/scoring.ts` | ★★★ |
| 推薦ロジックのML/MPC/外部API化 | `src/lib/recommend.ts` | ★★★ |
| 物理モデル(時間発展)の差し替え | `src/lib/engine.ts` | ★★★ |

---

## 1. 入力変数を変更する — `parameters.ts`

各変数は次の形で定義されています。

```ts
{
  id: "temperature",
  label: { ja: "初期温度", en: "Initial temperature" },
  unit: "°C",
  min: 20,
  max: 90,
  step: 1,
  defaultValue: 62,
  description: { ja: "...", en: "..." },
}
```

- **範囲・単位・ラベルの変更**はこのファイルだけで完結します。スライダーUIは定義を読んで自動生成されます。
- 変数を**追加**する場合は、`src/lib/types.ts` の `SimulationInput` にフィールドを追加し、エンジン/スコアリングでの利用箇所を実装してください(★★★)。

**例: 食品加工向けに「pH」風の変数へ読み替える**
`impurityLevel` の `label` を `{ ja: "夾雑物濃度", en: "Contaminant level" }` に、`unit` を `%` のまま範囲だけ変える、といった軽カスタムであれば5分で完了します。

## 2. 表示ラベルを変更する — `labels.ts`

タイトル、セクション見出し、スコアカード名、ボタン文言など**全UI文字列**が日英ペアで定義されています。研修先企業名の入ったタイトルへの変更、完全英語化、用語の業界用語への置換はここだけで行えます。

## 3. シナリオプリセットを作る — `scenarios.ts`

シナリオは「6変数の値セット+名前+説明」です。

```ts
{
  id: "pharma",
  label: { ja: "製薬: 高品質重視", en: "Pharma: quality-first" },
  description: { ja: "...", en: "..." },
  input: { temperature: 55, concentration: 0.37, stirringSpeed: 300,
           coolingRate: 0.3, impurityLevel: 0.5, timeSteps: 120 },
}
```

研修・授業では「受講者に配る初期状態」として機能します。演習課題(例: 「unstableシナリオを品質80以上に改善せよ」)を作る際の起点になります。

## 4. リスク判定を変更する — `risk.config.ts`

リスクルールは `condition + level + reason` の宣言的なテーブルです。閾値変更・ルール追加はテーブル編集のみで、判定器(`src/lib/risk.ts`)の変更は不要です。各ルールに**理由文**が必須なのは、説明可能性(XAI)を構造として強制するためです。

## 5. AI推薦を変更する — `recommendations.config.ts`

推薦も同様に宣言的なルールテーブルです。

```ts
{
  id: "reduce-cooling",
  priority: 2,
  condition: (s, i) => s.nucleationEvents >= 1 && i.coolingRate > 0.6,
  message: { ja: "冷却速度を0.3〜0.6 °C/minに下げ…", en: "..." },
  reason:  { ja: "急冷により過飽和度が核発生閾値を超え…", en: "..." },
}
```

- `priority` が小さいものから最大 `MAX_RECOMMENDATIONS`(既定3)件が表示されます。
- **`message`(何をすべきか)と `reason`(なぜそう言えるか)を必ずペアで書く**のが本プロジェクトの推薦ポリシーです。

## 6. スコアリング式を調整する — `scoring.config.ts`

溶解度曲線の係数、成長速度のべき指数、核発生閾値、品質ペナルティ係数など、**物理モデルの全係数**がコメント付きで集約されています。「もう少し不純物に敏感なデモにしたい」等の調整はここで完結します。

## 7. ロジックそのものを差し替える(ML / MPC / 外部API)

3つのモジュールが差し替えポイントです。**返り値の型を維持すれば、UI・エンジンは無変更**で動きます。

| モジュール | インターフェース | 差し替え例 |
|---|---|---|
| `src/lib/scoring.ts` | `(state...) => scores` | 学習済み回帰モデルによる品質予測 |
| `src/lib/risk.ts` | `(summary) => RiskAssessment` | 業界別リスクマトリクス、異常検知モデル |
| `src/lib/recommend.ts` | `(summary, input) => Recommendation[]` | MPC最適化の操作提案、外部API呼び出し |

例えば `recommend.ts` をサーバーサイドAPI(`/api/recommend`)呼び出しに変える場合も、`Recommendation[]`(`id / message / reason / priority`)を返す限りUIはそのまま動作します。

## 8. 横展開の手順(結晶化以外のドメインへ)

1. `parameters.ts` — 変数名・単位・範囲をドメイン用語に変更
2. `labels.ts` — タイトル・見出し・スコア名を変更
3. `scoring.config.ts` — 係数を調整(必要なら `scoring.ts` を差し替え)
4. `risk.config.ts` / `recommendations.config.ts` — ルールと文言をドメイン知識で書き換え
5. `scenarios.ts` — 授業・研修用プリセットを作成
6. README冒頭と免責を対象ドメイン向けに更新

この6ステップが「Basic Demo Custom」で提供している作業の実体です。

---

## 注意事項

- 本モデルは教育目的の簡略化モデルです。係数を実データに合わせても、**実設備制御・安全判断への使用は不可**です(詳細: [safety_and_scope.md](safety_and_scope.md))。
- ルール文言を変更する際も、`reason`(根拠)の記載を省略しないでください。説明のない推薦は本プロジェクトの設計原則に反します。
