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
import React, { Dispatch, SetStateAction } from 'react';
import {
  Button,
  Col,
  DropdownButton,
  FormControl,
  MenuItem,
  Row,
} from 'react-bootstrap';
import { Select } from 'src/components/Select';
import { Filters, InternalFilter, SelectOption } from './types';
import { extractInputValue, getDefaultFilterOperator } from './utils';

const styleWidth100p = { width: '100%' };

export const FilterMenu = ({
  filters,
  internalFilters,
  setInternalFilters,
}: {
  filters: Filters;
  internalFilters: InternalFilter[];
  setInternalFilters: Dispatch<SetStateAction<InternalFilter[]>>;
}) => (
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
          {t('Filter')}
        </>
      }
    >
      {filters
        .map(({ id, Header }) => ({
          Header,
          id,
          value: undefined,
        }))
        .map(ft => (
          <MenuItem
            key={ft.id}
            eventKey={ft}
            // @ts-ignore
            onSelect={(fltr: typeof ft) => {
              setInternalFilters([...internalFilters, fltr]);
            }}
          >
            {ft.Header}
          </MenuItem>
        ))}
    </DropdownButton>
  </div>
);

export const FilterInputs = ({
  internalFilters,
  filters,
  updateInternalFilter,
  removeFilterAndApply,
  filtersApplied,
  applyFilters,
}: {
  internalFilters: InternalFilter[];
  filters: Filters;
  updateInternalFilter: (i: number, f: object) => void;
  removeFilterAndApply: (i: number) => void;
  filtersApplied: boolean;
  applyFilters: () => void;
}) => (
  <>
    {internalFilters.map((ft, i) => {
      const filter = filters.find(f => f.id === ft.id);
      if (!filter) {
        // eslint-disable-next-line no-console
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
                placeholder={filter ? getDefaultFilterOperator(filter) : ''}
                // @ts-ignore
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  updateInternalFilter(i, {
                    operator: e.currentTarget.value,
                  });
                }}
              >
                {(filter.operators || []).map(
                  ({ label, value }: SelectOption) => (
                    <option key={label} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </FormControl>
            </Col>
            <Col md={1} />
            <Col md={4}>
              {filter.input === 'select' && (
                <Select
                  autoFocus
                  multi
                  searchable
                  name={`filter-${filter.id}-select`}
                  options={filter.selects}
                  placeholder="Select Value"
                  value={ft.value as SelectOption['value'][] | undefined}
                  onChange={(e: SelectOption[] | null) => {
                    updateInternalFilter(i, {
                      operator: ft.operator || getDefaultFilterOperator(filter),
                      value: e ? e.map(s => s.value) : e,
                    });
                  }}
                />
              )}
              {filter.input !== 'select' && (
                // @ts-ignore
                <FormControl
                  type={filter.input ? filter.input : 'text'}
                  bsSize="small"
                  value={String(ft.value || '')}
                  checked={Boolean(ft.value)}
                  // @ts-ignore
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    e.persist();
                    updateInternalFilter(i, {
                      operator: ft.operator || getDefaultFilterOperator(filter),
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
          <Col md={11} />
          <Col md={1}>
            <Button
              data-test="apply-filters"
              disabled={!!filtersApplied}
              bsStyle="primary"
              style={styleWidth100p}
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
  </>
);
