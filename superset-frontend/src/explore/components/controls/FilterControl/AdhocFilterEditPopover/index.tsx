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
import { useRef, useState, useEffect, useCallback } from 'react';
import Button from 'src/components/Button';
import { styled, t, SupersetTheme, DatasourceType } from '@superset-ui/core';
import { OptionSortType } from 'src/explore/types';
import ErrorBoundary from 'src/components/ErrorBoundary';
import Tabs from 'src/components/Tabs';
import AdhocFilter from 'src/explore/components/controls/FilterControl/AdhocFilter';
import AdhocFilterEditPopoverSimpleTabContent, {
  ColumnType,
} from 'src/explore/components/controls/FilterControl/AdhocFilterEditPopoverSimpleTabContent';
import AdhocFilterEditPopoverSqlTabContent from 'src/explore/components/controls/FilterControl/AdhocFilterEditPopoverSqlTabContent';
import {
  POPOVER_INITIAL_HEIGHT,
  POPOVER_INITIAL_WIDTH,
  Operators,
} from 'src/explore/constants';
import { Dataset } from '@superset-ui/chart-controls';
import { ExpressionTypes } from '../types';

export interface AdhocFilterEditPopoverProps {
  adhocFilter: AdhocFilter;
  onChange: (adhocFilter: AdhocFilter) => void;
  onClose: (() => void) | undefined;
  onResize: () => void;
  options: OptionSortType[] | ColumnType[];
  datasource?: Record<string, any>;
  partitionColumn?: string;
  theme?: SupersetTheme;
  sections?: string[];
  operators?: Operators[];
  requireSave?: boolean;
}

const ResizeIcon = styled.i`
  margin-left: ${({ theme }) => theme.gridUnit * 2}px;
`;

const FilterPopoverContentContainer = styled.div`
  .adhoc-filter-edit-tabs > .nav-tabs {
    margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;

    & > li > a {
      padding: ${({ theme }) => theme.gridUnit}px;
    }
  }

  #filter-edit-popover {
    max-width: none;
  }

  .filter-edit-clause-info {
    font-size: ${({ theme }) => theme.typography.sizes.xs}px;
  }

  .filter-edit-clause-section {
    display: flex;
    flex-direction: row;
    gap: ${({ theme }) => theme.gridUnit * 5}px;
  }

  .adhoc-filter-simple-column-dropdown {
    margin-top: ${({ theme }) => theme.gridUnit * 5}px;
  }
`;

const FilterActionsContainer = styled.div`
  margin-top: ${({ theme }) => theme.gridUnit * 2}px;
`;

// Default empty Dataset object that satisfies the Dataset interface
const emptyDataset: Dataset = {
  id: 0,
  type: DatasourceType.Table,
  columns: [],
  metrics: [],
  column_formats: {},
  currency_formats: {},
  verbose_map: {},
  main_dttm_col: '',
  datasource_name: null,
  description: null,
};

const AdhocFilterEditPopover = (
  props: AdhocFilterEditPopoverProps & Record<string, any>,
) => {
  const {
    adhocFilter: propsAdhocFilter,
    options,
    onChange,
    onClose,
    onResize,
    datasource,
    partitionColumn,
    operators,
    requireSave,
    ...popoverProps
  } = props;

  const [adhocFilter, setAdhocFilter] = useState<AdhocFilter>(propsAdhocFilter);
  const [width, setWidth] = useState<number>(POPOVER_INITIAL_WIDTH);
  const [height, setHeight] = useState<number>(POPOVER_INITIAL_HEIGHT);
  const [isSimpleTabValid, setIsSimpleTabValid] = useState<boolean>(true);

  const popoverContentRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>({ x: 0, y: 0, width: 0, height: 0 });

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      onResize();
      setWidth(
        Math.max(
          dragStartRef.current.width + (e.clientX - dragStartRef.current.x),
          POPOVER_INITIAL_WIDTH,
        ),
      );
      setHeight(
        Math.max(
          dragStartRef.current.height + (e.clientY - dragStartRef.current.y),
          POPOVER_INITIAL_HEIGHT,
        ),
      );
    },
    [onResize],
  );

  useEffect(() => {
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
    };

    document.addEventListener('mouseup', onMouseUp);

    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mousemove', onMouseMove);
    };
  }, [onMouseMove]);

  const onAdhocFilterChange = (newAdhocFilter: AdhocFilter) => {
    setAdhocFilter(newAdhocFilter);
  };

  const onSave = () => {
    onChange(adhocFilter);
    if (onClose) {
      onClose();
    }
  };

  const onDragDown = (e: React.MouseEvent<HTMLElement>) => {
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width,
      height,
    };
    document.addEventListener('mousemove', onMouseMove);
  };

  const stateIsValid = adhocFilter.isValid();
  const hasUnsavedChanges =
    requireSave || !adhocFilter.equals(propsAdhocFilter);

  // Convert datasource to Dataset type or use empty dataset
  const datasetForSimpleTab: Dataset = (datasource as Dataset) || emptyDataset;

  return (
    <FilterPopoverContentContainer
      id="filter-edit-popover"
      {...popoverProps}
      data-test="filter-edit-popover"
      ref={popoverContentRef}
    >
      <Tabs
        id="adhoc-filter-edit-tabs"
        defaultActiveKey={adhocFilter.expressionType}
        className="adhoc-filter-edit-tabs"
        data-test="adhoc-filter-edit-tabs"
        style={{ minHeight: height, width }}
        allowOverflow
      >
        <Tabs.TabPane
          className="adhoc-filter-edit-tab"
          key={ExpressionTypes.Simple}
          tab={t('Simple')}
        >
          <ErrorBoundary>
            <AdhocFilterEditPopoverSimpleTabContent
              operators={operators}
              adhocFilter={adhocFilter}
              onChange={onAdhocFilterChange}
              options={options as ColumnType[]}
              datasource={datasetForSimpleTab}
              partitionColumn={partitionColumn || ''}
              validHandler={setIsSimpleTabValid}
            />
          </ErrorBoundary>
        </Tabs.TabPane>
        <Tabs.TabPane
          className="adhoc-filter-edit-tab"
          key={ExpressionTypes.Sql}
          tab={t('Custom SQL')}
        >
          <ErrorBoundary>
            <AdhocFilterEditPopoverSqlTabContent
              adhocFilter={adhocFilter}
              onChange={onAdhocFilterChange}
              options={options as OptionSortType[]}
              height={height}
            />
          </ErrorBoundary>
        </Tabs.TabPane>
      </Tabs>
      <FilterActionsContainer>
        <Button buttonSize="small" onClick={onClose} cta>
          {t('Close')}
        </Button>
        <Button
          data-test="adhoc-filter-edit-popover-save-button"
          disabled={!stateIsValid || !isSimpleTabValid || !hasUnsavedChanges}
          buttonStyle="primary"
          buttonSize="small"
          className="m-r-5"
          onClick={onSave}
          cta
        >
          {t('Save')}
        </Button>
        <ResizeIcon
          role="button"
          aria-label="Resize"
          tabIndex={0}
          onMouseDown={onDragDown}
          className="fa fa-expand edit-popover-resize text-muted"
        />
      </FilterActionsContainer>
    </FilterPopoverContentContainer>
  );
};

export default AdhocFilterEditPopover;
