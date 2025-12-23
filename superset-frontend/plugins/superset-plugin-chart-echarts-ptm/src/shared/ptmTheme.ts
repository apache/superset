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


export const PTM_PRIMARY = {
  100: '#2C9FE5',
  200: '#2693E8',
  300: '#2B7ADC',
  400: '#2568B0',
  500: '#2089D3',
  600: '#2075AC',
} as const;

export const PTM_SECONDARY = {
  100: '#71B6D7',
  200: '#51D7BF',
  300: '#41C2D0',
  400: '#42ACD4',
  500: '#3778BE',
  600: '#0D6C64',
} as const;

export const PTM_TERTIARY = {
  100: '#ADCCB6',
  200: '#5AD7A5',
  300: '#5DB9E2',
  400: '#33A7B5',
  500: '#258B3A',
  600: '#184B31',
} as const;

export const PTM_SUCCESS = {
  100: '#D5F5E3',
  200: '#8CF4B7',
  300: '#52D182',
  400: '#1B8B46',
  500: '#0A8B16',
} as const;

export const PTM_ERROR = {
  100: '#F8E7E7',
  200: '#F4A9B5',
  300: '#EC4B60',
  400: '#C23043',
} as const;

export const PTM_ATTENTION = {
  100: '#FFF4D7',
  200: '#F4D770',
  300: '#D4C670',
  400: '#A08E50',
} as const;

export const PTM_NEUTRAL = {
  white: '#FFFFFF',
  100: '#F7F7F6',
  200: '#F1F1F1',
  300: '#CACACA',
  400: '#979797',
  500: '#666666',
  600: '#222222',
  black: '#000000',
} as const;


export const PTM_COLOR_PALETTES = {
  blue: {
    name: 'Azul (Padrão)',
    colors: ['#2C9FE5', '#2B7ADC', '#71B6D7', '#42ACD4', '#2089D3', '#2075AC'],
    gradient: { start: '#2C9FE5', end: '#2B7ADC' },
  },
  
  green: {
    name: 'Verde (Crescimento)',
    colors: ['#5AD7A5', '#258B3A', '#52D182', '#1B8B46', '#ADCCB6', '#0A8B16'],
    gradient: { start: '#5AD7A5', end: '#258B3A' },
  },
  
  red: {
    name: 'Vermelho (Alerta)',
    colors: ['#EC4B60', '#C23043', '#F4A9B5', '#D44D5C', '#F8E7E7', '#B82E3F'],
    gradient: { start: '#EC4B60', end: '#C23043' },
  },
  
  teal: {
    name: 'Teal (Alternativo)',
    colors: ['#33A7B5', '#41C2D0', '#51D7BF', '#3778BE', '#42ACD4', '#0D6C64'],
    gradient: { start: '#33A7B5', end: '#0D6C64' },
  },
  
  yellow: {
    name: 'Amarelo (Atenção)',
    colors: ['#F5C451', '#F4D770', '#D4C670', '#A08E50', '#FFF4D7', '#E8B84A'],
    gradient: { start: '#F5C451', end: '#A08E50' },
  },
  
  mixed: {
    name: 'Multicolorido',
    colors: [
      '#2C9FE5', // Blue
      '#5AD7A5', // Green
      '#EC4B60', // Red
      '#F5C451', // Yellow
      '#33A7B5', // Teal
      '#2B7ADC', // Dark Blue
      '#52D182', // Light Green
      '#F4A9B5', // Light Red
    ],
    gradient: { start: '#2C9FE5', end: '#33A7B5' },
  },
} as const;

export type PtmColorPalette = keyof typeof PTM_COLOR_PALETTES;

export const PTM_CHART_COLORS = PTM_COLOR_PALETTES.mixed.colors;

export const PTM_TYPOGRAPHY = {
  fontFamily: {
    title: "'Montserrat', sans-serif",
    body: "'Inter', sans-serif",
  },
  fontSize: {
    title: 32,
    subtitle: 24,
    button: 16,
    body: 16,
    small: 14,
    xsmall: 12,
  },
  fontWeight: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

export const PTM_SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
} as const;

export const PTM_BORDER_RADIUS = {
  checkbox: 4,
  button: 8,
  input: 8,
  card: 16,
  modal: 16,
} as const;

export const PTM_SHADOWS = {
  card: '0 2px 8px rgba(0, 0, 0, 0.06)',
  cardHover: '0 4px 16px rgba(0, 0, 0, 0.1)',
  modal: '0 8px 32px rgba(0, 0, 0, 0.12)',
  dropdown: '0 4px 12px rgba(0, 0, 0, 0.08)',
} as const;

export const PTM_TEXT_COLOR_LIGHT = PTM_NEUTRAL[400];

export const PTM_ECHART_BASE = {
  color: PTM_CHART_COLORS,
  animation: true,
  animationDuration: 500,
  animationEasing: 'cubicOut' as const,
  textStyle: {
    fontFamily: PTM_TYPOGRAPHY.fontFamily.body,
    color: PTM_TEXT_COLOR_LIGHT,
  },
} as const;

export const PTM_ECHART_GRID = {
  containLabel: true,
  left: PTM_SPACING.base,
  right: PTM_SPACING.base,
  top: 40,
  bottom: 40,
} as const;

export const PTM_ECHART_X_AXIS = {
  axisLine: { show: false },
  axisTick: { show: false },
  splitLine: { show: false },
  axisLabel: {
    textStyle: {
      color: PTM_TEXT_COLOR_LIGHT,
    },
  },
} as const;

