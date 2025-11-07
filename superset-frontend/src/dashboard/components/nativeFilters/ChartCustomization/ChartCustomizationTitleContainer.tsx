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
import { FC, forwardRef, MouseEvent } from 'react';
import { t } from '@superset-ui/core';
import { styled, css, useTheme } from '@apache-superset/core/ui';
import { Icons, Flex } from '@superset-ui/core/components';
import { ChartCustomizationItem } from './types';

interface Props {
  items: ChartCustomizationItem[];
  currentId: string | null;
  onChange: (id: string) => void;
  onRemove: (id: string) => void;
  restoreItem: (id: string) => void;
  removedItems: Record<string, { isPending: boolean; timerId?: number } | null>;
  erroredItems?: string[];
}

const FilterTitle = styled.div<{ selected: boolean; errored: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.sizeUnit * 2}px
    ${({ theme }) => theme.sizeUnit * 3}px;
  background-color: ${({ theme, selected }) =>
    selected ? theme.colorPrimaryBg : theme.colorBgTextHover};
  border: 1px solid
    ${({ theme, selected }) => (selected ? theme.colorPrimary : 'transparent')};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  cursor: pointer;

  &:hover {
    background-color: ${({ theme }) => theme.colorBgTextHover};
  }

  ${({ theme, errored }) =>
    errored &&
    `
    &.errored div, &.errored .warning {
      color: ${theme.colorErrorText};
    }
  `}
`;

const LabelWrapper = styled.div`
  display: flex;
  align-items: center;
  flex: 1;
  overflow: hidden;
`;

const TitleText = styled.div`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const UndoButton = styled.span`
  margin-left: auto;
  color: ${({ theme }) => theme.colorPrimary};
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSizeSM}px;

  &:hover {
    text-decoration: underline;
  }
`;

const TrashIcon = styled(Icons.DeleteOutlined)`
  cursor: pointer;
  margin-left: ${({ theme }) => theme.sizeUnit * 2}px;
  color: ${({ theme }) => theme.colorTextSecondary};

  &:hover {
    color: ${({ theme }) => theme.colorErrorText};
  }
`;

const StyledWarning = styled(Icons.ExclamationCircleOutlined)`
  margin-left: ${({ theme }) => theme.sizeUnit * 2}px;
  color: ${({ theme }) => theme.colorErrorText};
`;

const ChartCustomizationTitleContainer: FC<Props> = forwardRef(
  (
    {
      items,
      currentId,
      onChange,
      onRemove,
      restoreItem,
      removedItems,
      erroredItems = [],
    },
    ref,
  ) => {
    const theme = useTheme();
    return (
      <Flex
        css={css`
          flex-direction: column;
          gap: ${theme.sizeUnit * 2}px;
        `}
        ref={ref as any}
      >
        {items.map(item => {
          const isRemoved = !!removedItems[item.id];
          const selected = item.id === currentId;
          const isErrored = erroredItems.includes(item.id);
          const displayName =
            item.customization.name?.trim() || t('[untitled]');

          return (
            <FilterTitle
              key={`group-by-title-${item.id}`}
              role="tab"
              tabIndex={0}
              selected={selected}
              errored={isErrored}
              onClick={() => onChange(item.id)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onChange(item.id);
                }
              }}
            >
              <LabelWrapper>
                <TitleText>
                  {isRemoved ? t('(Removed)') : displayName}
                </TitleText>
                {isRemoved && (
                  <UndoButton
                    role="button"
                    tabIndex={0}
                    onClick={(e: MouseEvent<HTMLElement>) => {
                      e.stopPropagation();
                      restoreItem(item.id);
                    }}
                  >
                    {t('Undo?')}
                  </UndoButton>
                )}
              </LabelWrapper>
              {!isRemoved && (
                <>
                  {isErrored && (
                    <StyledWarning className="warning" iconSize="s" />
                  )}
                  <TrashIcon
                    iconSize="m"
                    onClick={(e: MouseEvent<HTMLElement>) => {
                      e.stopPropagation();
                      onRemove(item.id);
                    }}
                    aria-label={t('Remove group by')}
                  />
                </>
              )}
            </FilterTitle>
          );
        })}
      </Flex>
    );
  },
);

export default ChartCustomizationTitleContainer;
