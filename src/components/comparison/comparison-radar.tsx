/**
 * Render synthetic percentage profiles with the modular ECharts SVG radar renderer.
 * Incomplete profiles never become closed polygons or substitute missing values with zero.
 * @author Sultan
 */
"use client";

import { useEffect, useRef } from "react";
import { init, use as registerCharts } from "echarts/core";
import { RadarChart } from "echarts/charts";
import { RadarComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { previewAxes, type PreviewProfile } from "@/components/comparison/preview-data";

registerCharts([RadarChart, RadarComponent, SVGRenderer]);

export function ComparisonRadar({ profiles }: { profiles: readonly PreviewProfile[] }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const tokens = getComputedStyle(element);
    const data = profiles.flatMap(profile => {
      const values: number[] = [];
      for (const axis of previewAxes) {
        const value = profile.values[axis.id];
        if (value.state === "unavailable") return [];
        values.push(value.percent);
      }
      const color = tokens.getPropertyValue(profile.colorToken).trim();
      return [{ name: profile.label, value: values, symbol: profile.id === "a" ? "circle" : "diamond",
        symbolSize: 6, lineStyle: { color, width: 2, type: profile.line },
        itemStyle: { color }, areaStyle: { color, opacity: 0.12 } }];
    });
    const chart = init(element, undefined, { renderer: "svg" });
    chart.setOption({
      animation: false,
      radar: {
        shape: "circle", radius: element.clientWidth < 400 ? "54%" : "74%", center: ["50%", "51%"], splitNumber: 4,
        indicator: previewAxes.map(axis => ({ name: axis.chartLabel, min: 0, max: 100 })),
        axisName: { color: tokens.getPropertyValue("--content-muted").trim(), fontFamily: "DM Sans", fontSize: 12, lineHeight: 17 },
        axisNameGap: 12, splitArea: { show: false },
        splitLine: { lineStyle: { color: tokens.getPropertyValue("--border").trim() } },
        axisLine: { lineStyle: { color: tokens.getPropertyValue("--border").trim() } },
      },
      series: [{ type: "radar", data, emphasis: { disabled: true } }],
    });
    const resize = new ResizeObserver(() => {
      chart.resize();
      chart.setOption({ radar: { radius: element.clientWidth < 400 ? "54%" : "74%" } });
    });
    resize.observe(element);
    return () => { resize.disconnect(); chart.dispose(); };
  }, [profiles]);

  return <div ref={container} className="comparison-radar" aria-hidden="true" />;
}
