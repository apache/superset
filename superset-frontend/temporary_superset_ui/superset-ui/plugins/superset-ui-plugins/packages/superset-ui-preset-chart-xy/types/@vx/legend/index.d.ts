/* eslint-disable react/no-multi-comp */
declare module '@vx/legend' {
  import { ReactNode, ReactElement } from 'react';

  export function LegendOrdinal(props: { [key: string]: any }): ReactElement;

  export function LegendItem(props: { [key: string]: any }): ReactElement;

  export function LegendLabel(props: {
    align: string;
    label?: ReactNode;
    flex?: string | number;
    margin?: string | number;
    children?: ReactNode;
  }): ReactElement;
}
