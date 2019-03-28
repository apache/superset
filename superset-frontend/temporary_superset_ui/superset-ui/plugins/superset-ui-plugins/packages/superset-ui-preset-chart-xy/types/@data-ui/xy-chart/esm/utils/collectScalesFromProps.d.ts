
declare module '@data-ui/xy-chart/esm/utils/collectScalesFromProps' {
  import { ScaleLinear, ScaleBand, ScaleContinuousNumeric, ScaleDiverging, ScaleIdentity, ScaleLogarithmic, ScaleOrdinal, ScalePoint, ScalePower, ScaleQuantile, ScaleQuantize, ScaleSequential, ScaleThreshold, ScaleTime } from "d3-scale";
  import { ReactNode } from "react";
  import { ChartTheme } from "@data-ui/theme";

  interface ScaleConfig {
    [key: string]: any;
  }

  interface Scale {
    domain(): any[];
    ticks(count?: number): number[];
    tickFormat(count?: number, specifier?: string): ((d: number | { valueOf(): number }) => string);
  }

  export default function collectScalesFromProps(props: {
    width: number;
    height: number;
    margin: {
      top: number;
      left: number;
      bottom: number;
      right: number;
    },
    xScale: ScaleConfig,
    yScale: ScaleConfig,
    theme: ChartTheme,
    children: ReactNode[],
  }): {
    xScale: Scale;
    yScale: Scale;
  };
}