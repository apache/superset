/*
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

/* eslint-disable max-classes-per-file */
import React from 'react';
import { QueryFormData, ChartMetadata, ChartPlugin } from '@superset-ui/core';

const DIMENSION_STYLE = {
  fontSize: 36,
  fontWeight: 700,
  flex: '1 1 auto',
  display: 'flex',
  alignItems: 'center',
};

export const TestComponent = ({
  formData,
  message,
  width,
  height,
}: {
  formData?: unknown;
  message?: string;
  width?: number;
  height?: number;
}) => (
  <div
    className="test-component"
    style={{
      width,
      height,
      backgroundColor: '#00d1c1',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      borderRadius: 8,
    }}
  >
    <div className="message" style={{ padding: 10 }}>
      {message ?? 'custom component'}
    </div>
    <div className="dimension" style={DIMENSION_STYLE}>
      {[width, height].join('x')}
    </div>
    <div className="formData" style={{ padding: 10 }}>
      <code style={{ color: '#D3F9F7' }}>{JSON.stringify(formData)}</code>
    </div>
  </div>
);

export const ChartKeys = {
  DILIGENT: 'diligent-chart',
  LAZY: 'lazy-chart',
  SLOW: 'slow-chart',
  BUGGY: 'buggy-chart',
};

export class DiligentChartPlugin extends ChartPlugin<QueryFormData> {
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

function identity<T>(x: T) {
  return x;
}

export class LazyChartPlugin extends ChartPlugin<QueryFormData> {
  constructor() {
    super({
      metadata: new ChartMetadata({
        name: ChartKeys.LAZY,
        thumbnail: '',
      }),
      // this mirrors `() => import(module)` syntax
      loadChart: () => Promise.resolve({ default: TestComponent }),
      // promise without .default
      loadTransformProps: () => Promise.resolve(identity),
    });
  }
}

export class SlowChartPlugin extends ChartPlugin<QueryFormData> {
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

export class BuggyChartPlugin extends ChartPlugin<QueryFormData> {
  constructor() {
    super({
      metadata: new ChartMetadata({
        name: ChartKeys.BUGGY,
        thumbnail: '',
      }),
      Chart: () => {
        throw new Error('The component is too buggy to render.');
      },
      transformProps: x => x,
    });
  }
}
