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
import { styled, t, useTheme } from '@superset-ui/core';
import Button from 'src/components/Button';
import { Icons } from 'src/components/Icons';
import ChartCustomizationTitleContainer from './ChartCustomizationTitleContainer';
import { ChartCustomizationItem } from './types';
import { createDefaultChartCustomizationItem } from './utils';

interface Props {
  items: ChartCustomizationItem[];
  currentId: string | null;
  onChange: (id: string) => void;
  onAdd: (item: ChartCustomizationItem) => void;
  onRemove: (id: string, shouldRemove?: boolean) => void;
  setCurrentId: (id: string) => void;
}

const PaneContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const ListWrapper = styled.div`
  flex-grow: 1;
  overflow-y: auto;
  margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
`;

const ActionsWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.gridUnit * 2}px;
`;

const ChartCustomizationTitlePane: FC<Props> = ({
  items,
  currentId,
  onChange,
  onAdd,
  onRemove,
  setCurrentId,
}) => {
  const theme = useTheme();
  const listRef = useRef<HTMLDivElement>(null);

  const handleAdd = () => {
    const newItem = createDefaultChartCustomizationItem();

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
      <ListWrapper ref={listRef}>
        <ChartCustomizationTitleContainer
          items={items}
          currentId={currentId}
          onChange={onChange}
          onRemove={onRemove}
        />
      </ListWrapper>

      <ActionsWrapper>
        <Button
          buttonStyle="secondary"
          aria-label={t('Add dynamic group by')}
          icon={
            <Icons.GroupOutlined
              iconColor={theme.colors.primary.dark1}
              iconSize="m"
            />
          }
          onClick={handleAdd}
          data-test="add-groupby-button"
        >
          {t('Add dynamic group by')}
        </Button>
      </ActionsWrapper>
    </PaneContainer>
  );
};

export default ChartCustomizationTitlePane;