export const PTM_ECHART_Y_AXIS = {
  axisLine: { show: false },
  axisTick: { show: false },
  splitLine: { show: false },
  axisLabel: {
    textStyle: {
      color: PTM_TEXT_COLOR_LIGHT,
    },
  },
} as const;

export const PTM_ECHART_TOOLTIP = {
  backgroundColor: PTM_NEUTRAL.white,
  borderColor: PTM_NEUTRAL[200],
  borderWidth: 1,
  borderRadius: PTM_BORDER_RADIUS.button,
  textStyle: {
    fontFamily: PTM_TYPOGRAPHY.fontFamily.body,
    fontSize: PTM_TYPOGRAPHY.fontSize.small,
    color: PTM_TEXT_COLOR_LIGHT,
  },
  padding: [PTM_SPACING.sm, PTM_SPACING.md],
} as const;

export const PTM_ECHART_LEGEND = {
  textStyle: {
    fontFamily: PTM_TYPOGRAPHY.fontFamily.body,
    fontSize: PTM_TYPOGRAPHY.fontSize.small,
    color: PTM_TEXT_COLOR_LIGHT,
  },
  icon: 'circle',
  itemWidth: 10,
  itemHeight: 10,
  itemGap: 16,
} as const;


type PtmZoomAxis = 'x' | 'y';
type PtmZoomSize = 'sm' | 'xs';

export const ptmDataZoom = (
  axis: PtmZoomAxis = 'x',
  size: PtmZoomSize = 'sm',
  inset: number = PTM_SPACING.lg,
) => {
  const isX = axis === 'x';

  const thickness = size === 'xs' ? 3 : 4;
  const handle = size === 'xs' ? 8 : 10;

  const sliderBase = {
    type: 'slider' as const,
    showDetail: false,
    showDataShadow: false,
    brushSelect: false,
    moveHandleSize: 0,

    borderColor: 'transparent',
    backgroundColor: 'transparent',
    fillerColor: 'rgba(0,0,0,0.10)',

    handleIcon: 'circle',
      
    handleStyle: {
      color: 'rgba(255,255,255,0.95)',
      borderColor: 'rgba(0,0,0,0.20)',
      borderWidth: 1,
      shadowBlur: 6,
      shadowColor: 'rgba(0,0,0,0.10)',
      shadowOffsetY: 2,
    },
    emphasis: {
      handleStyle: {
        borderColor: 'rgba(0,0,0,0.35)',
        shadowBlur: 8,
        shadowColor: 'rgba(0,0,0,0.14)',
      },
    },

    dataBackground: { lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 } },
    selectedDataBackground: { lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 } },
  };

  if (isX) {
    return {
      slider: {
        ...sliderBase,
        orient: 'horizontal' as const,
        xAxisIndex: 0,
        handleSize: handle,

        left: (PTM_ECHART_GRID.left as number) + inset,
        right: (PTM_ECHART_GRID.right as number) + inset,

        height: thickness,
        bottom: PTM_SPACING.xs,
      },
      inside: {
        type: 'inside' as const,
        xAxisIndex: 0,
        zoomOnMouseWheel: true,
        moveOnMouseWheel: true,
        moveOnMouseMove: true,
      },
    };
  }

  return {
    slider: {
      ...sliderBase,
      orient: 'vertical' as const,
      yAxisIndex: 0,
      handleSize: handle,

      top: PTM_ECHART_GRID.top,
      bottom: PTM_ECHART_GRID.bottom,

      width: thickness,
      right: PTM_SPACING.xs,
    },
    inside: {
      type: 'inside' as const,
      yAxisIndex: 0,
      zoomOnMouseWheel: true,
      moveOnMouseWheel: true,
      moveOnMouseMove: true,
    },
  };
};


export const createAreaGradient = (colorTop: string, colorBottom = 'rgba(255,255,255,0)') => ({
  type: 'linear' as const,
  x: 0,
  y: 0,
  x2: 0,
  y2: 1,
  colorStops: [
    { offset: 0, color: colorTop },
    { offset: 1, color: colorBottom },
  ],
});

export const PTM_AREA_GRADIENTS = {
  primary: createAreaGradient('rgba(44, 159, 229, 0.4)'),
  secondary: createAreaGradient('rgba(51, 167, 181, 0.4)'),
  success: createAreaGradient('rgba(90, 215, 165, 0.4)'),
} as const;

export const PTM_THEME = {
  colors: {
    primary: PTM_PRIMARY,
    secondary: PTM_SECONDARY,
    tertiary: PTM_TERTIARY,
    success: PTM_SUCCESS,
    error: PTM_ERROR,
    attention: PTM_ATTENTION,
    neutral: PTM_NEUTRAL,
    chart: PTM_CHART_COLORS,
  },
  typography: PTM_TYPOGRAPHY,
  spacing: PTM_SPACING,
  borderRadius: PTM_BORDER_RADIUS,
  shadows: PTM_SHADOWS,
  echarts: {
    base: PTM_ECHART_BASE,
    grid: PTM_ECHART_GRID,
    xAxis: PTM_ECHART_X_AXIS,
    yAxis: PTM_ECHART_Y_AXIS,
    tooltip: PTM_ECHART_TOOLTIP,
    legend: PTM_ECHART_LEGEND,
    dataZoom: {
      create: ptmDataZoom,
    },
  },
  gradients: PTM_AREA_GRADIENTS,
} as const;

export default PTM_THEME;
