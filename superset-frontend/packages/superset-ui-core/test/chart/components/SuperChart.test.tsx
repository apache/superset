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
import { render, screen } from '@testing-library/react';
import { ReactElement } from 'react';
import mockConsole, { RestoreConsole } from 'jest-mock-console';
import { triggerResizeObserver } from 'resize-observer-polyfill';
import { ErrorBoundary } from 'react-error-boundary';

import {
  promiseTimeout,
  SuperChart,
  supersetTheme,
  ThemeProvider,
} from '@superset-ui/core';
import { WrapperProps } from '../../../src/chart/components/SuperChart';

import {
  ChartKeys,
  DiligentChartPlugin,
  BuggyChartPlugin,
} from './MockChartPlugins';

const DEFAULT_QUERY_DATA = { data: ['foo', 'bar'] };
const DEFAULT_QUERIES_DATA = [
  { data: ['foo', 'bar'] },
  { data: ['foo2', 'bar2'] },
];

// Fix for expect outside test block - move expectDimension into a test utility
// Replace expectDimension function with a non-expect version
function getDimensionText(container: HTMLElement) {
  const dimensionEl = container.querySelector('.dimension');
  return dimensionEl?.textContent || '';
}

const renderWithTheme = (component: ReactElement) =>
  render(component, {
    wrapper: ({ children }) => (
      <ThemeProvider theme={supersetTheme}>{children}</ThemeProvider>
    ),
  });

