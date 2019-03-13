declare module '@vx/responsive' {
  import React from 'react';

  // eslint-disable-next-line import/prefer-default-export
  interface ParentSizeProps {
    children: (renderProps: { width: number; height: number }) => React.ReactNode;
  }

  const ParentSize: React.ComponentType<ParentSizeProps>;
}
