declare module '@data-ui/xy-chart' {
  import React from 'react';

  type Props = {
    [key: string]: any;
  };

  interface XYChartProps {
    width: number;
    height: number;
    ariaLabel: string;
    eventTrigger?: any;
    margin?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
    onMouseMove?: (...args: any[]) => void;
    onMouseLeave?: (...args: any[]) => void;
    renderTooltip: any;
    showYGrid?: boolean;
    snapTooltipToDataX?: boolean;
    theme?: any;
    tooltipData?: any;
    xScale: any;
    yScale: any;
  }

  export class AreaSeries extends React.PureComponent<Props, {}> {}
  export class BoxPlotSeries extends React.PureComponent<Props, {}> {}
  export class CrossHair extends React.PureComponent<Props, {}> {}
  export class LinearGradient extends React.PureComponent<Props, {}> {}
  export class LineSeries extends React.PureComponent<Props, {}> {}
  export class PointSeries extends React.PureComponent<Props, {}> {}
  export class WithTooltip extends React.PureComponent<Props, {}> {}
  export class XYChart extends React.PureComponent<XYChartProps, {}> {}
  export class XAxis extends React.PureComponent<Props, {}> {}
  export class YAxis extends React.PureComponent<Props, {}> {}
}
