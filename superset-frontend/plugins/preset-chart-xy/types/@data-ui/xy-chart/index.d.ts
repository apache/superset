/*
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
