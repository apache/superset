declare module '@vx/responsive' {
  import React from 'react';

  interface ParentSizeProps {
    children: (renderProps: { width: number; height: number }) => React.ReactNode;
  }

  // eslint-disable-next-line import/prefer-default-export
  export const ParentSize: React.ComponentType<ParentSizeProps>;
}