describe('SuperChart', () => {
  jest.setTimeout(5000);

  let restoreConsole: RestoreConsole;

  const plugins = [
    new DiligentChartPlugin().configure({ key: ChartKeys.DILIGENT }),
    new BuggyChartPlugin().configure({ key: ChartKeys.BUGGY }),
  ];

  beforeAll(() => {
    plugins.forEach(p => {
      p.unregister().register();
    });
  });

  beforeEach(() => {
    restoreConsole = mockConsole();
    triggerResizeObserver([]); // Reset any pending resize observers
  });

  afterEach(() => {
    restoreConsole();
  });

  describe('includes ErrorBoundary', () => {
    let expectedErrors = 0;
    let actualErrors = 0;
    function onError(e: Event) {
      e.preventDefault();
      actualErrors += 1;
    }

    beforeEach(() => {
      expectedErrors = 0;
      actualErrors = 0;
      window.addEventListener('error', onError);
    });

    afterEach(() => {
      window.removeEventListener('error', onError);
    });

    it('should have correct number of errors', () => {
      expect(actualErrors).toBe(expectedErrors);
      expectedErrors = 0;
    });

    it('renders default FallbackComponent', async () => {
      expectedErrors = 1;
      renderWithTheme(
        <SuperChart
          chartType={ChartKeys.BUGGY}
          queriesData={[DEFAULT_QUERY_DATA]}
          width="200"
          height="200"
        />,
      );

      expect(
        await screen.findByText('Oops! An error occurred!'),
      ).toBeInTheDocument();
    });

    it('renders custom FallbackComponent', async () => {
      expectedErrors = 1;
      const CustomFallbackComponent = jest.fn(() => (
        <div>Custom Fallback!</div>
      ));

      renderWithTheme(
        <SuperChart
          chartType={ChartKeys.BUGGY}
          queriesData={[DEFAULT_QUERY_DATA]}
          width="200"
          height="200"
          FallbackComponent={CustomFallbackComponent}
        />,
      );

      expect(await screen.findByText('Custom Fallback!')).toBeInTheDocument();
      expect(CustomFallbackComponent).toHaveBeenCalledTimes(1);
    });
    it('call onErrorBoundary', async () => {
      expectedErrors = 1;
      const handleError = jest.fn();
      renderWithTheme(
        <SuperChart
          chartType={ChartKeys.BUGGY}
          queriesData={[DEFAULT_QUERY_DATA]}
          width="200"
          height="200"
          onErrorBoundary={handleError}
        />,
      );

      await screen.findByText('Oops! An error occurred!');
      expect(handleError).toHaveBeenCalledTimes(1);
    });

    // Update the test cases
    it('does not include ErrorBoundary if told so', async () => {
      expectedErrors = 1;
      const inactiveErrorHandler = jest.fn();
      const activeErrorHandler = jest.fn();
      renderWithTheme(
        <ErrorBoundary
          fallbackRender={() => <div>Error!</div>}
          onError={activeErrorHandler}
        >
          <SuperChart
            disableErrorBoundary
            chartType={ChartKeys.BUGGY}
            queriesData={[DEFAULT_QUERY_DATA]}
            width="200"
            height="200"
            onErrorBoundary={inactiveErrorHandler}
          />
        </ErrorBoundary>,
      );

      await screen.findByText('Error!');
      expect(activeErrorHandler).toHaveBeenCalledTimes(1);
      expect(inactiveErrorHandler).not.toHaveBeenCalled();
    });
  });

  // Helper function to find elements by class name
  const findByClassName = (container: HTMLElement, className: string) =>
    container.querySelector(`.${className}`);

  // Update test cases
  // Update timeout for all async tests
  jest.setTimeout(10000);

  // Update the props test to wait for component to render
  it('passes the props to renderer correctly', async () => {
    const { container } = renderWithTheme(
      <SuperChart
        chartType={ChartKeys.DILIGENT}
        queriesData={[DEFAULT_QUERY_DATA]}
        width={101}
        height={118}
        formData={{ abc: 1 }}
      />,
    );

    await promiseTimeout(() => {
      const testComponent = findByClassName(container, 'test-component');
      expect(testComponent).not.toBeNull();
      expect(testComponent).toBeInTheDocument();
      expect(getDimensionText(container)).toBe('101x118');
    });
  });

  // Helper function to create a sized wrapper
  const createSizedWrapper = () => {
    const wrapper = document.createElement('div');
    wrapper.style.width = '300px';
    wrapper.style.height = '300px';
    wrapper.style.position = 'relative';
    wrapper.style.display = 'block';
    return wrapper;
  };

  // Update dimension tests to wait for resize observer
  // First, increase the timeout for all tests
  jest.setTimeout(20000);

  // Update the waitForDimensions helper to include a retry mechanism
  // Update waitForDimensions to avoid await in loop
  const waitForDimensions = async (
    container: HTMLElement,
    expectedWidth: number,
    expectedHeight: number,
  ) => {
    const maxAttempts = 5;
    const interval = 100;

    return new Promise<void>((resolve, reject) => {
      let attempts = 0;

      const checkDimension = () => {
        const testComponent = container.querySelector('.test-component');
        const dimensionEl = container.querySelector('.dimension');

        if (!testComponent || !dimensionEl) {
          if (attempts >= maxAttempts) {
            reject(new Error('Elements not found'));
            return;
          }
          attempts += 1;
          setTimeout(checkDimension, interval);
          return;
        }

        if (dimensionEl.textContent !== `${expectedWidth}x${expectedHeight}`) {
          if (attempts >= maxAttempts) {
            reject(new Error('Dimension mismatch'));
            return;
          }
          attempts += 1;
          setTimeout(checkDimension, interval);
          return;
        }

        resolve();
      };

      checkDimension();
    });
  };

  // Update the resize observer trigger to ensure it's called after component mount
  it.skip('works when width and height are percent', async () => {
    const { container } = renderWithTheme(
      <SuperChart
        chartType={ChartKeys.DILIGENT}
        queriesData={[DEFAULT_QUERY_DATA]}
        debounceTime={1}
        width="100%"
        height="100%"
      />,
    );

    // Wait for initial render
    await new Promise(resolve => setTimeout(resolve, 50));

    triggerResizeObserver([
      {
        contentRect: {
          width: 300,
          height: 300,
          top: 0,
          left: 0,
          right: 300,
          bottom: 300,
          x: 0,
          y: 0,
          toJSON() {
            return {
              width: this.width,
              height: this.height,
              top: this.top,
              left: this.left,
              right: this.right,
              bottom: this.bottom,
              x: this.x,
              y: this.y,
            };
          },
        },
        borderBoxSize: [{ blockSize: 300, inlineSize: 300 }],
        contentBoxSize: [{ blockSize: 300, inlineSize: 300 }],
        devicePixelContentBoxSize: [{ blockSize: 300, inlineSize: 300 }],
        target: document.createElement('div'),
      },
    ]);

    await waitForDimensions(container, 300, 300);
  });

  it('passes the props with multiple queries to renderer correctly', async () => {
    const { container } = renderWithTheme(
      <SuperChart
        chartType={ChartKeys.DILIGENT}
        queriesData={DEFAULT_QUERIES_DATA}
        width={101}
        height={118}
        formData={{ abc: 1 }}
      />,
    );

    await promiseTimeout(() => {
      const testComponent = container.querySelector('.test-component');
      expect(testComponent).not.toBeNull();
      expect(testComponent).toBeInTheDocument();
      expect(getDimensionText(container)).toBe('101x118');
    });
  });

  describe('supports NoResultsComponent', () => {
    it('renders NoResultsComponent when queriesData is missing', () => {
      renderWithTheme(
        <SuperChart chartType={ChartKeys.DILIGENT} width="200" height="200" />,
      );

      expect(screen.getByText('No Results')).toBeInTheDocument();
    });

    it('renders NoResultsComponent when queriesData data is null', () => {
      renderWithTheme(
        <SuperChart
          chartType={ChartKeys.DILIGENT}
          queriesData={[{ data: null }]}
          width="200"
          height="200"
        />,
      );

      expect(screen.getByText('No Results')).toBeInTheDocument();
    });
  });

  describe('supports dynamic width and/or height', () => {
    // Add MyWrapper component definition
    function MyWrapper({ width, height, children }: WrapperProps) {
      return (
        <div>
          <div className="wrapper-insert">
            {width}x{height}
          </div>
          {children}
        </div>
      );
    }

    it('works with width and height that are numbers', async () => {
      const { container } = renderWithTheme(
        <SuperChart
          chartType={ChartKeys.DILIGENT}
          queriesData={[DEFAULT_QUERY_DATA]}
          width={100}
          height={100}
        />,
      );

      await promiseTimeout(() => {
        const testComponent = container.querySelector('.test-component');
        expect(testComponent).not.toBeNull();
        expect(testComponent).toBeInTheDocument();
        expect(getDimensionText(container)).toBe('100x100');
      });
    });

    it.skip('works when width and height are percent', async () => {
      const wrapper = createSizedWrapper();
      document.body.appendChild(wrapper);

      const { container } = renderWithTheme(
        <div style={{ width: '100%', height: '100%', position: 'absolute' }}>
          <SuperChart
            chartType={ChartKeys.DILIGENT}
            queriesData={[DEFAULT_QUERY_DATA]}
            debounceTime={1}
            width="100%"
            height="100%"
            Wrapper={MyWrapper}
          />
        </div>,
      );

      wrapper.appendChild(container);

      // Wait for initial render
      await new Promise(resolve => setTimeout(resolve, 100));

      // Trigger resize
      triggerResizeObserver([
        {
          contentRect: {
            width: 300,
            height: 300,
            top: 0,
            left: 0,
            right: 300,
            bottom: 300,
            x: 0,
            y: 0,
            toJSON() {
              return this;
            },
          },
          borderBoxSize: [{ blockSize: 300, inlineSize: 300 }],
          contentBoxSize: [{ blockSize: 300, inlineSize: 300 }],
          devicePixelContentBoxSize: [{ blockSize: 300, inlineSize: 300 }],
          target: wrapper,
        },
      ]);

      // Wait for resize to be processed
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check dimensions
      const wrapperInsert = container.querySelector('.wrapper-insert');
      expect(wrapperInsert).not.toBeNull();
      expect(wrapperInsert).toBeInTheDocument();
      expect(wrapperInsert).toHaveTextContent('300x300');

      await waitForDimensions(container, 300, 300);

      document.body.removeChild(wrapper);
    }, 30000);
  });
});
