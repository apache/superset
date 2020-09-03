import React from 'react';
import { FallbackPropsWithDimension } from './SuperChart';

export type Props = FallbackPropsWithDimension;

const CONTAINER_STYLE = {
  backgroundColor: '#000',
  color: '#fff',
  overflow: 'auto',
  padding: 32,
};

export default function FallbackComponent({ componentStack, error, height, width }: Props) {
  return (
    <div style={{ ...CONTAINER_STYLE, height, width }}>
      <div>
        <div>
          <b>Oops! An error occured!</b>
        </div>
        <code>{error ? error.toString() : 'Unknown Error'}</code>
      </div>
      {componentStack && (
        <div>
          <b>Stack Trace:</b>
          <code>
            {componentStack.split('\n').map((row: string) => (
              <div key={row}>{row}</div>
            ))}
          </code>
        </div>
      )}
    </div>
  );
}
