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
import { t } from '@superset-ui/translation';
import React, { FunctionComponent } from 'react';
import {
  Button,
  Col,
  DropdownButton,
  FormControl,
  MenuItem,
  Pagination,
  Row,
  // @ts-ignore
} from 'react-bootstrap';
// @ts-ignore
import SelectComponent from 'react-select';
// @ts-ignore
import VirtualizedSelect from 'react-virtualized-select';
import IndeterminateCheckbox from '../IndeterminateCheckbox';
import './ListViewStyles.less';
import TableCollection from './TableCollection';
import {
  FetchDataConfig,
  Filters,
  InternalFilter,
  Select,
  SortColumn,
} from './types';
import {
  convertFilters,
  extractInputValue,
  removeFromList,
  useListViewState,
} from './utils';

interface Props {
  columns: any[];
  data: any[];
  count: number;
  pageSize: number;
  fetchData: (conf: FetchDataConfig) => any;
  loading: boolean;
  className?: string;
  title?: string;
  initialSort?: SortColumn[];
  filters?: Filters;
  bulkActions?: Array<{
    key?: string;
    name: React.ReactNode;
    onSelect: (rows: any[]) => any;
  }>;
}

const bulkSelectColumnConfig = {
  Cell: ({ row }: any) => (
    <div>
      <IndeterminateCheckbox {...row.getToggleRowSelectedProps()} />
    </div>
  ),
  Header: ({ getToggleAllRowsSelectedProps }: any) => (
    <div>
      <IndeterminateCheckbox {...getToggleAllRowsSelectedProps()} />
    </div>
  ),
  id: 'selection',
};

