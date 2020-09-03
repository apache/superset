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
