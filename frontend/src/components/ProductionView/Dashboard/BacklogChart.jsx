import React, { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { useTranslation } from "../../../i18n/LanguageContext";
import { CATEGORIES, formatAmount, niceScale, sumOf } from "./backlogMath";

// The backlog chart - grouped bars or lines over the same periods, one
// series per selected category, with a band x-axis in both modes.
//
// Built for speed: Recharts only draws the series and axes (PlotCanvas,
// memoised - it redraws when the data, categories, chart type or width
// change, never on hover or click). Everything interactive is a light
// layer on top that this component positions itself from the same
// geometry: which period the mouse is over (worked out from the mouse x,
// so a click always pins the period under the cursor), the grey band of
// the hovered / pinned period, and in line mode the hover rings and the
// dark value pill on the line nearest the mouse.
//
// Under each period: "Total: 405 T€" (selected categories only) and the
// period label. Too many periods for the card -> a minimum width per
// period and sideways scrolling, starting at the newest period; the y-axis
// numbers stay fixed on the left.

const HEIGHT = 380;
const MARGIN = { top: 44, right: 16, bottom: 0, left: 0 };
const X_AXIS_HEIGHT = 54;
const Y_AXIS_WIDTH = 46;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom - X_AXIS_HEIGHT;
const MIN_PERIOD_WIDTH = { bar: 92, line: 86 };

const XTick = ({ x, y, payload, periods, selected, labels, language, t }) => {
  const period = periods[payload.index];
  if (!period) return null;
  return (
    <g transform={`translate(${x},${y})`}>
      <text y={18} textAnchor="middle" className="bl-tick-total">
        {t("backlog.totalTick", { value: formatAmount(language, sumOf(period, selected), 0) })}
      </text>
      <text y={39} textAnchor="middle" className="bl-tick-label">
        {labels[payload.index]}
      </text>
    </g>
  );
};

// The Recharts part. Its props only change with the data, so hovering and
// clicking never re-render it.
const PlotCanvas = memo(function PlotCanvas({ width, periods, labels, ordered, selected, chartType, scale }) {
  const { t, language } = useTranslation();
  const data = useMemo(() => periods.map((p) => ({ key: p.key, ktl: p.ktl, pulver: p.pulver, schaeumen: p.schaeumen })), [periods]);
  return (
    <ComposedChart width={width} height={HEIGHT} data={data} margin={MARGIN} barGap={6} barCategoryGap="24%" accessibilityLayer={false}>
      <CartesianGrid
        vertical={false}
        stroke={chartType === "bar" ? "#b9bdc7" : "#eceef3"}
        strokeDasharray={chartType === "bar" ? "5 4" : undefined}
      />
      <XAxis
        dataKey="key"
        scale="band"
        interval={0}
        height={X_AXIS_HEIGHT}
        tickLine={false}
        axisLine={{ stroke: chartType === "bar" ? "#1c2333" : "#eceef3" }}
        tick={<XTick periods={periods} selected={selected} labels={labels} language={language} t={t} />}
      />
      {/* hidden: only sets the scale and the grid lines; the visible
          numbers are the fixed column beside the chart */}
      <YAxis hide width={0} domain={[0, scale.max]} ticks={scale.ticks} />
      {chartType === "bar"
        ? ordered.map((c) => <Bar key={c.key} dataKey={c.key} fill={c.color} maxBarSize={28} isAnimationActive animationDuration={450} />)
        : ordered.map((c) => (
            <Line
              key={c.key}
              type="linear"
              dataKey={c.key}
              stroke={c.color}
              strokeWidth={2}
              dot={{ r: 6.5, fill: "#ffffff", stroke: c.color, strokeWidth: 2 }}
              activeDot={false}
              isAnimationActive
              animationDuration={450}
            />
          ))}
    </ComposedChart>
  );
});

// Dark value pill above a point (below it when there's no room above).
const Pill = ({ x, y, text }) => {
  const width = text.length * 6.7 + 20;
  const below = y - 46 < 0;
  return below ? (
    <g transform={`translate(${x},${y + 16})`}>
      <rect x={-width / 2} y={2} width={width} height={26} rx={8} fill="#0f8a7c" />
      <path d="M -5 2.5 L 0 -3 L 5 2.5 Z" fill="#0f8a7c" />
      <text y={19} textAnchor="middle" className="bl-pill-text">
        {text}
      </text>
    </g>
  ) : (
    <g transform={`translate(${x},${y - 16})`}>
      <rect x={-width / 2} y={-28} width={width} height={26} rx={8} fill="#0f8a7c" />
      <path d="M -5 -2.5 L 0 3 L 5 -2.5 Z" fill="#0f8a7c" />
      <text y={-11} textAnchor="middle" className="bl-pill-text">
        {text}
      </text>
    </g>
  );
};

const BacklogChart = ({ periods, labels, selected, chartType, hoverKey, activeKey, onHover, onTogglePin }) => {
  const { language } = useTranslation();
  const scrollRef = useRef(null);
  const plotRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [focusedKey, setFocusedKey] = useState(null);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    // measure right away - ResizeObserver only reports on the next frame
    // (and not at all while the tab is in the background)
    setContainerWidth(Math.floor(el.clientWidth));
    const observer = new ResizeObserver(([entry]) => setContainerWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const minWidth = periods.length * MIN_PERIOD_WIDTH[chartType] + MARGIN.left + MARGIN.right;
  const width = Math.max(containerWidth, minWidth);

  // newest period in view whenever the data or the width changes
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [periods, width]);

  const ordered = useMemo(() => CATEGORIES.filter((c) => selected.includes(c.key)), [selected]);
  const scale = useMemo(() => niceScale(Math.max(0, ...periods.flatMap((p) => selected.map((key) => p[key] ?? 0)))), [periods, selected]);
  const yPixel = (v) => MARGIN.top + PLOT_HEIGHT * (1 - v / scale.max);

  // band geometry - the same as Recharts' band x-axis (no padding)
  const band = periods.length ? (width - MARGIN.left - MARGIN.right) / periods.length : 0;
  const bandLeft = (i) => MARGIN.left + band * i;

  const indexAt = (event) => {
    const rect = plotRef.current.getBoundingClientRect();
    const i = Math.floor((event.clientX - rect.left - MARGIN.left) / band);
    return { i: i >= 0 && i < periods.length ? i : -1, y: event.clientY - rect.top };
  };

  const handleMove = (event) => {
    const { i, y } = indexAt(event);
    const key = i >= 0 ? periods[i].key : null;
    if (key !== hoverKey) onHover(key);
    if (chartType !== "line" || i < 0) return;
    let best = null;
    for (const cat of selected) {
      const distance = Math.abs(yPixel(periods[i][cat] ?? 0) - y);
      if (!best || distance < best.distance) best = { key: cat, distance };
    }
    if (best?.key !== focusedKey) setFocusedKey(best?.key ?? null);
  };

  const activeIndex = activeKey != null ? periods.findIndex((p) => p.key === activeKey) : -1;
  const hoverIndex = hoverKey != null ? periods.findIndex((p) => p.key === hoverKey) : -1;

  return (
    <div className="bl-chart-frame">
      {/* The y-axis lives outside the scrolling area, so its numbers stay
          in view when a long range scrolls sideways. */}
      <div className={`bl-yaxis ${chartType === "bar" ? "bl-yaxis--line" : ""}`} style={{ width: Y_AXIS_WIDTH, height: HEIGHT }} aria-hidden="true">
        {scale.ticks.map((tick) => (
          <span key={tick} className="bl-yaxis-tick" style={{ top: yPixel(tick) }}>
            {formatAmount(language, tick)}
          </span>
        ))}
        <span className="bl-yaxis-rule" style={{ top: MARGIN.top, height: PLOT_HEIGHT }} />
      </div>
      <div className="bl-chart-scroll" ref={scrollRef}>
        {containerWidth > 0 && (
          <div
            ref={plotRef}
            className="bl-plot"
            style={{ width, height: HEIGHT }}
            onMouseMove={handleMove}
            onMouseLeave={() => {
              onHover(null);
              setFocusedKey(null);
            }}
            onClick={(event) => {
              const { i } = indexAt(event);
              if (i >= 0) onTogglePin(periods[i].key);
            }}
          >
            {activeIndex >= 0 && (
              <div className="bl-band" style={{ left: bandLeft(activeIndex), width: band, top: MARGIN.top, height: PLOT_HEIGHT }} />
            )}
            <PlotCanvas width={width} periods={periods} labels={labels} ordered={ordered} selected={selected} chartType={chartType} scale={scale} />
            {chartType === "line" && hoverIndex >= 0 && (
              <svg className="bl-overlay" width={width} height={HEIGHT} aria-hidden="true">
                {ordered.map((c) => {
                  const cx = bandLeft(hoverIndex) + band / 2;
                  const cy = yPixel(periods[hoverIndex][c.key] ?? 0);
                  return <circle key={c.key} cx={cx} cy={cy} r={7.5} fill="#ffffff" stroke={c.color} strokeWidth={2.5} />;
                })}
                {focusedKey && selected.includes(focusedKey) && (
                  <Pill
                    x={bandLeft(hoverIndex) + band / 2}
                    y={yPixel(periods[hoverIndex][focusedKey] ?? 0)}
                    text={`${formatAmount(language, periods[hoverIndex][focusedKey] ?? 0)} T€`}
                  />
                )}
              </svg>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BacklogChart;
