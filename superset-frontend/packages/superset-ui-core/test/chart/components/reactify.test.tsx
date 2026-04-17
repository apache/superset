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
import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { reactify } from '@superset-ui/core';
import { render, screen, waitFor } from '@testing-library/react';
import { RenderFuncType } from '../../../src/chart/components/reactify';

describe('reactify(renderFn)', () => {
  const renderFn: RenderFuncType<{ content?: string }> = jest.fn(
    (element, props) => {
      const container = element;
      container.innerHTML = '';
      const child = document.createElement('b');
      child.innerHTML = props.content ?? '';
      container.append(child);
    },
  );

  renderFn.displayName = 'BoldText';

  renderFn.propTypes = {
    content: PropTypes.string,
  };

  renderFn.defaultProps = {
    content: 'ghi',
  };

  const willUnmountCb = jest.fn();

  const TheChart = reactify(renderFn);
  const TheChartWithWillUnmountHook = reactify(renderFn, {
    componentWillUnmount: willUnmountCb,
  });

  function TestComponent() {
    const [content, setContent] = useState('abc');

    useEffect(() => {
      const timer = setTimeout(() => {
        setContent('def');
      }, 10);
      return () => clearTimeout(timer);
    }, []);

    return <TheChart id="test" content={content} />;
  }

  function AnotherTestComponent() {
    return <TheChartWithWillUnmountHook id="another_test" />;
  }

  test('returns a React component and re-renders on prop changes', async () => {
    render(<TestComponent />);

    expect(renderFn).toHaveBeenCalledTimes(1);
    expect(screen.getByText('abc')).toBeInTheDocument();
    expect(screen.getByText('abc').parentNode).toHaveAttribute('id', 'test');

    await waitFor(() => {
      expect(screen.getByText('def')).toBeInTheDocument();
    });
    expect(screen.getByText('def').parentNode).toHaveAttribute('id', 'test');
    expect(renderFn).toHaveBeenCalledTimes(2);
  });
  describe('displayName', () => {
    test('has displayName if renderFn.displayName is defined', () => {
      expect(TheChart.displayName).toEqual('BoldText');
    });
    test('does not have displayName if renderFn.displayName is not defined', () => {
      const AnotherChart = reactify(() => {});
      expect(AnotherChart.displayName).toBeUndefined();
    });
  });
  describe('propTypes', () => {
    test('has propTypes if renderFn.propTypes is defined', () => {
      /* eslint-disable-next-line react/forbid-foreign-prop-types */
      expect(Object.keys(TheChart.propTypes ?? {})).toEqual(['content']);
    });
    test('does not have propTypes if renderFn.propTypes is not defined', () => {
      const AnotherChart = reactify(() => {});
      /* eslint-disable-next-line react/forbid-foreign-prop-types */
      expect(Object.keys(AnotherChart.propTypes ?? {})).toEqual([]);
    });
  });
  describe('defaultProps', () => {
    test('has defaultProps if renderFn.defaultProps is defined', () => {
      expect(TheChart.defaultProps).toBe(renderFn.defaultProps);
      render(<TheChart id="test" />);
      expect(screen.getByText('ghi')).toBeInTheDocument();
      expect(screen.getByText('ghi').parentNode).toHaveAttribute('id', 'test');
    });
    test('does not have defaultProps if renderFn.defaultProps is not defined', () => {
      const AnotherChart = reactify(() => {});
      expect(AnotherChart.defaultProps).toBeUndefined();
    });
  });
  test('calls renderFn when container is set', () => {
    const anotherRenderFn = jest.fn();
    const AnotherChart = reactify(anotherRenderFn);
    const { unmount } = render(<AnotherChart id="test" />);
    expect(anotherRenderFn).toHaveBeenCalled();
    unmount();
  });
  test('calls willUnmount hook when it is provided', async () => {
    const { unmount } = render(<AnotherTestComponent />);
    unmount();
    expect(willUnmountCb).toHaveBeenCalledTimes(1);
  });
});
