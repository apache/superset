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
import { useRef, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Button from 'src/components/Button';
import { styled, t } from '@superset-ui/core';

import ErrorBoundary from 'src/components/ErrorBoundary';
import Tabs from 'src/components/Tabs';
import adhocMetricType from 'src/explore/components/controls/MetricControl/adhocMetricType';
import AdhocFilter from 'src/explore/components/controls/FilterControl/AdhocFilter';
import AdhocFilterEditPopoverSimpleTabContent from 'src/explore/components/controls/FilterControl/AdhocFilterEditPopoverSimpleTabContent';
import AdhocFilterEditPopoverSqlTabContent from 'src/explore/components/controls/FilterControl/AdhocFilterEditPopoverSqlTabContent';
import columnType from 'src/explore/components/controls/FilterControl/columnType';
import {
  POPOVER_INITIAL_HEIGHT,
  POPOVER_INITIAL_WIDTH,
} from 'src/explore/constants';
import { ExpressionTypes } from '../types';

const propTypes = {
  adhocFilter: PropTypes.instanceOf(AdhocFilter).isRequired,
  onChange: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onResize: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.oneOfType([
      columnType,
      PropTypes.shape({ saved_metric_name: PropTypes.string.isRequired }),
      adhocMetricType,
    ]),
  ).isRequired,
  datasource: PropTypes.object,
  partitionColumn: PropTypes.string,
  theme: PropTypes.object,
  sections: PropTypes.arrayOf(PropTypes.string),
  operators: PropTypes.arrayOf(PropTypes.string),
  requireSave: PropTypes.bool,
};

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

const AdhocFilterEditPopover = props => {
  const {
    adhocFilter: propsAdhocFilter,
    options,
    onChange,
    onClose,
    onResize,
    datasource,
    partitionColumn,
    theme,
    operators,
    requireSave,
    ...popoverProps
  } = props;

  const [adhocFilter, setAdhocFilter] = useState(propsAdhocFilter);
  const [width, setWidth] = useState(POPOVER_INITIAL_WIDTH);
  const [height, setHeight] = useState(POPOVER_INITIAL_HEIGHT);
  const [activeKey, setActiveKey] = useState(
    propsAdhocFilter?.expressionType || 'SIMPLE',
  );
  const [isSimpleTabValid, setIsSimpleTabValid] = useState(true);

  const popoverContentRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

  const onMouseMove = e => {
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
  };

  useEffect(() => {
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
    };

    document.addEventListener('mouseup', onMouseUp);

    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  const onAdhocFilterChange = newAdhocFilter => {
    setAdhocFilter(newAdhocFilter);
  };

  const onSave = () => {
    onChange(adhocFilter);
    onClose();
  };

  const onDragDown = e => {
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width,
      height,
    };
    document.addEventListener('mousemove', onMouseMove);
  };

  const onTabChange = newActiveKey => {
    setActiveKey(newActiveKey);
  };

  const adjustHeight = heightDifference => {
    setHeight(prevHeight => prevHeight + heightDifference);
  };

  const stateIsValid = adhocFilter.isValid();
  const hasUnsavedChanges =
    requireSave || !adhocFilter.equals(propsAdhocFilter);

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
        onChange={onTabChange}
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
              options={options}
              datasource={datasource}
              onHeightChange={adjustHeight}
              partitionColumn={partitionColumn}
              popoverRef={popoverContentRef.current}
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
              options={options}
              height={height}
              activeKey={activeKey}
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

AdhocFilterEditPopover.propTypes = propTypes;

export default AdhocFilterEditPopover;
