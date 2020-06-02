import React, { PropsWithChildren, ReactNode } from 'react';
import { ResizableBox, ResizableBoxProps, ResizeCallbackData } from 'react-resizable';

import 'react-resizable/css/styles.css';

export type Size = ResizeCallbackData['size'];

export default function ResizablePanel({
  children,
  heading = undefined,
  initialSize = { width: 500, height: 300 },
  minConstraints = [100, 100] as [number, number],
  onResize,
  ...props
}: PropsWithChildren<Omit<ResizableBoxProps, 'width' | 'height'>> & {
  heading?: ReactNode;
  initialSize?: Size;
}) {
  const { width, height } = initialSize;
  return (
    <ResizableBox
      className="panel"
      width={width}
      height={height}
      minConstraints={minConstraints}
      onResize={
        onResize
          ? (e, data) => {
              const { size } = data;
              onResize(e, { ...data, size });
            }
          : undefined
      }
      {...props}
    >
      {heading ? <div className="panel-heading">{heading}</div> : null}
      <div className="panel-body">{children}</div>
    </ResizableBox>
  );
}
