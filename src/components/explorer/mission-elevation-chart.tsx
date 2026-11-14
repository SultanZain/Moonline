/** Plot real sampled elevations without joining missing values. @author Sultan */
"use client";
import { useEffect, useRef } from "react";
import { init, use as registerCharts } from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent, MarkLineComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import type { AnalyzedSite } from "@/hooks/use-mission-analysis";
import { formatMapCoordinates } from "./lunar-map-coordinates";

registerCharts([LineChart, GridComponent, LegendComponent, TooltipComponent, MarkLineComponent, SVGRenderer]);
export function MissionElevationChart({ sites, target, timestamp }: { sites: AnalyzedSite[]; target: "sun" | "earth"; timestamp: string | null }) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<ReturnType<typeof init> | null>(null);
  useEffect(() => {
    const element = container.current; if (!element) return;
    const tokens = getComputedStyle(element), color = tokens.getPropertyValue(target === "sun" ? "--sun" : "--earth").trim();
    const chart = init(element, undefined, { renderer: "svg" });
    instance.current = chart;
    const values = sites.flatMap(site => site.analysis[target].status === "ready" ? site.analysis[target].samples.flatMap(sample => sample.elevationDeg === null ? [] : [sample.elevationDeg]) : []);
    const minimum = Math.max(-90, Math.min(-1, ...values) - 1), maximum = Math.min(90, Math.max(1, ...values) + 1);
    chart.setOption({ animation: false, useUTC: true, textStyle: { fontFamily: "DM Sans", color: tokens.getPropertyValue("--content-muted").trim() },
      grid: { left: 48, right: 18, top: 35, bottom: 28 },
      legend: { top: 0, textStyle: { color: tokens.getPropertyValue("--content-muted").trim(), fontSize: 11 } },
      tooltip: { trigger: "axis", backgroundColor: tokens.getPropertyValue("--surface-raised").trim(), borderColor: tokens.getPropertyValue("--border").trim(), textStyle: { color: tokens.getPropertyValue("--content").trim() },
        valueFormatter: (value: unknown) => typeof value === "number" ? `${value.toFixed(2)}°` : "Unavailable" },
      xAxis: { type: "time", axisLabel: { color: tokens.getPropertyValue("--content-muted").trim(), fontSize: 10,
        formatter: (value: number) => new Date(value).toISOString().slice(5, 16).replace("T", " ") }, axisLine: { lineStyle: { color: tokens.getPropertyValue("--border").trim() } } },
      yAxis: { type: "value", min: minimum, max: maximum, name: "°", nameGap: 8, axisLabel: { color: tokens.getPropertyValue("--content-muted").trim(), fontSize: 10 }, splitLine: { lineStyle: { color: tokens.getPropertyValue("--border").trim() } } },
      series: sites.filter(site => site.analysis[target].status === "ready").flatMap((site, index) => { const result = site.analysis[target]; if (result.status !== "ready") return [];
        return [{ id: `${site.location.latitude}/${site.location.longitude}`, type: "line", name: site.location.name ?? formatMapCoordinates(site.location), showSymbol: false, symbol: ["circle", "triangle", "diamond"][index], connectNulls: false,
          data: result.samples.map(sample => [Date.parse(sample.timestamp), sample.elevationDeg]),
          lineStyle: { color, width: 2, type: ["solid", "dashed", "dotted"][index] }, itemStyle: { color },
          markLine: index === 0 ? { silent: true, symbol: "none", label: { show: false }, lineStyle: { color: tokens.getPropertyValue("--content-subtle").trim(), type: "dashed", width: 1 },
            data: [{ yAxis: 0 }] } : undefined }]; }),
    });
    const resize = new ResizeObserver(() => chart.resize()); resize.observe(element);
    return () => { resize.disconnect(); chart.dispose(); if (instance.current === chart) instance.current = null; };
  }, [sites, target]);
  useEffect(() => {
    const first = sites.find(site => site.analysis[target].status === "ready");
    if (first) instance.current?.setOption({ series: [{ id: `${first.location.latitude}/${first.location.longitude}`,
      markLine: { data: [{ yAxis: 0 }, ...(timestamp ? [{ xAxis: Date.parse(timestamp) }] : [])] } }] });
  }, [sites, target, timestamp]);
  return <div ref={container} className="mission-elevation-chart" aria-hidden="true" />;
}
