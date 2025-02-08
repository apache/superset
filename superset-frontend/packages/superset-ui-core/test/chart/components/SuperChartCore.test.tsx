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
import { ReactElement } from 'react';
import mockConsole, { RestoreConsole } from 'jest-mock-console';
import { ChartProps, supersetTheme, ThemeProvider } from '@superset-ui/core';
import { render, screen, waitFor } from '@testing-library/react';
import SuperChartCore from '../../../src/chart/components/SuperChartCore';
import {
  ChartKeys,
  DiligentChartPlugin,
  LazyChartPlugin,
  SlowChartPlugin,
} from './MockChartPlugins';

const renderWithTheme = (component: ReactElement) =>
  render(<ThemeProvider theme={supersetTheme}>{component}</ThemeProvider>);

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
    it('renders registered chart', async () => {
      const { container } = renderWithTheme(
        <SuperChartCore
          chartType={ChartKeys.DILIGENT}
          chartProps={chartProps}
        />,
      );

      await waitFor(() => {
        expect(container.querySelector('.test-component')).toBeInTheDocument();
      });
    });

    it('renders registered chart with lazy loading', async () => {
      const { container } = renderWithTheme(
        <SuperChartCore chartType={ChartKeys.LAZY} />,
      );

      await waitFor(() => {
        expect(container.querySelector('.test-component')).toBeInTheDocument();
      });
    });

    it('does not render if chartType is not set', async () => {
      // @ts-ignore chartType is required
      const { container } = renderWithTheme(<SuperChartCore />);

      await waitFor(() => {
        const testComponent = container.querySelector('.test-component');
        expect(testComponent).not.toBeInTheDocument();
      });
    });

    it('adds id to container if specified', async () => {
      const { container } = renderWithTheme(
        <SuperChartCore chartType={ChartKeys.DILIGENT} id="the-chart" />,
      );

      await waitFor(() => {
        const element = container.querySelector('#the-chart');
        expect(element).toBeInTheDocument();
        expect(element).toHaveAttribute('id', 'the-chart');
      });
    });

    it('adds class to container if specified', async () => {
      const { container } = renderWithTheme(
        <SuperChartCore chartType={ChartKeys.DILIGENT} className="the-chart" />,
      );

      await waitFor(() => {
        const element = container.querySelector('.the-chart');
        expect(element).toBeInTheDocument();
        expect(element).toHaveClass('the-chart');
      });
    });

    it('uses overrideTransformProps when specified', async () => {
      renderWithTheme(
        <SuperChartCore
          chartType={ChartKeys.DILIGENT}
          overrideTransformProps={() => ({ message: 'hulk' })}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('hulk')).toBeInTheDocument();
      });
    });

    it('uses preTransformProps when specified', async () => {
      const chartPropsWithPayload = new ChartProps({
        queriesData: [{ message: 'hulk' }],
        theme: supersetTheme,
      });

      renderWithTheme(
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

    it('uses postTransformProps when specified', async () => {
      renderWithTheme(
        <SuperChartCore
          chartType={ChartKeys.DILIGENT}
          postTransformProps={() => ({ message: 'hulk' })}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('hulk')).toBeInTheDocument();
      });
    });

    it('renders if chartProps is not specified', async () => {
      const { container } = renderWithTheme(
        <SuperChartCore chartType={ChartKeys.DILIGENT} />,
      );

      await waitFor(() => {
        expect(container.querySelector('.test-component')).toBeInTheDocument();
      });
    });

    it('does not render anything while waiting for Chart code to load', () => {
      const { container } = renderWithTheme(
        <SuperChartCore chartType={ChartKeys.SLOW} />,
      );

      const testComponent = container.querySelector('.test-component');
      expect(testComponent).not.toBeInTheDocument();
    });

    it('eventually renders after Chart is loaded', async () => {
      const { container } = renderWithTheme(
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

    it('does not render if chartProps is null', async () => {
      const { container } = renderWithTheme(
        <SuperChartCore chartType={ChartKeys.DILIGENT} chartProps={null} />,
      );

      await waitFor(() => {
        expect(container).toBeEmptyDOMElement();
      });
    });
  });

  describe('unregistered charts', () => {
    it('renders error message', async () => {
      renderWithTheme(
        <SuperChartCore chartType="4d-pie-chart" chartProps={chartProps} />,
      );

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });

  describe('.processChartProps()', () => {
    it('use identity functions for unspecified transforms', () => {
      const chart = new SuperChartCore({
        chartType: ChartKeys.DILIGENT,
      });
      const chartProps2 = new ChartProps();
      expect(chart.processChartProps({ chartProps: chartProps2 })).toBe(
        chartProps2,
      );
    });
  });
});
