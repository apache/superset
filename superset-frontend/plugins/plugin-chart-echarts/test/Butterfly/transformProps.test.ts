/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { ChartProps } from "@superset-ui/core";
import { supersetTheme } from "@apache-superset/core/theme";
import {
  EchartsButterflyChartProps,
  ButterflyTransformedProps,
} from "../../src/Butterfly/types";
import transformProps from "../../src/Butterfly/transformProps";

const extractSeries = (props: ButterflyTransformedProps) => {
  const { echartOptions } = props;
  const { series } = echartOptions as unknown as {
    series: Array<{ data: Array<{ value: number }> }>;
  };
  return series.map((item) => item.data.map((entry) => entry.value));
};

const data = [
  { category: "A", left_sum: 10, right_sum: 25 },
  { category: "B", left_sum: 5, right_sum: 19 },
];

const formData = {
  groupby: ["category"],
  left_metric: "left_sum",
  right_metric: "right_sum",
  left_color: { r: 84, g: 112, b: 198 },
  right_color: { r: 145, g: 204, b: 117 },
  showValue: true,
  showLegend: true,
};

test("transforms chart props into diverging bar series", () => {
  const chartProps = new ChartProps({
    formData,
    width: 800,
    height: 600,
    queriesData: [{ data }],
    theme: supersetTheme,
  });

  const transformedProps = transformProps(
    chartProps as unknown as EchartsButterflyChartProps,
  );

  expect(extractSeries(transformedProps)).toEqual([
    [-10, -5],
    [25, 19],
  ]);
});

test("applies legend, axis bounds, and category label settings", () => {
  const chartProps = new ChartProps({
    formData: {
      ...formData,
      legendOrientation: "left",
      legendSort: "desc",
      truncateXAxis: true,
      xAxisLabelRotation: 45,
      x_axis_title_margin: 60,
      y_axis_title_margin: 80,
    },
    width: 800,
    height: 600,
    queriesData: [{ data }],
    theme: supersetTheme,
  });

  const transformedProps = transformProps(
    chartProps as unknown as EchartsButterflyChartProps,
  );
  const { echartOptions } = transformedProps;
  const { legend, xAxis, yAxis, grid } = echartOptions as {
    legend: { orient: string; data: string[] };
    xAxis: { min: number; max: number; nameGap: number };
    yAxis: { axisLabel: { rotate: number; interval: number }; nameGap: number };
    grid: { left: number; top: number };
  };

  expect(legend.orient).toBe("vertical");
  expect(legend.data).toEqual(["right_sum", "left_sum"]);
  expect(xAxis.min).toBe(0);
  expect(xAxis.max).toBe(100);
  expect(xAxis.nameGap).toBe(60);
  expect(yAxis.axisLabel.rotate).toBe(45);
  expect(yAxis.axisLabel.interval).toBe(0);
  expect(yAxis.nameGap).toBe(80);
  expect(grid.left).toBeGreaterThan(80);
  expect(grid.top).toBeGreaterThan(60);
});
