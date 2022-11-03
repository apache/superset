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
import React, { useEffect, useState } from 'react';
import { isEqual } from 'lodash';
import { css } from '@superset-ui/core';
import Select from '../Select/Select';
import DropdownContainer, { DropdownContainerProps } from '.';

export default {
  title: 'DropdownContainer',
  component: DropdownContainer,
};

const ITEMS_COUNT = 6;
const ITEM_OPTIONS = 10;
const MIN_WIDTH = 700;
const MAX_WIDTH = 1500;

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
      <div style={{ minWidth: 200 }}>
        <Select
          options={itemsOptions}
          header={`Option ${i}`}
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

  useEffect(() => {
    setItems(generateItems(overflowingState));
  }, [overflowingState]);

  return (
    <div
      css={css`
        position: relative;
        overflow: auto;
        min-width: ${MIN_WIDTH}px;
        width: ${MIN_WIDTH}px;
        max-width: ${MAX_WIDTH}px;
        height: 80vh;
        border: 1px solid lightgray;
        resize: horizontal;
        padding: 24px;
      `}
    >
      <DropdownContainer
        {...props}
        items={items}
        onOverflowingStateChange={value => {
          if (!isEqual(overflowingState, value)) {
            setOverflowingState(value);
          }
        }}
      />
      <span
        css={css`
          position: absolute;
          right: 20px;
          bottom: 8px;
          color: gray;
        `}
      >
        Use the drag icon to resize the container
      </span>
    </div>
  );
};
