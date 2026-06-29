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
import type { ComponentProps } from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import { useDataMaskStore } from 'src/dataMask/useDataMaskStore';
import ChartContainer from './ChartContainer';

// The chart calls setDataMask on render (e.g. Table server pagination); the
// container must hand it the store action directly, not a Redux-bound copy
// that would dispatch `undefined`.
jest.mock('./Chart', () => {
  const { useEffect } = jest.requireActual('react');
  return (props: {
    actions: { updateDataMask: (id: number, mask: unknown) => void };
  }) => {
    useEffect(() => {
      props.actions.updateDataMask(7, { filterState: { value: 'x' } });
    }, [props.actions]);
    return <div data-test="chart" />;
  };
});

test('updateDataMask writes the dataMask store without a Redux dispatch', () => {
  render(
    <ChartContainer
      {...({} as unknown as ComponentProps<typeof ChartContainer>)}
    />,
    { useRedux: true },
  );
  expect(screen.getByTestId('chart')).toBeInTheDocument();
  expect(useDataMaskStore.getState().dataMask[7]?.filterState?.value).toBe('x');
});
