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
import { useRef, useCallback, useState } from 'react';
import { isEqual } from 'lodash';
import { css } from '@apache-superset/core/ui';
import { Button } from '../Button';
import { Select } from '../Select';
import type { DropdownContainerProps, DropdownRef } from './types';
import { DropdownContainer } from '.';

export default {
  title: 'Design System/Components/DropdownContainer',
  component: DropdownContainer,
  parameters: {
    docs: {
      description: {
        component:
          'DropdownContainer arranges items horizontally and moves overflowing items into a dropdown popover. Resize the container to see the overflow behavior.',
      },
    },
  },
};

const ITEMS_COUNT = 6;
const ITEM_OPTIONS = 10;
const MIN_WIDTH = 700;
const MAX_WIDTH = 1300;
const HEIGHT = 400;

const itemsOptions = Array.from({ length: ITEM_OPTIONS }).map((_, i) => ({
  label: `Option ${i}`,
  value: `option-${i}`,
}));

type ItemsType = Pick<DropdownContainerProps, 'items'>['items'];

type OverflowingState = { notOverflowed: string[]; overflowed: string[] };

const generateItems = (overflowingState?: OverflowingState) =>
  Array.from({ length: ITEMS_COUNT }).map((_, i) => ({
    id: `el-${i}`,
    element: (
      <div style={{ minWidth: 150 }}>
        <Select
          options={itemsOptions}
          header={`Label ${i}`}
          headerPosition={
            overflowingState?.overflowed.includes(`el-${i}`) ? 'top' : 'left'
          }
        />
      </div>
    ),
  }));

export const Component = (props: DropdownContainerProps) => {
  const [items, setItems] = useState<ItemsType>([]);
  const [overflowingState, setOverflowingState] = useState<OverflowingState>();
  const containerRef = useRef<DropdownRef>(null);
  const onOverflowingStateChange = useCallback(
    value => {
      if (!isEqual(overflowingState, value)) {
        setItems(generateItems(value));
        setOverflowingState(value);
      }
    },
    [overflowingState],
  );

  return (
    <div>
      <div
        css={css`
          overflow: auto;
          min-width: ${MIN_WIDTH}px;
          width: ${MIN_WIDTH}px;
          max-width: ${MAX_WIDTH}px;
          height: ${HEIGHT}px;
          border: 1px solid lightgray;
          resize: horizontal;
          padding: 24px;
          margin-bottom: 12px;
        `}
      >
        <DropdownContainer
          {...props}
          items={items}
          onOverflowingStateChange={onOverflowingStateChange}
          ref={containerRef}
        />
      </div>
      <Button onClick={() => containerRef.current?.open()}>Open</Button>
      <span
        css={css`
          margin-left: ${MIN_WIDTH - 340}px;
          color: gray;
        `}
      >
        Use the drag icon to resize the container
      </span>
    </div>
  );
};

// Interactive story for docs generation
export const InteractiveDropdownContainer = (args: DropdownContainerProps) => {
  const simpleItems = Array.from({ length: 6 }, (_, i) => ({
    id: `item-${i}`,
    element: (
      <div
        style={{
          minWidth: 120,
          padding: '4px 12px',
          background: '#e6f4ff',
          border: '1px solid #91caff',
          borderRadius: 4,
        }}
      >
        Filter {i + 1}
      </div>
    ),
  }));
  return (
    <div
      style={{
        width: 500,
        resize: 'horizontal',
        overflow: 'auto',
        border: '1px solid #e8e8e8',
        padding: 16,
      }}
    >
      <DropdownContainer {...args} items={simpleItems} />
    </div>
  );
};

InteractiveDropdownContainer.args = {};

InteractiveDropdownContainer.argTypes = {};

InteractiveDropdownContainer.parameters = {
  docs: {
    staticProps: {
      style: { maxWidth: 360 },
      items: [
        {
          id: 'item-0',
          element: {
            component: 'Tag',
            props: { children: 'Region', color: 'blue' },
          },
        },
        {
          id: 'item-1',
          element: {
            component: 'Tag',
            props: { children: 'Category', color: 'blue' },
          },
        },
        {
          id: 'item-2',
          element: {
            component: 'Tag',
            props: { children: 'Date Range', color: 'blue' },
          },
        },
        {
          id: 'item-3',
          element: {
            component: 'Tag',
            props: { children: 'Status', color: 'blue' },
          },
        },
        {
          id: 'item-4',
          element: {
            component: 'Tag',
            props: { children: 'Owner', color: 'blue' },
          },
        },
        {
          id: 'item-5',
          element: {
            component: 'Tag',
            props: { children: 'Priority', color: 'blue' },
          },
        },
      ],
    },
    liveExample: `function Demo() {
  const items = Array.from({ length: 6 }, (_, i) => ({
    id: 'item-' + i,
    element: React.createElement('div', {
      style: {
        minWidth: 120,
        padding: '4px 12px',
        background: '#e6f4ff',
        border: '1px solid #91caff',
        borderRadius: 4,
      },
    }, 'Filter ' + (i + 1)),
  }));
  return (
    <div style={{ width: 400, resize: 'horizontal', overflow: 'auto', border: '1px solid #e8e8e8', padding: 16 }}>
      <DropdownContainer items={items} />
      <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
        Drag the right edge to resize and see items overflow into a dropdown
      </div>
    </div>
  );
}`,
    examples: [
      {
        title: 'With Select Filters',
        code: `function SelectFilters() {
  const items = ['Region', 'Category', 'Date Range', 'Status', 'Owner'].map(
    (label, i) => ({
      id: 'filter-' + i,
      element: React.createElement('div', {
        style: { minWidth: 150, padding: '4px 12px', background: '#f5f5f5', border: '1px solid #d9d9d9', borderRadius: 4 },
      }, label + ': All'),
    })
  );
  return (
    <div style={{ width: 500, resize: 'horizontal', overflow: 'auto', border: '1px solid #e8e8e8', padding: 16 }}>
      <DropdownContainer items={items} />
    </div>
  );
}`,
      },
    ],
  },
};
