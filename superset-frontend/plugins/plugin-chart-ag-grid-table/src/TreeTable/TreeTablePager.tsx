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
import { forwardRef, useEffect, useRef } from 'react';
import { t } from '@apache-superset/core/translation';
import { getNumberFormatter, NumberFormats } from '@superset-ui/core';
import { Flex, Pagination, Select } from '@superset-ui/core/components';
import { SelectWrapper } from '../styles';
import { SERVER_PAGE_SIZE_OPTIONS } from '../consts';

export interface TreeTablePagerProps {
  /** The current page, from 0. */
  currentPage: number;
  pageSize: number;
  total: number;
  sliceId: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

const ACTIVE_PAGE = '.ant-pagination-item-active a';
const formatInteger = getNumberFormatter(NumberFormats.INTEGER);

/**
 * The parent grid's pager: a "Page Size:" select and the core pager as the
 * list screens use it (Tab reaches each control, Enter changes the page).
 */
const TreeTablePager = forwardRef<HTMLDivElement, TreeTablePagerProps>(
  (
    { currentPage, pageSize, total, sliceId, onPageChange, onPageSizeChange },
    ref,
  ) => {
    const root = useRef<HTMLDivElement | null>(null);
    const keepFocus = useRef(false);
    const start = total === 0 ? 0 : currentPage * pageSize + 1;
    const end = Math.min((currentPage + 1) * pageSize, total);
    useEffect(() => {
      const element = root.current;
      if (!element) return undefined;
      // A control that goes away or turns disabled after a page change drops
      // focus to the page; the new current page takes it.
      const restore = () => {
        if (!keepFocus.current) return;
        const active = document.activeElement;
        if (active && active !== document.body && active.isConnected) {
          if (!element.contains(active)) keepFocus.current = false;
          return;
        }
        element.querySelector<HTMLElement>(ACTIVE_PAGE)?.focus();
      };
      let timer: ReturnType<typeof setTimeout> | undefined;
      const onFocusOut = (event: FocusEvent) => {
        const next = event.relatedTarget as Node | null;
        if (next) {
          if (!element.contains(next)) keepFocus.current = false;
          return;
        }
        clearTimeout(timer);
        timer = setTimeout(restore);
      };
      element.addEventListener('focusout', onFocusOut);
      timer = setTimeout(restore);
      return () => {
        clearTimeout(timer);
        element.removeEventListener('focusout', onFocusOut);
      };
    }, [currentPage, pageSize, total]);
    return (
      <div
        ref={element => {
          root.current = element;
          if (typeof ref === 'function') ref(element);
          else if (ref) ref.current = element;
        }}
      >
        <Flex justify="flex-end" align="center" wrap gap="small">
          <span>{t('Page Size:')}</span>
          <SelectWrapper>
            <Select
              ariaLabel={t('Page Size:')}
              value={`${pageSize}`}
              options={SERVER_PAGE_SIZE_OPTIONS.map(([value, label]) => ({
                value,
                label,
              }))}
              filterSort={(left, right) =>
                Number(left.value) - Number(right.value)
              }
              onChange={(value: string) => onPageSizeChange(Number(value))}
              getPopupContainer={() =>
                document.getElementById(`chart-id-${sliceId}`) as HTMLElement
              }
            />
          </SelectWrapper>
          <Pagination
            size="small"
            showLessItems
            current={currentPage + 1}
            pageSize={pageSize}
            total={total}
            showSizeChanger={false}
            showQuickJumper={false}
            showTotal={() =>
              t('%(start)s to %(end)s of %(total)s', {
                start: formatInteger(start),
                end: formatInteger(end),
                total: formatInteger(total),
              })
            }
            onChange={page => {
              keepFocus.current = Boolean(
                root.current?.contains(document.activeElement),
              );
              onPageChange(page - 1);
            }}
          />
        </Flex>
      </div>
    );
  },
);

export default TreeTablePager;
