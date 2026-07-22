"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart, CandlestickSeries, HistogramSeries,
  type IChartApi, type ISeriesApi, type UTCTimestamp,
} from "lightweight-charts";

/*
  The chart. lightweight-charts (TradingView OSS) themed from our CSS
  variables so it follows dark/light live. Candles + volume underlay,
  timeframe strip, staleness-honest header handled by the parent.
*/

export type ChartBar = {
  time: number; open: number; high: number; low: number; close: number; volume: number;
};

/**
 * lightweight-charts parses only legacy color syntax, but getComputedStyle
 * hands back modern lab()/oklch(). Round-trip through a 1×1 canvas to get
 * a plain hex the chart understands, whatever the source colorspace.
 */
const colorCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
function cssVar(name: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!colorCanvas) return raw;
  const ctx = colorCanvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000";
  ctx.fillStyle = raw;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  if (a < 255) return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export default function PriceChart({ bars, height = 420 }: { bars: ChartBar[]; height?: number }) {
  const holder = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const [themeTick, setThemeTick] = useState(0);

  // Rebuild chart colors when the theme attribute flips.
  useEffect(() => {
    const observer = new MutationObserver(() => setThemeTick((t) => t + 1));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!holder.current) return;
    const el = holder.current;

    const ink3 = cssVar("--ink-3");
    const hairline = cssVar("--hairline");
    const gain = cssVar("--gain");
    const loss = cssVar("--loss");

    const chart = createChart(el, {
      height,
      layout: {
        background: { color: "transparent" },
        textColor: ink3,
        fontFamily: "var(--font-plex-mono), monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: hairline },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true },
      crosshair: {
        vertLine: { color: ink3, width: 1, style: 2, labelBackgroundColor: cssVar("--bg3") },
        horzLine: { color: ink3, width: 1, style: 2, labelBackgroundColor: cssVar("--bg3") },
      },
      handleScroll: { mouseWheel: false },
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: gain, downColor: loss,
      wickUpColor: gain, wickDownColor: loss,
      borderVisible: false,
    });
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      color: hairline,
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

    chartRef.current = chart;
    candleRef.current = candles;
    volumeRef.current = volume;

    const resize = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth });
    });
    resize.observe(el);

    return () => { resize.disconnect(); chart.remove(); chartRef.current = null; };
  }, [height, themeTick]);

  useEffect(() => {
    if (!candleRef.current || !volumeRef.current) return;
    candleRef.current.setData(
      bars.map((b) => ({
        time: b.time as UTCTimestamp,
        open: b.open, high: b.high, low: b.low, close: b.close,
      })));
    volumeRef.current.setData(
      bars.map((b) => ({ time: b.time as UTCTimestamp, value: b.volume })));
    chartRef.current?.timeScale().fitContent();
  }, [bars, themeTick]);

  return <div ref={holder} className="w-full" style={{ height }} />;
}
