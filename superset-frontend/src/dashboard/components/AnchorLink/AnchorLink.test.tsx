/**
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
import { render, act } from 'spec/helpers/testing-library';
import AnchorLink from 'src/dashboard/components/AnchorLink';

describe('AnchorLink', () => {
  const props = {
    id: 'CHART-123',
    dashboardId: 10,
  };

  const globalLocation = window.location;
  afterEach(() => {
    window.location = globalLocation;
  });

  it('should scroll the AnchorLink into view upon mount if id matches hash', async () => {
    jest.useFakeTimers();

    const callback = jest.fn();
    const getElementByIdSpy = jest
      .spyOn(document, 'getElementById')
      .mockReturnValue({
        scrollIntoView: callback,
      } as unknown as HTMLElement);

    window.location.hash = props.id;

    let component1: ReturnType<typeof render>;
    await act(async () => {
      component1 = render(<AnchorLink {...props} />, { useRedux: true });
      await jest.runAllTimersAsync();
    });

    // Wait for any async operations to complete
    await act(async () => {
      await jest.runAllTimersAsync();
    });

    expect(callback).toHaveBeenCalledTimes(1);

    // Clean up first render
    component1!.unmount();
    callback.mockClear();

    window.location.hash = 'random';

    let component2: ReturnType<typeof render>;
    await act(async () => {
      component2 = render(<AnchorLink {...props} />, { useRedux: true });
      await jest.runAllTimersAsync();
    });

    // Wait for any async operations to complete
    await act(async () => {
      await jest.runAllTimersAsync();
    });

    expect(callback).toHaveBeenCalledTimes(0);

    component2!.unmount();
    getElementByIdSpy.mockRestore();
    jest.useRealTimers();
  });

  it('should render anchor link without short link button', () => {
    const { container, queryByRole } = render(
      <AnchorLink showShortLinkButton={false} {...props} />,
      { useRedux: true },
    );
    expect(container.querySelector(`#${props.id}`)).toBeInTheDocument();
    expect(queryByRole('button')).not.toBeInTheDocument();
  });

  it('should render short link button', () => {
    const { getByRole } = render(
      <AnchorLink {...props} showShortLinkButton />,
      { useRedux: true },
    );
    expect(getByRole('button')).toBeInTheDocument();
  });
});
