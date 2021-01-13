import React from 'react';
import { shallow } from 'enzyme';
import mockConsole, { RestoreConsole } from 'jest-mock-console';
import createLoadableRenderer, {
  LoadableRenderer as LoadableRendererType,
} from '@superset-ui/core/src/chart/components/createLoadableRenderer';

describe('createLoadableRenderer', () => {
  function TestComponent() {
    return <div className="test-component">test</div>;
  }
  let loadChartSuccess = jest.fn(() => Promise.resolve(TestComponent));
  let render: (loaded: { Chart: React.ComponentType }) => JSX.Element;
  let loading: () => JSX.Element;
  let LoadableRenderer: LoadableRendererType<{}, {}>;
  let restoreConsole: RestoreConsole;

  beforeEach(() => {
    restoreConsole = mockConsole();
    loadChartSuccess = jest.fn(() => Promise.resolve(TestComponent));
    render = jest.fn(loaded => {
      const { Chart } = loaded;

      return <Chart />;
    });
    loading = jest.fn(() => <div>Loading</div>);

    LoadableRenderer = createLoadableRenderer({
      loader: {
        Chart: loadChartSuccess,
      },
      loading,
      render,
    });
  });

  afterEach(() => {
    restoreConsole();
  });

  describe('returns a LoadableRenderer class', () => {
    it('LoadableRenderer.preload() preloads the lazy-load components', () => {
      expect(LoadableRenderer.preload).toBeInstanceOf(Function);
      LoadableRenderer.preload();
      expect(loadChartSuccess).toHaveBeenCalledTimes(1);
    });

    it('calls onRenderSuccess when succeeds', async () => {
      const onRenderSuccess = jest.fn();
      const onRenderFailure = jest.fn();
      shallow(
        <LoadableRenderer onRenderSuccess={onRenderSuccess} onRenderFailure={onRenderFailure} />,
      );
      expect(loadChartSuccess).toHaveBeenCalled();
      jest.useRealTimers();
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(render).toHaveBeenCalledTimes(1);
      expect(onRenderSuccess).toHaveBeenCalledTimes(1);
      expect(onRenderFailure).not.toHaveBeenCalled();
    });

    it('calls onRenderFailure when fails', () =>
      new Promise(done => {
        const loadChartFailure = jest.fn(() => Promise.reject(new Error('Invalid chart')));
        const FailedRenderer = createLoadableRenderer({
          loader: {
            Chart: loadChartFailure,
          },
          loading,
          render,
        });
        const onRenderSuccess = jest.fn();
        const onRenderFailure = jest.fn();
        shallow(
          <FailedRenderer onRenderSuccess={onRenderSuccess} onRenderFailure={onRenderFailure} />,
        );
        expect(loadChartFailure).toHaveBeenCalledTimes(1);
        setTimeout(() => {
          expect(render).not.toHaveBeenCalled();
          expect(onRenderSuccess).not.toHaveBeenCalled();
          expect(onRenderFailure).toHaveBeenCalledTimes(1);
          done();
        }, 10);
      }));

    it('onRenderFailure is optional', () =>
      new Promise(done => {
        const loadChartFailure = jest.fn(() => Promise.reject(new Error('Invalid chart')));
        const FailedRenderer = createLoadableRenderer({
          loader: {
            Chart: loadChartFailure,
          },
          loading,
          render,
        });
        shallow(<FailedRenderer />);
        expect(loadChartFailure).toHaveBeenCalledTimes(1);
        setTimeout(() => {
          expect(render).not.toHaveBeenCalled();
          done();
        }, 10);
      }));

    it('renders the lazy-load components', () =>
      new Promise(done => {
        const wrapper = shallow(<LoadableRenderer />);
        // lazy-loaded component not rendered immediately
        expect(wrapper.find(TestComponent)).toHaveLength(0);
        setTimeout(() => {
          // but rendered after the component is loaded.
          expect(wrapper.find(TestComponent)).toHaveLength(1);
          done();
        }, 10);
      }));

    it('does not throw if loaders are empty', () => {
      const NeverLoadingRenderer = createLoadableRenderer({
        loader: {},
        loading,
        render: () => <div />,
      });

      expect(() => shallow(<NeverLoadingRenderer />)).not.toThrow();
    });
  });
});
