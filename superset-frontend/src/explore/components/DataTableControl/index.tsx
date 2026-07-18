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
import { useMemo, useEffect, useRef, RefObject } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled, useTheme } from '@apache-superset/core/theme';

import { debounce } from 'lodash-es';
import { Constants, Button, Icons, Input } from '@superset-ui/core/components';
import { CopyToClipboard } from 'src/components';
import {
  prepareCopyToClipboardTabularData,
  TabularDataRow,
} from 'src/utils/common';

export const CellNull = styled('span')`
  color: ${({ theme }) => theme.colorTextTertiary};
`;

export const CopyButton = styled(Button)`
  font-size: ${({ theme }) => theme.fontSizeSM}px;

  /* needed to override button's first-of-type margin: 0 */
  && {
    margin: 0 ${({ theme }) => theme.sizeUnit * 2}px;
  }

  i {
    padding: 0 ${({ theme }) => theme.sizeUnit}px;
  }
`;

export const CopyToClipboardButton = ({
  data,
  columns,
  disabled = false,
}: {
  data?: TabularDataRow[];
  columns?: string[];
  disabled?: boolean;
}) => {
  const theme = useTheme();
  return (
    <CopyToClipboard
      text={
        !disabled && data && columns
          ? prepareCopyToClipboardTabularData(data, columns)
          : ''
      }
      disabled={disabled}
      wrapped={false}
      copyNode={
        <span
          role="button"
          aria-label={t('Copy')}
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : 0}
        >
          <Icons.CopyOutlined
            iconColor={theme.colorIcon}
            iconSize="l"
            css={css`
              opacity: ${disabled ? 0.3 : 1};
              cursor: ${disabled ? 'not-allowed' : 'pointer'};
              &.anticon > * {
                line-height: 0;
              }
            `}
          />
        </span>
      }
    />
  );
};

export const FilterInput = ({
  onChangeHandler,
  shouldFocus = false,
}: {
  onChangeHandler(filterText: string): void;
  shouldFocus?: boolean;
}) => {
  const inputRef: RefObject<any> = useRef(null);

  useEffect(() => {
    if (inputRef.current && shouldFocus) {
      // Skip auto-focus only when an editable element already has focus (e.g.
      // user is typing in a form control when this pane remounts after a data
      // refresh). Non-editable focused elements like tabs/buttons still allow
      // auto-focus so the search box focuses on first open.
      const activeEl = document.activeElement;
      const editableFocused =
        activeEl instanceof HTMLElement &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.isContentEditable);
      if (!editableFocused) {
        inputRef.current.focus();
      }
    }
  }, []);

  const theme = useTheme();
  const debouncedChangeHandler = debounce(
    onChangeHandler,
    Constants.SLOW_DEBOUNCE,
  );
  return (
    <Input
      prefix={<Icons.SearchOutlined iconSize="l" />}
      placeholder={t('Search')}
      onChange={(event: any) => {
        const filterText = event.target.value;
        debouncedChangeHandler(filterText);
      }}
      css={css`
        width: 200px;
        margin-right: ${theme.sizeUnit * 2}px;
      `}
      ref={inputRef}
    />
  );
};

export const useFilteredTableData = (
  filterText: string,
  data?: Record<string, any>[],
) => {
  const rowsAsStrings = useMemo(
    () =>
      data?.map((row: Record<string, any>) =>
        Object.values(row).map(value =>
          value ? value.toString().toLowerCase() : t('N/A'),
        ),
      ) ?? [],
    [data],
  );

  return useMemo(() => {
    if (!data?.length) {
      return [];
    }
    return data.filter((_, index: number) =>
      rowsAsStrings[index].some(value =>
        value?.includes(filterText.toLowerCase()),
      ),
    );
  }, [data, filterText, rowsAsStrings]);
};
