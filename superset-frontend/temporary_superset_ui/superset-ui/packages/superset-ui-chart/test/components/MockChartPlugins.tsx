import React from 'react';
import { ChartMetadata, ChartPlugin, ChartFormData } from '../../src';

export const TestComponent = ({
  message,
  width,
  height,
}: {
  message: string;
  width: number;
  height: number;
}) => (
  <div className="test-component">
    <span className="message">{message || 'test-message'}</span>
    <span className="dimension">{[width, height].join('x')}</span>
  </div>
);

export const ChartKeys = {
  DILIGENT: 'diligent-chart',
  LAZY: 'lazy-chart',
  SLOW: 'slow-chart',
};

export class DiligentChartPlugin extends ChartPlugin<ChartFormData> {
  constructor() {
    super({
      metadata: new ChartMetadata({
        name: ChartKeys.DILIGENT,
        thumbnail: '',
      }),
      Chart: TestComponent,
      transformProps: x => x,
    });
  }
}

export class LazyChartPlugin extends ChartPlugin<ChartFormData> {
  constructor() {
    super({
      metadata: new ChartMetadata({
        name: ChartKeys.LAZY,
        thumbnail: '',
      }),
      // this mirrors `() => import(module)` syntax
      loadChart: () => Promise.resolve({ default: TestComponent }),
      // promise without .default
      loadTransformProps: () => Promise.resolve((x: any) => x),
    });
  }
}

export class SlowChartPlugin extends ChartPlugin<ChartFormData> {
  constructor() {
    super({
      metadata: new ChartMetadata({
        name: ChartKeys.SLOW,
        thumbnail: '',
      }),
      loadChart: () =>
        new Promise(resolve => {
          setTimeout(() => {
            resolve(TestComponent);
          }, 1000);
        }),
      transformProps: x => x,
    });
  }
}
