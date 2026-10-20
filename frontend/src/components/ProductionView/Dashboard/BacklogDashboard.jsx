import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, LineChart, LoaderCircle, Upload } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import { cachedBacklog, getBacklog } from "../productionApi";
import BacklogChart from "./BacklogChart";
import BacklogTable from "./BacklogTable";
import CategoryPanel from "./CategoryPanel";
import RangePicker from "./RangePicker";
import {
  CATEGORY_KEYS,
  GRANULARITIES,
  defaultView,
  formatDots,
  toIso,
  periodsInRange,
  parseIso,
  periodLabel,
  periodRange,
} from "./backlogMath";
import "../productionView.css";

// Production View > Dashboard: backlog ("Auftragsbestand") development per
// category from the imported daily workbook (Production View > Upload).
// The whole stored daily series is loaded once; range, period, category
// selection and chart type are all worked out here in the browser.
//
// Header: the range picker (presets + calendar, Apply / Clear filter - see
// RangePicker.jsx). With no filter
// the chart shows the default view - the newest 7 days / 5 weeks / 5
// months for Day / Week / Month. Then the chart with its category panel,
// and the values table.

const Segmented = ({ options, value, onChange, labelOf, dark, ariaLabel }) => (
  <div className={`bl-seg ${dark ? "bl-seg--dark" : ""}`} role="group" aria-label={ariaLabel}>
    {options.map((option) => (
      <button key={option} type="button" className={option === value ? "is-active" : ""} aria-pressed={option === value} onClick={() => onChange(option)}>
        {labelOf(option)}
      </button>
    ))}
  </div>
);

