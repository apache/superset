/* eslint-disable react/no-multi-comp */
declare module '@data-ui/xy-chart' {
  import React from 'react';

  type Props = {
    [key: string]: any;
  };

  interface XYChartProps {
    theme: any;
    width: number;
    height: number;
    margin?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
    ariaLabel: string;
    xScale: any;
    yScale: any;
    renderTooltip: any;
    eventTrigger?: any;
  }

  export class AreaSeries extends React.PureComponent<Props, {}> {}
  export class CrossHair extends React.PureComponent<Props, {}> {}
  export class LinearGradient extends React.PureComponent<Props, {}> {}
  export class LineSeries extends React.PureComponent<Props, {}> {}
  export class WithTooltip extends React.PureComponent<Props, {}> {}
  export class XYChart extends React.PureComponent<XYChartProps, {}> {}
  export class XAxis extends React.PureComponent<Props, {}> {}
  export class YAxis extends React.PureComponent<Props, {}> {}
}
