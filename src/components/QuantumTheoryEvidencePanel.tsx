"use client";

import { useEffect, useState } from "react";
import {
  parseQuantumTheoryRegistry,
  type QuantumTheoryRegistry,
} from "../lib/quantum-theory-evidence";
import type { LanguageCode } from "../lib/types";

/**
 * Literature context only. Papers never feed crystallization engine inputs,
 * derive numeric coefficients, invoke quantum hardware, or attest citations.
 */
export default function QuantumTheoryEvidencePanel({ lang }: { lang: LanguageCode }) {
  const [registry, setRegistry] = useState<QuantumTheoryRegistry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [era, setEra] = useState<"all" | "foundational" | "recent">("all");

  useEffect(() => {
    const abort = new AbortController();
    fetch("/examples/quantum-theory-evidence-v1.json", { signal: abort.signal })
      .then(response => {
        if (!response.ok) throw new Error("The bundled bibliography is unavailable.");
        const reportedLength = Number(response.headers.get("content-length"));
        if (Number.isFinite(reportedLength) && reportedLength > 128 * 1024) {
          throw new Error("The bundled bibliography is too large.");
        }
        return response.text();
      })
      .then(content => {
        if (!abort.signal.aborted) setRegistry(parseQuantumTheoryRegistry(content));
      })
      .catch(cause => {
        if (!abort.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Bibliography load failed.");
        }
      });
    return () => abort.abort();
  }, []);

  const entries = registry?.entries.filter(item =>
    era === "all" || (era === "foundational" ? item.year <= 2021 : item.year >= 2025),
  ) ?? [];

  return (
    <section className="panel research-panel" aria-label="QFabric quantum theory literature">
      <h2 className="panel-title">
        {lang === "ja" ? "QFabric × 量子理論：論拠レジストリ" : "QFabric Quantum Theory Evidence Registry"}
      </h2>
      <p className="dataset-muted">
        {lang === "ja"
          ? "一次論文のDOIと引用数の取得元を表示。量子計算の先行研究を参照できますが、ここでの結晶化計算は古典的・合成データの教育用モデルです。"
          : "Primary DOI sources and citation snapshots. Quantum research is background context, not validation of this classical synthetic crystallization model."}
      </p>
      <div className="dataset-actions" role="group" aria-label="Literature period">
        {(["all", "foundational", "recent"] as const).map(option => (
          <button key={option} type="button" className="dataset-clear"
            aria-pressed={era === option} onClick={() => setEra(option)}>
            {lang === "ja"
              ? ({ all: "全論文", foundational: "高被引用・基礎", recent: "2025–26年" } as const)[option]
              : ({ all: "All papers", foundational: "Foundational", recent: "2025–26" } as const)[option]}
          </button>
        ))}
        <a href="/examples/quantum-theory-evidence-v1.json" download>
          {lang === "ja" ? "出典データJSON" : "Download reference JSON"}
        </a>
      </div>
      {error && <p role="alert" className="dataset-error">{error}</p>}
      {!registry && !error && <p className="dataset-muted">{lang === "ja" ? "読込中…" : "Loading bibliography…"}</p>}
      {registry && (
        <>
          <p className="dataset-muted">
            {entries.length} {lang === "ja" ? "件表示" : "papers"} ·
            {lang === "ja" ? " 編集日" : " curated"} {registry.compiledOn} ·
            {" "}<a href={registry.citationDefaultSourceUrl} target="_blank" rel="noopener noreferrer">OpenAlex</a>
          </p>
          <div className="dataset-scroll">
            <table className="dataset-table">
              <thead><tr>
                <th scope="col">{lang === "ja" ? "原著論文" : "Original paper"}</th>
                <th scope="col">{lang === "ja" ? "年" : "Year"}</th>
                <th scope="col">{lang === "ja" ? "引用数（参考）" : "Citations (snapshot)"}</th>
                <th scope="col">{lang === "ja" ? "研究上の役割" : "Evidence role"}</th>
              </tr></thead>
              <tbody>
                {entries.map(item => (
                  <tr key={item.id}>
                    <th scope="row">
                      <a href={item.primaryUrl} target="_blank" rel="noopener noreferrer">{item.title}</a>
                      <p className="dataset-muted">{item.authors}</p>
                      <details>
                        <summary>{lang === "ja" ? "根拠と限界" : "Finding and limitations"}</summary>
                        <p className="dataset-muted">{item.supportedClaim}</p>
                        <p className="dataset-muted">{item.researchQuestion}</p>
                        <p className="dataset-error">{item.limitations}</p>
                      </details>
                    </th>
                    <td>{item.year}</td>
                    <td>
                      {item.citationSnapshot
                        ? <><a href={item.citationSnapshot.sourceUrl} target="_blank"
                            rel="noopener noreferrer">{item.citationSnapshot.count.toLocaleString()}</a>
                            <span className="dataset-muted"> ({item.citationSnapshot.observedOn})</span></>
                        : (lang === "ja" ? "未確認" : "Not checked")}
                    </td>
                    <td>{item.role.replaceAll("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="dataset-error">
            {lang === "ja"
              ? "科学的境界：引用数は正しさを示しません。論文のアルゴリズム、量子実機、化学反応、結晶化動力学の再現実験は行っていません。晶析シミュレーターへのパラメータ自動反映はありません。"
              : "Boundary: citation counts do not prove validity. No quantum hardware, chemistry algorithm or crystallization kinetics was reproduced; these papers never modify simulator parameters."}
          </p>
        </>
      )}
    </section>
  );
}