const ListView: FunctionComponent<Props> = ({
  columns,
  data,
  count,
  pageSize: initialPageSize,
  fetchData,
  loading,
  initialSort = [],
  className = '',
  title = '',
  filters = [],
  bulkActions = [],
}) => {
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    canPreviousPage,
    canNextPage,
    pageCount = 1,
    gotoPage,
    setAllFilters,
    setInternalFilters,
    updateInternalFilter,
    applyFilters,
    filtersApplied,
    selectedFlatRows,
    state: { pageIndex, pageSize, internalFilters },
  } = useListViewState({
    bulkSelectColumnConfig,
    bulkSelectMode: Boolean(bulkActions.length),
    columns,
    count,
    data,
    fetchData,
    initialPageSize,
    initialSort,
  });
  const filterable = Boolean(filters.length);

  const removeFilterAndApply = (index: number) => {
    const updated = removeFromList(internalFilters, index);
    setInternalFilters(updated);
    setAllFilters(convertFilters(updated));
  };

  return (
    <div className={`superset-list-view ${className}`}>
      {title && filterable && (
        <div className="header">
          <Row>
            <Col md={10}>
              <h2>{t(title)}</h2>
            </Col>
            {filterable && (
              <Col md={2}>
                <div className="filter-dropdown">
                  <DropdownButton
                    id="filter-picker"
                    bsSize="small"
                    bsStyle={'default'}
                    noCaret
                    title={
                      <>
                        <i className="fa fa-filter text-primary" />
                        {'  '}
                        {t('Filter List')}
                      </>
                    }
                  >
                    {filters
                      .map(({ id, Header }) => ({
                        Header,
                        id,
                      }))
                      .map((ft: InternalFilter) => (
                        <MenuItem
                          key={ft.id}
                          eventKey={ft}
                          onSelect={(fltr: InternalFilter) =>
                            setInternalFilters([...internalFilters, fltr])
                          }
                        >
                          {ft.Header}
                        </MenuItem>
                      ))}
                  </DropdownButton>
                </div>
              </Col>
            )}
          </Row>
          <hr />
          {internalFilters.map((ft, i) => {
            const filter = filters.find(f => f.id === ft.id);
            if (!filter) {
              console.error(`could not find filter for ${ft.id}`);
              return null;
            }
            return (
              <div key={`${ft.Header}-${i}`} className="filter-inputs">
                <Row>
                  <Col className="text-center filter-column" md={2}>
                    <span>{ft.Header}</span>
                  </Col>
                  <Col md={2}>
                    <FormControl
                      componentClass="select"
                      bsSize="small"
                      value={ft.operator}
                      placeholder={filter ? filter.operators[0] : ''}
                      onChange={(e: React.MouseEvent<HTMLInputElement>) => {
                        updateInternalFilter(i, {
                          operator: e.currentTarget.value,
                        });
                      }}
                    >
                      {filter.operators.map(({ label, value }: Select) => (
                        <option key={label} value={value}>
                          {label}
                        </option>
                      ))}
                    </FormControl>
                  </Col>
                  <Col md={1} />
                  <Col md={4}>
                    {filter.input === 'select' && (
                      <VirtualizedSelect
                        autoFocus
                        multi
                        searchable
                        name={`filter-${filter.id}-select`}
                        options={filter.selects}
                        placeholder="Select Value"
                        value={ft.value}
                        selectComponent={SelectComponent}
                        onChange={(e: Select[] | null) => {
                          updateInternalFilter(i, {
                            operator: ft.operator || filter.operators[0].value,
                            value: e ? e.map(s => s.value) : e,
                          });
                        }}
                      />
                    )}
                    {filter.input !== 'select' && (
                      <FormControl
                        type={filter.input ? filter.input : 'text'}
                        bsSize="small"
                        value={ft.value || ''}
                        checked={Boolean(ft.value)}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          e.persist();
                          updateInternalFilter(i, {
                            operator: ft.operator || filter.operators[0].value,
                            value: extractInputValue(filter.input, e),
                          });
                        }}
                      />
                    )}
                  </Col>
                  <Col md={1}>
                    <div
                      className="filter-close"
                      role="button"
                      tabIndex={0}
                      onClick={() => removeFilterAndApply(i)}
                    >
                      <i className="fa fa-close text-primary" />
                    </div>
                  </Col>
                </Row>
                <br />
              </div>
            );
          })}
          {internalFilters.length > 0 && (
            <>
              <Row>
                <Col md={10} />
                <Col md={2}>
                  <Button
                    data-test="apply-filters"
                    disabled={!!filtersApplied}
                    bsStyle="primary"
                    onClick={applyFilters}
                    bsSize="small"
                  >
                    {t('Apply')}
                  </Button>
                </Col>
              </Row>
              <br />
            </>
          )}
        </div>
      )}
      <div className="body">
        <TableCollection
          getTableProps={getTableProps}
          getTableBodyProps={getTableBodyProps}
          prepareRow={prepareRow}
          headerGroups={headerGroups}
          rows={rows}
          loading={loading}
        />
      </div>
      <div className="footer">
        <Row>
          <Col md={2}>
            <div className="form-actions-container">
              <div className="btn-group">
                {bulkActions.length > 0 && (
                  <DropdownButton
                    id="bulk-actions"
                    bsSize="small"
                    bsStyle="default"
                    noCaret
                    title={
                      <>
                        {t('Actions')} <span className="caret" />
                      </>
                    }
                  >
                    {bulkActions.map(action => (
                      <MenuItem
                        id={action.name}
                        key={action.key || action.name}
                        eventKey={selectedFlatRows}
                        onSelect={(selectedRows: typeof selectedFlatRows) => {
                          action.onSelect(
                            selectedRows.map((r: any) => r.original),
                          );
                        }}
                      >
                        {action.name}
                      </MenuItem>
                    ))}
                  </DropdownButton>
                )}
              </div>
            </div>
          </Col>
          <Col md={8} className="text-center">
            <Pagination
              prev={canPreviousPage}
              first={pageIndex > 1}
              next={canNextPage}
              last={pageIndex < pageCount - 2}
              items={pageCount}
              activePage={pageIndex + 1}
              ellipsis
              boundaryLinks
              maxButtons={5}
              onSelect={(p: number) => gotoPage(p - 1)}
            />
          </Col>
          <Col md={2}>
            <span className="pull-right">
              {t('showing')}{' '}
              <strong>
                {pageSize * pageIndex + (rows.length && 1)}-
                {pageSize * pageIndex + rows.length}
              </strong>{' '}
              {t('of')} <strong>{count}</strong>
            </span>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default ListView;
