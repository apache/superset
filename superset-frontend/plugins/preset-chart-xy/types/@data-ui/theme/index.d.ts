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

declare module '@data-ui/theme' {
  type SvgLabelTextStyle = {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    letterSpacing: number;
    fill: string;
    stroke: string;
    textAnchor?:
      | '-moz-initial'
      | 'inherit'
      | 'initial'
      | 'revert'
      | 'unset'
      | 'end'
      | 'start'
      | 'middle';
    pointerEvents?:
      | '-moz-initial'
      | 'inherit'
      | 'initial'
      | 'revert'
      | 'unset'
      | 'auto'
      | 'none'
      | 'visible'
      | 'all'
      | 'fill'
      | 'stroke'
      | 'painted'
      | 'visibleFill'
      | 'visiblePainted'
      | 'visibleStroke';
  };

  export interface ChartTheme {
    colors: {
      default: string;
      dark: string;
      light: string;
      disabled: string;
      lightDisabled: string;
      text: string;
      black: string;
      darkGray: string;
      lightGray: string;
      grid: string;
      gridDark: string;
      label: string;
      tickLabel: string;
      grays: string[];
      categories: string[];
    };
    labelStyles: SvgLabelTextStyle & {
      color: string;
      lineHeight: string;
      paddingBottom: number;
      paddingTop: number;
    };
    gridStyles: {
      stroke: string;
      strokeWidth: number;
    };
    xAxisStyles: {
      stroke: string;
      strokeWidth: number;
      label: {
        bottom: SvgLabelTextStyle;
        top: SvgLabelTextStyle;
      };
    };
    xTickStyles: {
      stroke: string;
      length: number;
      label: {
        bottom: SvgLabelTextStyle & {
          dy: string;
        };
        top: SvgLabelTextStyle & {
          dy: string;
        };
      };
    };
    yAxisStyles: {
      stroke: string;
      strokeWidth: number;
      label: {
        left: SvgLabelTextStyle;
        right: SvgLabelTextStyle;
      };
    };
    yTickStyles: {
      stroke: string;
      length: number;
      label: {
        left: SvgLabelTextStyle & {
          dx: string;
          dy: string;
        };
        right: SvgLabelTextStyle & {
          dx: string;
          dy: string;
        };
      };
    };
  }

  export const chartTheme: ChartTheme;
}
