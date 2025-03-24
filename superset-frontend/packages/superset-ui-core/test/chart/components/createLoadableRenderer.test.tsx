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
import { ComponentType } from 'react';
import mockConsole, { RestoreConsole } from 'jest-mock-console';
import { render as renderTestComponent, screen } from '@testing-library/react';
import createLoadableRenderer, {
  LoadableRenderer as LoadableRendererType,
} from '../../../src/chart/components/createLoadableRenderer';

describe('createLoadableRenderer', () => {
  function TestComponent() {
    return <div className="test-component">test</div>;
  }
  let loadChartSuccess = jest.fn(() => Promise.resolve(TestComponent));
  let render: (loaded: { Chart: ComponentType }) => JSX.Element;
  let loading: () => JSX.Element;
  let LoadableRenderer: LoadableRendererType<{}>;
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
      renderTestComponent(
        <LoadableRenderer
          onRenderSuccess={onRenderSuccess}
          onRenderFailure={onRenderFailure}
        />,
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
        const loadChartFailure = jest.fn(() =>
          Promise.reject(new Error('Invalid chart')),
        );
        const FailedRenderer = createLoadableRenderer({
          loader: {
            Chart: loadChartFailure,
          },
          loading,
          render,
        });
        const onRenderSuccess = jest.fn();
        const onRenderFailure = jest.fn();
        renderTestComponent(
          <FailedRenderer
            onRenderSuccess={onRenderSuccess}
            onRenderFailure={onRenderFailure}
          />,
        );
        expect(loadChartFailure).toHaveBeenCalledTimes(1);
        setTimeout(() => {
          expect(render).not.toHaveBeenCalled();
          expect(onRenderSuccess).not.toHaveBeenCalled();
          expect(onRenderFailure).toHaveBeenCalledTimes(1);
          done(undefined);
        }, 10);
      }));

    it('onRenderFailure is optional', () =>
      new Promise(done => {
        const loadChartFailure = jest.fn(() =>
          Promise.reject(new Error('Invalid chart')),
        );
        const FailedRenderer = createLoadableRenderer({
          loader: {
            Chart: loadChartFailure,
          },
          loading,
          render,
        });
        renderTestComponent(<FailedRenderer />);
        expect(loadChartFailure).toHaveBeenCalledTimes(1);
        setTimeout(() => {
          expect(render).not.toHaveBeenCalled();
          done(undefined);
        }, 10);
      }));

    it('renders the lazy-load components', () =>
      new Promise(done => {
        renderTestComponent(<LoadableRenderer />);
        // lazy-loaded component not rendered immediately
        expect(screen.queryByText('test')).not.toBeInTheDocument();
        setTimeout(() => {
          // but rendered after the component is loaded.
          expect(screen.queryByText('test')).toBeInTheDocument();
          done(undefined);
        }, 10);
      }));

    it('does not throw if loaders are empty', () => {
      const NeverLoadingRenderer = createLoadableRenderer({
        loader: {},
        loading,
        render: () => <div />,
      });

      expect(() => renderTestComponent(<NeverLoadingRenderer />)).not.toThrow();
    });
  });
});
