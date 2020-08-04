declare module '@vx/responsive' {
  import React from 'react';

  export const ScaleSVG: React.ComponentType<{
    children: React.ReactNode;
    width: number | string;
    height: number | string;
    xOrigin?: number | string;
    yOrigin?: number | string;
    preserveAspectRatio?: string;
    innerRef?: () => void | string;
  }>;

  export interface ParentSizeState {
    width: number;
    height: number;
    top: number;
    left: number;
  }

  export const ParentSize: React.ComponentClass<
    {
      className?: string;
      children: (renderProps: {
        width: number;
        height: number;
        top: number;
        left: number;
        ref: HTMLElement;
        resize: (state: ParentSizeState) => void;
      }) => React.ReactNode;
      debounceTime?: number;
    },
    ParentSizeState
  >;

  export interface WithParentSizeProps {
    parentWidth: number;
    parentHeight: number;
  }

  export function withParentSize<T extends {}>(
    BaseComponent: React.ComponentType<T>,
  ): React.ComponentClass<
    {
      debounceTime?: number;
    } & T,
    {
      parentWidth: number | null;
      parentHeight: number | null;
    }
  >;

  export interface WithScreenSizeProps {
    screeWidth: number;
    screenHeight: number;
  }

  export function withScreenSize<T extends {}>(
    BaseComponent: React.ComponentType<T>,
  ): React.ComponentClass<
    {
      windowResizeDebounceTime?: number;
    } & T,
    {
      screenWidth: number | null;
      screenHeight: number | null;
    }
  >;
}
