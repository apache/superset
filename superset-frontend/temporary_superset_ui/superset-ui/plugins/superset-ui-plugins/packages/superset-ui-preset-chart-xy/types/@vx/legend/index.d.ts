/* eslint-disable react/no-multi-comp */
declare module '@vx/legend' {
  import React from 'react';

  export function LegendOrdinal(props: { [key: string]: any }): React.ReactNode;

  export function LegendItem(props: { [key: string]: any }): React.ReactNode;

  export function LegendLabel(props: {
    align: string;
    label?: React.ReactNode;
    flex?: string | number;
    margin?: string | number;
    children?: React.ReactNode;
  }): React.ReactNode;
}
