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

import '@testing-library/jest-dom';
import mockConsole, { RestoreConsole } from 'jest-mock-console';
import { ChartProps } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/ui';
import { render, screen, waitFor } from '@superset-ui/core/spec';
import SuperChartCore from '../../../src/chart/components/SuperChartCore';
import {
  ChartKeys,
  DiligentChartPlugin,
  LazyChartPlugin,
  SlowChartPlugin,
} from './MockChartPlugins';

describe('SuperChartCore', () => {
  const chartProps = new ChartProps();
  const plugins = [
    new DiligentChartPlugin().configure({ key: ChartKeys.DILIGENT }),
    new LazyChartPlugin().configure({ key: ChartKeys.LAZY }),
    new SlowChartPlugin().configure({ key: ChartKeys.SLOW }),
  ];

  let restoreConsole: RestoreConsole;

  beforeAll(() => {
    jest.setTimeout(30000);
    plugins.forEach(p => {
      p.unregister().register();
    });
  });

  afterAll(() => {
    plugins.forEach(p => {
      p.unregister();
    });
  });

  beforeEach(() => {
    restoreConsole = mockConsole();
  });

  afterEach(() => {
    restoreConsole();
  });

  describe('registered charts', () => {
    test('renders registered chart', async () => {
      const { container } = render(
        <SuperChartCore
          chartType={ChartKeys.DILIGENT}
          chartProps={chartProps}
        />,
      );

      await waitFor(() => {
        expect(container.querySelector('.test-component')).toBeInTheDocument();
      });
    });

    test('renders registered chart with lazy loading', async () => {
      const { container } = render(
        <SuperChartCore chartType={ChartKeys.LAZY} />,
      );

      await waitFor(() => {
        expect(container.querySelector('.test-component')).toBeInTheDocument();
      });
    });

    test('does not render if chartType is not set', async () => {
      // @ts-expect-error chartType is required
      const { container } = render(<SuperChartCore />);

      await waitFor(() => {
        const testComponent = container.querySelector('.test-component');
        expect(testComponent).not.toBeInTheDocument();
      });
    });

    test('adds id to container if specified', async () => {
      const { container } = render(
        <SuperChartCore chartType={ChartKeys.DILIGENT} id="the-chart" />,
      );

      await waitFor(() => {
        const element = container.querySelector('#the-chart');
        expect(element).toBeInTheDocument();
        expect(element).toHaveAttribute('id', 'the-chart');
      });
    });

    test('adds class to container if specified', async () => {
      const { container } = render(
        <SuperChartCore chartType={ChartKeys.DILIGENT} className="the-chart" />,
      );

      await waitFor(() => {
        const element = container.querySelector('.the-chart');
        expect(element).toBeInTheDocument();
        expect(element).toHaveClass('the-chart');
      });
    });

    test('uses overrideTransformProps when specified', async () => {
      render(
        <SuperChartCore
          chartType={ChartKeys.DILIGENT}
          overrideTransformProps={() => ({ message: 'hulk' })}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('hulk')).toBeInTheDocument();
      });
    });

    test('uses preTransformProps when specified', async () => {
      const chartPropsWithPayload = new ChartProps({
        queriesData: [{ message: 'hulk' }],
        theme: supersetTheme,
      });

      render(
        <SuperChartCore
          chartType={ChartKeys.DILIGENT}
          preTransformProps={() => chartPropsWithPayload}
          overrideTransformProps={props => props.queriesData[0]}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('hulk')).toBeInTheDocument();
      });
    });

    test('uses postTransformProps when specified', async () => {
      render(
        <SuperChartCore
          chartType={ChartKeys.DILIGENT}
          postTransformProps={() => ({ message: 'hulk' })}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('hulk')).toBeInTheDocument();
      });
    });

    test('renders if chartProps is not specified', async () => {
      const { container } = render(
        <SuperChartCore chartType={ChartKeys.DILIGENT} />,
      );

      await waitFor(() => {
        expect(container.querySelector('.test-component')).toBeInTheDocument();
      });
    });

    test('does not render anything while waiting for Chart code to load', () => {
      const { container } = render(
        <SuperChartCore chartType={ChartKeys.SLOW} />,
      );

      const testComponent = container.querySelector('.test-component');
      expect(testComponent).not.toBeInTheDocument();
    });

    test('eventually renders after Chart is loaded', async () => {
      const { container } = render(
        <SuperChartCore chartType={ChartKeys.SLOW} />,
      );

      await waitFor(
        () => {
          expect(
            container.querySelector('.test-component'),
          ).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });

    test('does not render if chartProps is null', async () => {
      const { container } = render(
        <SuperChartCore chartType={ChartKeys.DILIGENT} chartProps={null} />,
      );

      await waitFor(() => {
        // Should not render any chart content, only the antd App wrapper
        expect(
          container.querySelector('.test-component'),
        ).not.toBeInTheDocument();
        expect(
          container.querySelector('[data-test="chart-container"]'),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('unregistered charts', () => {
    test('renders error message', async () => {
      render(
        <SuperChartCore chartType="4d-pie-chart" chartProps={chartProps} />,
      );

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });

  describe('processChartProps behavior', () => {
    test('passes through chartProps unchanged when no transforms are specified', async () => {
      // When no pre/post transform props are specified, the identity function is used
      // which means chartProps should pass through to the chart unchanged.
      // We verify this by checking that the chart renders correctly without transforms.
      const chartProps2 = new ChartProps({
        queriesData: [{ message: 'identity-test' }],
        theme: supersetTheme,
      });

      render(
        <SuperChartCore
          chartType={ChartKeys.DILIGENT}
          chartProps={chartProps2}
          overrideTransformProps={props => props.queriesData[0]}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('identity-test')).toBeInTheDocument();
      });
    });
  });
});
