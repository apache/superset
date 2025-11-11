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
import { FC, useRef } from 'react';
import { t } from '@superset-ui/core';
import { styled, useTheme } from '@apache-superset/core/ui';
import { Button, Icons } from '@superset-ui/core/components';
import ChartCustomizationTitleContainer from './ChartCustomizationTitleContainer';
import { ChartCustomizationItem } from './types';
import { createDefaultChartCustomizationItem } from './utils';

interface Props {
  items: ChartCustomizationItem[];
  currentId: string | null;
  chartId?: number;
  onChange: (id: string) => void;
  onAdd: (item: ChartCustomizationItem) => void;
  onRemove: (id: string) => void;
  restoreItem: (id: string) => void;
  removedItems: Record<string, { isPending: boolean; timerId?: number } | null>;
  setCurrentId: (id: string) => void;
  erroredItems?: string[];
}

const PaneContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.sizeUnit * 3}px;
  padding-top: 2px;
`;

const ChartCustomizationTitlePane: FC<Props> = ({
  items,
  currentId,
  chartId,
  onChange,
  onAdd,
  onRemove,
  restoreItem,
  removedItems,
  setCurrentId,
  erroredItems = [],
}) => {
  const theme = useTheme();
  const listRef = useRef<HTMLDivElement>(null);

  const handleAdd = () => {
    const newItem = createDefaultChartCustomizationItem(chartId);

    onAdd(newItem);
    setCurrentId(newItem.id);

    setTimeout(() => {
      listRef.current?.scroll({
        top: listRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }, 50);
  };

  return (
    <PaneContainer>
      <div
        ref={listRef}
        css={{
          flex: 1,
          overflowY: 'auto',
        }}
      >
        <ChartCustomizationTitleContainer
          items={items}
          currentId={currentId}
          onChange={onChange}
          onRemove={onRemove}
          restoreItem={restoreItem}
          removedItems={removedItems}
          erroredItems={erroredItems}
        />
      </div>
      <div
        css={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          paddingTop: theme.sizeUnit * 3,
        }}
      >
        <Button
          buttonSize="default"
          buttonStyle="secondary"
          aria-label={t('Add dynamic group by')}
          icon={
            <Icons.GroupOutlined
              iconColor={theme.colorPrimaryActive}
              iconSize="m"
            />
          }
          onClick={handleAdd}
          data-test="add-groupby-button"
        >
          {t('Add dynamic group by')}
        </Button>
      </div>
    </PaneContainer>
  );
};

export default ChartCustomizationTitlePane;
