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
import { fireEvent, render, screen } from '@superset-ui/core/spec';
import { FeatureFlag, QueryMode } from '@superset-ui/core';
import ChartByMode from '../src/ChartByMode';
import AgGridTableChart from '../src/AgGridTableChart';
import transformProps from '../src/transformProps';
import treeTransformProps from '../src/TreeTable/transformProps';
import { treeFormData } from './treeModeFixtures';
import testData from '../../plugin-chart-table/test/testData';
import { TreeTableChartProps } from '../src/TreeTable/types';

jest.mock('../src/AgGridTableChart', () => ({
  __esModule: true,
  default: ({ isRawRecords }: { isRawRecords: boolean }) => (
    <div role="grid">Table V2 {isRawRecords ? 'raw' : 'aggregate'}</div>
  ),
}));
jest.mock('../src/TreeTable/TreeTableChart', () => ({
  __esModule: true,
  default: () => <div role="grid">Tree grid</div>,
}));

test.each([QueryMode.Aggregate, QueryMode.Raw])(
  '%s passes the identical element and props to Table V2',
  mode => {
    const props = transformProps({
      ...testData.basic,
      rawFormData: { ...testData.basic.rawFormData, query_mode: mode },
    });
    expect(ChartByMode(props)).toEqual(<AgGridTableChart {...props} />);
    const direct = render(<AgGridTableChart {...props} />);
    const markup = direct.container.innerHTML;
    direct.unmount();
    expect(render(<ChartByMode {...props} />).container.innerHTML).toBe(markup);
  },
);

test('Tree is lazy with Loading while it resolves, and flag off mounts no grid', async () => {
  const flags = window.featureFlags;
  const props = {
    ...treeTransformProps({
      ...testData.basic,
      formData: treeFormData,
      rawFormData: treeFormData,
    } as unknown as TreeTableChartProps),
    queryMode: 'tree' as const,
    onChartStateChange: jest.fn(),
  };
  try {
    window.featureFlags = {
      ...flags,
      [FeatureFlag.TableV2TreeModeEnabled]: true,
    };
    const tree = render(<ChartByMode {...props} />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(await screen.findByRole('grid')).toHaveTextContent('Tree grid');
    tree.unmount();
    window.featureFlags = {
      ...flags,
      [FeatureFlag.TableV2TreeModeEnabled]: false,
    };
    const onContextMenu = jest.fn();
    render(
      <div onContextMenu={onContextMenu}>
        <ChartByMode {...props} />
      </div>,
    );
    expect(screen.getByText('Tree mode is turned off')).toBeInTheDocument();
    fireEvent.contextMenu(screen.getByText('Tree mode is turned off'));
    expect(onContextMenu).not.toHaveBeenCalled();
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    expect(props.onChartStateChange).not.toHaveBeenCalled();
  } finally {
    window.featureFlags = flags;
  }
});