const BacklogDashboard = ({ onNavigate }) => {
  const { t, language } = useTranslation();
  // shown at once from the last visit's copy, then refreshed (load())
  const [data, setData] = useState(() => cachedBacklog());
  const [error, setError] = useState("");
  // The filter the chart shows (null = default view: the newest 7 days /
  // 5 weeks / 5 months). It is edited in RangePicker and only set on Apply.
  const [applied, setApplied] = useState(null); // { preset, from, to }
  const [granularity, setGranularity] = useState("week");
  const [chartType, setChartType] = useState("bar");
  const [selected, setSelected] = useState(CATEGORY_KEYS);
  const [hoverKey, setHoverKey] = useState(null);
  const [pinnedKey, setPinnedKey] = useState(null);

  // stable, so the memoised table doesn't re-render on every hover
  const unpin = useCallback(() => setPinnedKey(null), []);

  const load = useCallback(async () => {
    setError("");
    try {
      const fresh = await getBacklog();
      // keep the same object when nothing changed, so the chart doesn't redraw
      setData((current) => (current && JSON.stringify(current) === JSON.stringify(fresh) ? current : fresh));
    } catch (err) {
      // with a cached copy on screen, a failed refresh isn't worth an error page
      if (!cachedBacklog()) setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const fallback = useMemo(
    () => (data?.lastDate ? defaultView(data.days, granularity, data.lastDate) : { periods: [], range: null }),
    [data, granularity],
  );
  const periods = useMemo(
    () => (applied ? periodsInRange(data.days, granularity, applied.from, applied.to) : fallback.periods),
    [applied, data, granularity, fallback],
  );
  const range = applied ?? fallback.range;

  const multiYear = periods.length > 0 && periods[0].start.getFullYear() !== periods[periods.length - 1].end.getFullYear();
  const labels = useMemo(
    () => periods.map((p) => periodLabel(p, granularity, language, multiYear && granularity !== "month")),
    [periods, granularity, language, multiYear],
  );

  // A hovered or pinned period that's no longer in the chart (range or
  // Day/Week/Month changed) is ignored - the panel falls back to the newest.
  const inChart = (key) => (periods.some((p) => p.key === key) ? key : null);
  const pinned = inChart(pinnedKey);
  const activeKey = inChart(hoverKey) ?? pinned;
  const activeIndex = activeKey != null ? periods.findIndex((p) => p.key === activeKey) : periods.length - 1;
  const activePeriod = periods[activeIndex];

  // A clicked (pinned) week/month: its stored days, for the table. Hover
  // alone never sets this.
  const pinnedIndex = pinned != null ? periods.findIndex((p) => p.key === pinned) : -1;
  const detail = useMemo(() => {
    if (pinnedIndex < 0 || granularity === "day") return null;
    const period = periods[pinnedIndex];
    const from = toIso(period.start);
    const to = toIso(period.end);
    return { period, label: labels[pinnedIndex], days: data.days.filter((d) => d.date >= from && d.date <= to) };
  }, [pinnedIndex, granularity, periods, labels, data]);

  const applyFilter = (filter) => {
    setApplied(filter);
    setPinnedKey(null);
  };
  const clearFilter = () => {
    setApplied(null);
    setPinnedKey(null);
  };

  if (error) {
    return (
      <main className="sp-page">
        <p className="pv-banner pv-banner--error">
          <AlertTriangle size={16} />
          <span>{error}</span>
          <button type="button" className="pv-btn pv-btn--ghost pv-btn--small" onClick={load}>
            {t("backlog.retry")}
          </button>
        </p>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="sp-page">
        <div className="pv-loading">
          <LoaderCircle size={22} className="supl-spin" />
          {t("backlog.loading")}
        </div>
      </main>
    );
  }
  if (!data.firstDate) {
    return (
      <main className="sp-page">
        <section className="sp-card pv-empty-state">
          <span className="pv-empty-icon">
            <BarChart3 size={24} />
          </span>
          <h3 className="sp-card-title">{t("backlog.emptyTitle")}</h3>
          <p className="sp-card-subtitle">{t("backlog.emptyText")}</p>
          <button type="button" className="pv-btn pv-btn--primary" onClick={() => onNavigate?.("productionUpload")}>
            <Upload size={15} />
            {t("backlog.goUpload")}
          </button>
        </section>
      </main>
    );
  }

  const exportTitle = `${t("backlog.title")} ${formatDots(parseIso(range.from))}-${formatDots(parseIso(range.to))}`;
  const panelProps = {
    period: activePeriod,
    previous: periods[activeIndex - 1],
    periodLabel: activePeriod ? labels[activeIndex] : "–",
    periodRange: activePeriod ? periodRange(activePeriod, granularity) : "",
    selected,
    pinned: pinned != null,
    onToggle: setSelected,
    onSelectAll: () => setSelected(CATEGORY_KEYS),
    onUnpin: () => setPinnedKey(null),
  };

  return (
    <main className="sp-page bl-page">
      <div className="sp-header">
        <div className="sp-heading">
          <h2 className="sp-title">{t("backlog.title")}</h2>
          <p className="sp-subtitle">
            {t("backlog.subtitle", { first: formatDots(parseIso(data.firstDate)), last: formatDots(parseIso(data.lastDate)) })}
          </p>
        </div>
        <RangePicker
          firstDate={data.firstDate}
          lastDate={data.lastDate}
          range={range}
          applied={applied}
          defaultLabel={t(`backlog.default_${granularity}`)}
          onApply={applyFilter}
          onClear={clearFilter}
        />
      </div>

      <section className="sp-card bl-card">
        <div className="bl-card-header">
          <div>
            <h3 className="bl-card-title">{t("backlog.chartTitle")}</h3>
            <p className="sp-card-subtitle">
              {t(`backlog.chartSubtitle_${granularity}`)}
              {!applied && <span className="bl-default-note"> · {t(`backlog.defaultView_${granularity}`)}</span>}
            </p>
          </div>
          <div className="bl-card-controls">
            <Segmented
              ariaLabel={t("backlog.period")}
              options={GRANULARITIES}
              value={granularity}
              onChange={(g) => {
                setGranularity(g);
                setPinnedKey(null);
              }}
              labelOf={(g) => t(`backlog.granularity_${g}`)}
              dark
            />
            <div className="bl-seg bl-seg--icons" role="group" aria-label={t("backlog.chartType")}>
              <button type="button" className={chartType === "bar" ? "is-active" : ""} aria-pressed={chartType === "bar"} onClick={() => setChartType("bar")} title={t("backlog.bar")}>
                <BarChart3 size={15} />
                <span>{t("backlog.bar")}</span>
              </button>
              <button type="button" className={chartType === "line" ? "is-active" : ""} aria-pressed={chartType === "line"} onClick={() => setChartType("line")} title={t("backlog.line")}>
                <LineChart size={15} />
                <span>{t("backlog.line")}</span>
              </button>
            </div>
          </div>
        </div>

        {periods.length === 0 ? (
          <p className="pv-empty">{t("backlog.noDataInRange")}</p>
        ) : (
          <div className="bl-body">
            <CategoryPanel variant="chips" {...panelProps} />
            <div className="bl-chart-area">
              <span className="bl-unit">T€</span>
              <BacklogChart
                periods={periods}
                labels={labels}
                selected={selected}
                chartType={chartType}
                hoverKey={inChart(hoverKey)}
                activeKey={activeKey}
                onHover={setHoverKey}
                onTogglePin={(key) => setPinnedKey((prev) => (prev === key ? null : key))}
              />
            </div>
            <CategoryPanel {...panelProps} />
          </div>
        )}
      </section>

      <BacklogTable
        periods={periods}
        labels={labels}
        granularity={granularity}
        exportTitle={exportTitle}
        detail={detail}
        onCloseDetail={unpin}
      />
    </main>
  );
};

export default BacklogDashboard;
