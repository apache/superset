import React from 'react';
import { mount } from 'enzyme';
import mockConsole, { RestoreConsole } from 'jest-mock-console';

import { triggerResizeObserver } from 'resize-observer-polyfill';
import ErrorBoundary from 'react-error-boundary';
import { promiseTimeout } from '@superset-ui/core';
import { SuperChart } from '@superset-ui/core/src/chart';
import RealSuperChart, { WrapperProps } from '@superset-ui/core/src/chart/components/SuperChart';
import NoResultsComponent from '@superset-ui/core/src/chart/components/NoResultsComponent';

import { ChartKeys, DiligentChartPlugin, BuggyChartPlugin } from './MockChartPlugins';

const DEFAULT_QUERY_DATA = { data: ['foo', 'bar'] };
const DEFAULT_QUERIES_DATA = [{ data: ['foo', 'bar'] }, { data: ['foo2', 'bar2'] }];

function expectDimension(renderedWrapper: Cheerio, width: number, height: number) {
  expect(renderedWrapper.find('.dimension').text()).toEqual([width, height].join('x'));
}

describe('SuperChart', () => {
  const plugins = [
    new DiligentChartPlugin().configure({ key: ChartKeys.DILIGENT }),
    new BuggyChartPlugin().configure({ key: ChartKeys.BUGGY }),
  ];

  let restoreConsole: RestoreConsole;

  beforeAll(() => {
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
      // eslint-disable-next-line jest/no-standalone-expect
      expect(actualErrors).toBe(expectedErrors);
      expectedErrors = 0;
    });

    it('renders default FallbackComponent', () => {
      expectedErrors = 1;
      jest.spyOn(RealSuperChart.defaultProps, 'FallbackComponent');
      const wrapper = mount(
        <SuperChart
          chartType={ChartKeys.BUGGY}
          queriesData={[DEFAULT_QUERY_DATA]}
          width="200"
          height="200"
        />,
      );
      const renderedWrapper = wrapper.render();

      return promiseTimeout(() => {
        expect(renderedWrapper.find('div.test-component')).toHaveLength(0);
        expect(RealSuperChart.defaultProps.FallbackComponent).toHaveBeenCalledTimes(1);
      }, 100);
    });
    it('renders custom FallbackComponent', () => {
      expectedErrors = 1;
      const CustomFallbackComponent = jest.fn(() => <div>Custom Fallback!</div>);
      const wrapper = mount(
        <SuperChart
          chartType={ChartKeys.BUGGY}
          queriesData={[DEFAULT_QUERY_DATA]}
          width="200"
          height="200"
          FallbackComponent={CustomFallbackComponent}
        />,
      );

      return promiseTimeout(() => {
        expect(wrapper.render().find('div.test-component')).toHaveLength(0);
        expect(CustomFallbackComponent).toHaveBeenCalledTimes(1);
      });
    });
    it('call onErrorBoundary', () => {
      expectedErrors = 1;
      const handleError = jest.fn();
      mount(
        <SuperChart
          chartType={ChartKeys.BUGGY}
          queriesData={[DEFAULT_QUERY_DATA]}
          width="200"
          height="200"
          onErrorBoundary={handleError}
        />,
      );

      return promiseTimeout(() => {
        expect(handleError).toHaveBeenCalledTimes(1);
      });
    });
    it('does not include ErrorBoundary if told so', () => {
      expectedErrors = 1;
      const inactiveErrorHandler = jest.fn();
      const activeErrorHandler = jest.fn();
      mount(
        <ErrorBoundary onError={activeErrorHandler}>
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

      return promiseTimeout(() => {
        expect(activeErrorHandler).toHaveBeenCalledTimes(1);
        expect(inactiveErrorHandler).toHaveBeenCalledTimes(0);
      });
    });
  });

  it('passes the props to renderer correctly', () => {
    const wrapper = mount(
      <SuperChart
        chartType={ChartKeys.DILIGENT}
        queriesData={[DEFAULT_QUERY_DATA]}
        width={101}
        height={118}
        formData={{ abc: 1 }}
      />,
    );

    return promiseTimeout(() => {
      const renderedWrapper = wrapper.render();
      expect(renderedWrapper.find('div.test-component')).toHaveLength(1);
      expectDimension(renderedWrapper, 101, 118);
    });
  });

  it('passes the props with multiple queries to renderer correctly', () => {
    const wrapper = mount(
      <SuperChart
        chartType={ChartKeys.DILIGENT}
        queriesData={DEFAULT_QUERIES_DATA}
        width={101}
        height={118}
        formData={{ abc: 1 }}
      />,
    );

    return promiseTimeout(() => {
      const renderedWrapper = wrapper.render();
      expect(renderedWrapper.find('div.test-component')).toHaveLength(1);
      expectDimension(renderedWrapper, 101, 118);
    });
  });

  it('passes the props with multiple queries and single query to renderer correctly (backward compatibility)', () => {
    const wrapper = mount(
      <SuperChart
        chartType={ChartKeys.DILIGENT}
        queriesData={DEFAULT_QUERIES_DATA}
        width={101}
        height={118}
        formData={{ abc: 1 }}
      />,
    );

    return promiseTimeout(() => {
      const renderedWrapper = wrapper.render();
      expect(renderedWrapper.find('div.test-component')).toHaveLength(1);
      expectDimension(renderedWrapper, 101, 118);
    });
  });

  describe('supports NoResultsComponent', () => {
    it('renders NoResultsComponent when queriesData is missing', () => {
      const wrapper = mount(<SuperChart chartType={ChartKeys.DILIGENT} width="200" height="200" />);

      expect(wrapper.find(NoResultsComponent)).toHaveLength(1);
    });

    it('renders NoResultsComponent when queriesData data is null', () => {
      const wrapper = mount(
        <SuperChart
          chartType={ChartKeys.DILIGENT}
          queriesData={[{ data: null }]}
          width="200"
          height="200"
        />,
      );

      expect(wrapper.find(NoResultsComponent)).toHaveLength(1);
    });
  });

  describe('supports dynamic width and/or height', () => {
    it('works with width and height that are numbers', () => {
      const wrapper = mount(
        <SuperChart
          chartType={ChartKeys.DILIGENT}
          queriesData={[DEFAULT_QUERY_DATA]}
          width={100}
          height={100}
        />,
      );

      return promiseTimeout(() => {
        const renderedWrapper = wrapper.render();
        expect(renderedWrapper.find('div.test-component')).toHaveLength(1);
        expectDimension(renderedWrapper, 100, 100);
      });
    });
    it('works when width and height are percent', () => {
      const wrapper = mount(
        <SuperChart
          chartType={ChartKeys.DILIGENT}
          queriesData={[DEFAULT_QUERY_DATA]}
          debounceTime={1}
          width="100%"
          height="100%"
        />,
      );
      triggerResizeObserver();

      return promiseTimeout(() => {
        const renderedWrapper = wrapper.render();
        expect(renderedWrapper.find('div.test-component')).toHaveLength(1);
        expectDimension(renderedWrapper, 300, 300);
      }, 100);
    });
    it('works when only width is percent', () => {
      const wrapper = mount(
        <SuperChart
          chartType={ChartKeys.DILIGENT}
          queriesData={[DEFAULT_QUERY_DATA]}
          debounceTime={1}
          width="50%"
          height="125"
        />,
      );
      triggerResizeObserver([{ contentRect: { height: 125, width: 150 } }]);

      return promiseTimeout(() => {
        const renderedWrapper = wrapper.render();
        const boundingBox = renderedWrapper.find('div.test-component').parent().parent().parent();
        expect(boundingBox.css('width')).toEqual('50%');
        expect(boundingBox.css('height')).toEqual('125px');
        expect(renderedWrapper.find('div.test-component')).toHaveLength(1);
        expectDimension(renderedWrapper, 150, 125);
      }, 100);
    });
    it('works when only height is percent', () => {
      const wrapper = mount(
        <SuperChart
          chartType={ChartKeys.DILIGENT}
          queriesData={[DEFAULT_QUERY_DATA]}
          debounceTime={1}
          width="50"
          height="25%"
        />,
      );
      triggerResizeObserver([{ contentRect: { height: 75, width: 50 } }]);

      return promiseTimeout(() => {
        const renderedWrapper = wrapper.render();
        const boundingBox = renderedWrapper.find('div.test-component').parent().parent().parent();
        expect(boundingBox.css('width')).toEqual('50px');
        expect(boundingBox.css('height')).toEqual('25%');
        expect(renderedWrapper.find('div.test-component')).toHaveLength(1);
        expectDimension(renderedWrapper, 50, 75);
      }, 100);
    });
    it('works when width and height are not specified', () => {
      const wrapper = mount(
        <SuperChart
          chartType={ChartKeys.DILIGENT}
          queriesData={[DEFAULT_QUERY_DATA]}
          debounceTime={1}
        />,
      );
      triggerResizeObserver();

      return promiseTimeout(() => {
        const renderedWrapper = wrapper.render();
        expect(renderedWrapper.find('div.test-component')).toHaveLength(1);
        expectDimension(renderedWrapper, 300, 400);
      }, 100);
    });
  });

  describe('supports Wrapper', () => {
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

    it('works with width and height that are numbers', () => {
      const wrapper = mount(
        <SuperChart
          chartType={ChartKeys.DILIGENT}
          queriesData={[DEFAULT_QUERY_DATA]}
          width={100}
          height={100}
          Wrapper={MyWrapper}
        />,
      );

      return promiseTimeout(() => {
        const renderedWrapper = wrapper.render();
        expect(renderedWrapper.find('div.wrapper-insert')).toHaveLength(1);
        expect(renderedWrapper.find('div.wrapper-insert').text()).toEqual('100x100');
        expect(renderedWrapper.find('div.test-component')).toHaveLength(1);
        expectDimension(renderedWrapper, 100, 100);
      }, 100);
    });

    it('works when width and height are percent', () => {
      const wrapper = mount(
        <SuperChart
          chartType={ChartKeys.DILIGENT}
          queriesData={[DEFAULT_QUERY_DATA]}
          debounceTime={1}
          width="100%"
          height="100%"
          Wrapper={MyWrapper}
        />,
      );
      triggerResizeObserver();

      return promiseTimeout(() => {
        const renderedWrapper = wrapper.render();
        expect(renderedWrapper.find('div.wrapper-insert')).toHaveLength(1);
        expect(renderedWrapper.find('div.wrapper-insert').text()).toEqual('300x300');
        expect(renderedWrapper.find('div.test-component')).toHaveLength(1);
        expectDimension(renderedWrapper, 300, 300);
      }, 100);
    });
  });
});
