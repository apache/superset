import React, { useState, ReactNode } from 'react';
import { styled } from '@superset-ui/core';
import { DecoratorFunction } from '@storybook/addons';
import ResizablePanel, { Size } from './ResizablePanel';

export const SupersetBody = styled.div`
  background: #f5f5f5;
  padding: 16px;
  min-height: 100%;

  .panel {
    margin-bottom: 0;
  }
`;

export default function ResizableChartDemo({
  children,
  panelPadding = 30,
  initialSize = { width: 500, height: 300 },
}: {
  children: (innerSize: Size) => ReactNode;
  panelPadding?: number;
  initialSize?: Size;
}) {
  // size are all inner size
  const [size, setSize] = useState(initialSize);
  return (
    <SupersetBody>
      <ResizablePanel initialSize={initialSize} onResize={(e, data) => setSize(data.size)}>
        {children({ width: size.width - panelPadding, height: size.height - panelPadding })}
      </ResizablePanel>
    </SupersetBody>
  );
}

export const withResizableChartDemo: DecoratorFunction<ReactNode> = (storyFn, context) => {
  const {
    parameters: { initialSize, panelPadding },
  } = context;
  return (
    <ResizableChartDemo initialSize={initialSize as Size | undefined} panelPadding={panelPadding}>
      {innerSize => storyFn({ ...context, ...innerSize })}
    </ResizableChartDemo>
  );
};
