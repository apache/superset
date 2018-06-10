import React from "react";
import { Group } from "@vx/group";
import { genBins } from "@vx/mock-data";
import { scaleBand, scaleLinear, scaleOrdinal } from "@vx/scale";
import { HeatmapCircle, HeatmapRect } from "@vx/heatmap";
import { extent, min, max } from "d3-array";
import { schemeSet1 } from "d3-scale-chromatic";


const data = genBins(16, 16);

// accessors
const x = d => d.bin;
const y = d => d.bins;
const z = d => d.count;

export default ({
  width = 100,
  height = 100,
  events = false,
  margin = {
    right: 50,
    left: 50,
    top: 50,
    bottom: 50,
  }
}) => {
  if (width < 10) return null;

  // bounds
  const size =
    width > margin.left + margin.right
      ? width - margin.left - margin.right
      : width;
  const xMax = size;
  const yMax = height - margin.bottom;
  const dMin = min(data, d => min(y(d), x));
  const dMax = max(data, d => max(y(d), x));
  const dStep = dMax / data[0].bins.length;
  const bWidth = xMax / data.length;
  const bHeight = yMax / data[0].bins.length;
  const colorMax = max(data, d => max(y(d), z));

  // scales
  const xScale = scaleLinear({
    range: [0, xMax],
    domain: extent(data, x)
  });
  const yScale = scaleLinear({
    range: [yMax, 0],
    domain: [dMin, dMax]
  });
  const colorScale = scaleLinear({
    range: ["#122549", "#b4fbde"],
    domain: [0, colorMax]
  });
  const colorHeatScale = scaleLinear({
    range: ["#06BA63", "#BA274A"],
    domain: [0, colorMax]
  });
  const opacityScale = scaleLinear({
    range: [0.01, 1],
    domain: [0, colorMax]
  });

  const colorScale3 = scaleLinear({
    range: ["FB3640", "F5D547", "70EE9C"],
    domain: [-1, 0, colorMax]
  });

  const colorScale2 = scaleOrdinal({
    domain: [0, colorMax],
    range: schemeSet1
  });

  return (
    <svg width={width} height={height}>
      <Group top={margin.top} left={xMax + margin.left}>
        <HeatmapRect
          data={data}
          xScale={xScale}
          yScale={yScale}
          colorScale={colorScale}
          opacityScale={opacityScale}
          binWidth={bWidth}
          binHeight={bWidth}
          step={dStep}
          gap={25}
          onClick={data => event => {
            if (!event) return;
            console.log(`clicked: ${JSON.stringify(data.bin)}`);
          }}
        />
      </Group>
    </svg>
  );
};
