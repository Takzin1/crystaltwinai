"use client";

import { useEffect, useMemo, useState } from "react";
import {
  parseQuantumTheoryRegistry,
  type QuantumTheoryRegistry,
  type QuantumTheoryEntry,
} from "../lib/quantum-theory-evidence";
import {
  comparePapers,
  selectEvidence,
  type EvidencePeriod,
  type EvidenceSort,
} from "../lib/quantum-evidence-explorer";
import type { LanguageCode } from "../lib/types";

function EvidenceDetails({ paper, lang }: { paper: QuantumTheoryEntry; lang: LanguageCode }) {
  return (
    <div className="evidence-finding">
      <p><strong>{lang === "ja" ? "論文が報告した知見" : "Reported claim"}:</strong> {paper.supportedClaim}</p>
      <p><strong>{lang === "ja" ? "検証課題" : "Testable question"}:</strong> {paper.researchQuestion}</p>
      <p className="evidence-limit"><strong>{lang === "ja" ? "適用限界" : "Limits"}:</strong> {paper.limitations}</p>
    </div>
  );
}

/** Offline bibliography explorer: does not calibrate or run a quantum device. */
export default function QuantumTheoryEvidencePanel({ lang }: { lang: LanguageCode }) {
  const [registry, setRegistry] = useState<QuantumTheoryRegistry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<EvidencePeriod>("all");
  const [sort, setSort] = useState<EvidenceSort>("relevance");
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    const abort = new AbortController();
    fetch("/examples/quantum-theory-evidence-v1.json", { signal: abort.signal })
      .then(response => {
        if (!response.ok) throw new Error("The bundled bibliography is unavailable.");
        const length = Number(response.headers.get("content-length"));
        if (Number.isFinite(length) && length > 128 * 1024) {
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

  const papers = registry?.entries;
  const entries = useMemo(
    () => selectEvidence(papers ?? [], { query, period, sort }),
    [papers, query, period, sort],
  );
  const compared = useMemo(
    () => comparePapers(papers ?? [], selected),
    [papers, selected],
  );
  const withCounts = papers?.filter(p => p.citationSnapshot !== null).length ?? 0;

  function togglePaper(id: string) {
    setSelected(old => old.includes(id)
      ? old.filter(item => item !== id)
      : old.length < 2 ? [...old, id] : old);
  }
  const t = (ja: string, en: string) => lang === "ja" ? ja : en;

  return (
    <section className="panel research-panel evidence-panel" aria-labelledby="quantum-evidence-title">
      <div className="evidence-heading">
        <div>
          <p className="evidence-eyebrow">RESEARCH LIBRARY / QFABRIC</p>
          <h2 id="quantum-evidence-title" className="evidence-title">
            {t("量子理論・研究根拠ライブラリ", "Quantum theory evidence library")}
          </h2>
          <p className="dataset-muted">{t(
            "原著DOI・引用数の取得元・論文の主張・限界を追跡。検索・比較は端末内で完結します。",
            "Explore original DOI sources, citation provenance, scientific claims and limitations locally.",
          )}</p>
        </div>
        <a className="evidence-source-link" href="/examples/quantum-theory-evidence-v1.json" download>
          {t("レジストリJSON ↓", "Registry JSON ↓")}
        </a>
      </div>
      {error && <p role="alert" className="dataset-error">{error}</p>}
      {!registry && !error && <p role="status" className="dataset-muted">
        {t("文献を読み込み中…", "Loading bibliography…")}
      </p>}
      {registry && <>
        <div className="evidence-stats">
          <div><strong>{papers?.length ?? 0}</strong><span>{t("収録論文", "Papers")}</span></div>
          <div><strong>{papers?.filter(p => p.year >= 2025).length ?? 0}</strong><span>{t("2025年以降", "Since 2025")}</span></div>
          <div><strong>{withCounts}</strong><span>{t("引用数を記録", "Counts recorded")}</span></div>
          <div><strong>{registry.compiledOn}</strong><span>{t("レジストリ編集日", "Curated on")}</span></div>
        </div>
        <div className="evidence-toolbar">
          <label className="evidence-field evidence-search">
            <span>{t("論文を検索", "Search research")}</span>
            <input type="search" value={query} onChange={event => setQuery(event.target.value)}
              placeholder={t("タイトル・著者・DOI・論点", "Title, author, DOI, topic")} autoComplete="off" />
          </label>
          <label className="evidence-field">
            <span>{t("対象期間", "Period")}</span>
            <select value={period} onChange={event => setPeriod(event.target.value as EvidencePeriod)}>
              <option value="all">{t("全年代", "All years")}</option>
              <option value="foundational">{t("基礎理論（〜2021）", "Foundational (to 2021)")}</option>
              <option value="recent">{t("近年（2025〜）", "Recent (2025+)")}</option>
            </select>
          </label>
          <label className="evidence-field">
            <span>{t("並び順", "Sort")}</span>
            <select value={sort} onChange={event => setSort(event.target.value as EvidenceSort)}>
              <option value="relevance">{t("収録順", "Curated order")}</option>
              <option value="newest">{t("発行年（新しい順）", "Newest first")}</option>
              <option value="most-cited">{t("引用数（多い順）", "Most cited (snapshot)")}</option>
            </select>
          </label>
        </div>
        <div className="evidence-result-line" role="status" aria-live="polite">
          {entries.length} {t("件の論文が該当", "matching papers")}
          {(query || period !== "all" || sort !== "relevance") && (
            <button type="button" onClick={() => { setQuery(""); setPeriod("all"); setSort("relevance"); }}>
              {t("フィルターを解除", "Clear filters")}
            </button>
          )}
        </div>
        {entries.length === 0 && (
          <div className="evidence-empty">
            <p>{t("一致する論文はありません。検索語を短くしてみてください。", "No matching papers. Try a shorter search.")}</p>
            <button type="button" className="dataset-clear" onClick={() => { setQuery(""); setPeriod("all"); }}>
              {t("全論文を表示", "Show all papers")}
            </button>
          </div>
        )}
        <div className="evidence-grid">
          {entries.map(paper => {
            const picked = selected.includes(paper.id);
            const citation = paper.citationSnapshot;
            return (
              <article key={paper.id} className={picked ? "evidence-card evidence-picked" : "evidence-card"}>
                <div className="evidence-card-top">
                  <span className="evidence-tag">{paper.year} · {paper.publicationType.replaceAll("_", " ")}</span>
                  <label className="evidence-compare">
                    <input type="checkbox" checked={picked} disabled={!picked && selected.length >= 2}
                      onChange={() => togglePaper(paper.id)} />
                    {t("比較", "Compare")}
                  </label>
                </div>
                <h3><a href={paper.primaryUrl} target="_blank" rel="noopener noreferrer">{paper.title}</a></h3>
                <p className="evidence-authors">{paper.authors}</p>
                <p className="evidence-role">{paper.role.replaceAll("_", " ")}</p>
                <div className="evidence-citation">
                  <strong>{citation ? citation.count.toLocaleString() : "—"}</strong>
                  <span>{t("引用数（出典表示値）", "Citations (source snapshot)")}</span>
                </div>
                {citation ? <p className="evidence-small">
                  <a href={citation.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {t("引用数の取得元", "Citation source")}
                  </a> · {citation.observedOn}
                </p> : <p className="evidence-small">{t("引用数未確認（0件ではない）", "Count unavailable (not zero)")}</p>}
                <details className="evidence-details">
                  <summary>{t("主張・検証課題・限界を確認", "Claims, test questions & limits")}</summary>
                  <EvidenceDetails paper={paper} lang={lang} />
                </details>
                <a className="evidence-doi" href={paper.primaryUrl} target="_blank" rel="noopener noreferrer">
                  DOI: {paper.doi}
                </a>
              </article>
            );
          })}
        </div>
        <section className="evidence-comparison" aria-label={t("2論文の比較", "Paper comparison")}>
          <div className="evidence-compare-heading">
            <div>
              <h3>{t("論文を並べて比較", "Compare two papers")}</h3>
              <p className="dataset-muted">{t("各カードの「比較」を最大2件選択。論文の主張と適用限界を比較します。",
                "Select up to two papers to contrast reported claims and limitations.")}</p>
            </div>
            {selected.length > 0 && <button type="button" className="dataset-clear" onClick={() => setSelected([])}>
              {t("選択解除", "Clear selection")}
            </button>}
          </div>
          {compared.length === 0 ? <p className="evidence-blank">
            {t("上の論文カードから比較対象を選択してください。", "Choose papers above to start a comparison.")}
          </p> : <div className="evidence-compare-grid">
            {compared.map(paper => (
              <article key={paper.id} className="evidence-compare-item">
                <h4><a href={paper.primaryUrl} target="_blank" rel="noopener noreferrer">{paper.title}</a></h4>
                <p className="dataset-muted">{paper.year} · {paper.authors}</p>
                <EvidenceDetails paper={paper} lang={lang} />
              </article>
            ))}
          </div>}
        </section>
        <p className="evidence-disclaimer">
          {t(
            "注：引用数は取得時点の参考値で、品質・再現性を保証しません。量子論文と教育用晶析シミュレーションは別の研究対象です。この画面から係数・推奨値・量子制御は変更されません。",
            "Citation counts are dated bibliometrics, not proof of correctness. Quantum papers and this synthetic crystallization simulator are separate research domains. No calibration or hardware execution occurs here.",
          )}{" "}
          <a href="https://github.com/Takzin1/QFabric/blob/main/docs/datasets/quantum-theory-evidence-v1.md"
            target="_blank" rel="noopener noreferrer">{t("根拠管理の方法", "Evidence methodology")}</a>
        </p>
      </>}
    </section>
  );
}
