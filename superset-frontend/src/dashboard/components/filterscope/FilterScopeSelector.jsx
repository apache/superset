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
import React from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import Button from 'src/components/Button';
import { css, t, styled } from '@superset-ui/core';

import buildFilterScopeTreeEntry from 'src/dashboard/util/buildFilterScopeTreeEntry';
import getFilterScopeNodesTree from 'src/dashboard/util/getFilterScopeNodesTree';
import getFilterFieldNodesTree from 'src/dashboard/util/getFilterFieldNodesTree';
import getFilterScopeParentNodes from 'src/dashboard/util/getFilterScopeParentNodes';
import getKeyForFilterScopeTree from 'src/dashboard/util/getKeyForFilterScopeTree';
import getSelectedChartIdForFilterScopeTree from 'src/dashboard/util/getSelectedChartIdForFilterScopeTree';
import getFilterScopeFromNodesTree from 'src/dashboard/util/getFilterScopeFromNodesTree';
import getRevertedFilterScope from 'src/dashboard/util/getRevertedFilterScope';
import { getChartIdsInFilterBoxScope } from 'src/dashboard/util/activeDashboardFilters';
import {
  getChartIdAndColumnFromFilterKey,
  getDashboardFilterKey,
} from 'src/dashboard/util/getDashboardFilterKey';
import { ALL_FILTERS_ROOT } from 'src/dashboard/util/constants';
import { dashboardFilterPropShape } from 'src/dashboard/util/propShapes';
import FilterScopeTree from './FilterScopeTree';
import FilterFieldTree from './FilterFieldTree';

const propTypes = {
  dashboardFilters: PropTypes.objectOf(dashboardFilterPropShape).isRequired,
  layout: PropTypes.object.isRequired,

  updateDashboardFiltersScope: PropTypes.func.isRequired,
  setUnsavedChanges: PropTypes.func.isRequired,
  onCloseModal: PropTypes.func.isRequired,
};

const ScopeContainer = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    height: 80%;
    margin-right: ${theme.gridUnit * -6}px;
    font-size: ${theme.typography.sizes.m}px;

    & .nav.nav-tabs {
      border: none;
    }

    & .filter-scope-body {
      flex: 1;
      max-height: calc(100% - ${theme.gridUnit * 32}px);

      .filter-field-pane,
      .filter-scope-pane {
        overflow-y: auto;
      }
    }

    & .warning-message {
      padding: ${theme.gridUnit * 6}px;
    }
  `}
`;

const ScopeBody = styled.div`
  ${({ theme }) => css`
    &.filter-scope-body {
      flex: 1;
      max-height: calc(100% - ${theme.gridUnit * 32}px);

      .filter-field-pane,
      .filter-scope-pane {
        overflow-y: auto;
      }
    }
  `}
`;

const ScopeHeader = styled.div`
  ${({ theme }) => css`
    height: ${theme.gridUnit * 16}px;
    border-bottom: 1px solid ${theme.colors.grayscale.light2};
    padding-left: ${theme.gridUnit * 6}px;
    margin-left: ${theme.gridUnit * -6}px;

    h4 {
      margin-top: 0;
    }

    .selected-fields {
      margin: ${theme.gridUnit * 3}px 0 ${theme.gridUnit * 4}px;
      visibility: hidden;

      &.multi-edit-mode {
        visibility: visible;
      }

      .selected-scopes {
        padding-left: ${theme.gridUnit}px;
      }
    }
  `}
`;

const ScopeSelector = styled.div`
  ${({ theme }) => css`
    &.filters-scope-selector {
      display: flex;
      flex-direction: row;
      position: relative;
      height: 100%;

      a,
      a:active,
      a:hover {
        color: inherit;
        text-decoration: none;
      }

      .react-checkbox-tree .rct-icon.rct-icon-expand-all,
      .react-checkbox-tree .rct-icon.rct-icon-collapse-all {
        font-family: ${theme.typography.families.sansSerif};
        font-size: ${theme.typography.sizes.m}px;
        color: ${theme.colors.primary.base};

        &::before {
          content: '';
        }

        &:hover {
          text-decoration: underline;
        }

        &:focus {
          outline: none;
        }
      }

      .filter-field-pane {
        position: relative;
        width: 40%;
        padding: ${theme.gridUnit * 4}px;
        padding-left: 0;
        border-right: 1px solid ${theme.colors.grayscale.light2};

        .filter-container label {
          font-weight: ${theme.typography.weights.normal};
          margin: 0 0 0 ${theme.gridUnit * 4}px;
          word-break: break-all;
        }

        .filter-field-item {
          height: ${theme.gridUnit * 9}px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 ${theme.gridUnit * 6}px;
          margin-left: ${theme.gridUnit * -6}px;

          &.is-selected {
            border: 1px solid ${theme.colors.text.label};
            border-radius: ${theme.borderRadius}px;
            background-color: ${theme.colors.grayscale.light4};
            margin-left: ${theme.gridUnit * -6}px;
          }
        }

        .react-checkbox-tree {
          .rct-title .root {
            font-weight: ${theme.typography.weights.bold};
          }

          .rct-text {
            height: ${theme.gridUnit * 10}px;
          }
        }
      }

      .filter-scope-pane {
        position: relative;
        flex: 1;
        padding: ${theme.gridUnit * 4}px;
        padding-right: ${theme.gridUnit * 6}px;
      }

      .react-checkbox-tree {
        flex-direction: column;
        color: ${theme.colors.grayscale.dark1};
        font-size: ${theme.typography.sizes.m}px;

        .filter-scope-type {
          padding: ${theme.gridUnit * 2}px 0;
          display: flex;
          align-items: center;

          &.chart {
            font-weight: ${theme.typography.weights.normal};
          }

          &.selected-filter {
            padding-left: ${theme.gridUnit * 7}px;
            position: relative;
            color: ${theme.colors.text.label};

            &::before {
              content: ' ';
              position: absolute;
              left: 0;
              top: 50%;
              width: ${theme.gridUnit * 4}px;
              height: ${theme.gridUnit * 4}px;
              border-radius: ${theme.borderRadius}px;
              margin-top: ${theme.gridUnit * -2}px;
              box-shadow: inset 0 0 0 2px ${theme.colors.grayscale.light2};
              background: ${theme.colors.grayscale.light3};
            }
          }

          &.root {
            font-weight: ${theme.typography.weights.bold};
          }
        }

        .rct-checkbox {
          svg {
            position: relative;
            top: 3px;
            width: ${theme.gridUnit * 4.5}px;
          }
        }

        .rct-node-leaf {
          .rct-bare-label {
            &::before {
              padding-left: ${theme.gridUnit}px;
            }
          }
        }

        .rct-options {
          text-align: left;
          margin-left: 0;
          margin-bottom: ${theme.gridUnit * 2}px;
        }

        .rct-text {
          margin: 0;
          display: flex;
        }

        .rct-title {
          display: block;
        }

        // disable style from react-checkbox-trees.css
        .rct-node-clickable:hover,
        .rct-node-clickable:focus,
        label:hover,
        label:active {
          background: none !important;
        }
      }

      .multi-edit-mode {
        &.filter-scope-pane {
          .rct-node.rct-node-leaf .filter-scope-type.filter_box {
            display: none;
          }
        }

        .filter-field-item {
          padding: 0 ${theme.gridUnit * 4}px 0 ${theme.gridUnit * 12}px;
          margin-left: ${theme.gridUnit * -12}px;

          &.is-selected {
            margin-left: ${theme.gridUnit * -13}px;
          }
        }
      }

      .scope-search {
        position: absolute;
        right: ${theme.gridUnit * 4}px;
        top: ${theme.gridUnit * 4}px;
        border-radius: ${theme.borderRadius}px;
        border: 1px solid ${theme.colors.grayscale.light2};
        padding: ${theme.gridUnit}px ${theme.gridUnit * 2}px;
        font-size: ${theme.typography.sizes.m}px;
        outline: none;

        &:focus {
          border: 1px solid ${theme.colors.primary.base};
        }
      }
    }
  `}
`;

const ActionsContainer = styled.div`
  ${({ theme }) => `
    height: ${theme.gridUnit * 16}px;

    border-top: ${theme.gridUnit / 4}px solid ${theme.colors.primary.light3};
    padding: ${theme.gridUnit * 6}px;
    margin: 0 0 0 ${-theme.gridUnit * 6}px;
    text-align: right;

    .btn {
      margin-right: ${theme.gridUnit * 4}px;

      &:last-child {
        margin-right: 0;
      }
    }
  `}
`;

export default class FilterScopeSelector extends React.PureComponent {
  constructor(props) {
    super(props);

    const { dashboardFilters, layout } = props;

    if (Object.keys(dashboardFilters).length > 0) {
      // display filter fields in tree structure
      const filterFieldNodes = getFilterFieldNodesTree({
        dashboardFilters,
      });
      // filterFieldNodes root node is dashboard_root component,
      // so that we can offer a select/deselect all link
      const filtersNodes = filterFieldNodes[0].children;
      this.allfilterFields = [];
      filtersNodes.forEach(({ children }) => {
        children.forEach(child => {
          this.allfilterFields.push(child.value);
        });
      });
      this.defaultFilterKey = filtersNodes[0].children[0].value;

      // build FilterScopeTree object for each filterKey
      const filterScopeMap = Object.values(dashboardFilters).reduce(
        (map, { chartId: filterId, columns }) => {
          const filterScopeByChartId = Object.keys(columns).reduce(
            (mapByChartId, columnName) => {
              const filterKey = getDashboardFilterKey({
                chartId: filterId,
                column: columnName,
              });
              const nodes = getFilterScopeNodesTree({
                components: layout,
                filterFields: [filterKey],
                selectedChartId: filterId,
              });
              const expanded = getFilterScopeParentNodes(nodes, 1);
              // force display filter_box chart as unchecked, but show checkbox as disabled
              const chartIdsInFilterScope = (
                getChartIdsInFilterBoxScope({
                  filterScope: dashboardFilters[filterId].scopes[columnName],
                }) || []
              ).filter(id => id !== filterId);

              return {
                ...mapByChartId,
                [filterKey]: {
                  // unfiltered nodes
                  nodes,
                  // filtered nodes in display if searchText is not empty
                  nodesFiltered: [...nodes],
                  checked: chartIdsInFilterScope,
                  expanded,
                },
              };
            },
            {},
          );

          return {
            ...map,
            ...filterScopeByChartId,
          };
        },
        {},
      );

      // initial state: active defaultFilerKey
      const { chartId } = getChartIdAndColumnFromFilterKey(
        this.defaultFilterKey,
      );
      const checkedFilterFields = [];
      const activeFilterField = this.defaultFilterKey;
      // expand defaultFilterKey in filter field tree
      const expandedFilterIds = [ALL_FILTERS_ROOT].concat(chartId);

      const filterScopeTreeEntry = buildFilterScopeTreeEntry({
        checkedFilterFields,
        activeFilterField,
        filterScopeMap,
        layout,
      });
      this.state = {
        showSelector: true,
        activeFilterField,
        searchText: '',
        filterScopeMap: {
          ...filterScopeMap,
          ...filterScopeTreeEntry,
        },
        filterFieldNodes,
        checkedFilterFields,
        expandedFilterIds,
      };
    } else {
      this.state = {
        showSelector: false,
      };
    }

    this.filterNodes = this.filterNodes.bind(this);
    this.onChangeFilterField = this.onChangeFilterField.bind(this);
    this.onCheckFilterScope = this.onCheckFilterScope.bind(this);
    this.onExpandFilterScope = this.onExpandFilterScope.bind(this);
    this.onSearchInputChange = this.onSearchInputChange.bind(this);
    this.onCheckFilterField = this.onCheckFilterField.bind(this);
    this.onExpandFilterField = this.onExpandFilterField.bind(this);
    this.onClose = this.onClose.bind(this);
    this.onSave = this.onSave.bind(this);
  }

  onCheckFilterScope(checked = []) {
    const { activeFilterField, filterScopeMap, checkedFilterFields } =
      this.state;

    const key = getKeyForFilterScopeTree({
      activeFilterField,
      checkedFilterFields,
    });
    const editingList = activeFilterField
      ? [activeFilterField]
      : checkedFilterFields;
    const updatedEntry = {
      ...filterScopeMap[key],
      checked,
    };

    const updatedFilterScopeMap = getRevertedFilterScope({
      checked,
      filterFields: editingList,
      filterScopeMap,
    });

    this.setState(() => ({
      filterScopeMap: {
        ...filterScopeMap,
        ...updatedFilterScopeMap,
        [key]: updatedEntry,
      },
    }));
  }

  onExpandFilterScope(expanded = []) {
    const { activeFilterField, checkedFilterFields, filterScopeMap } =
      this.state;
    const key = getKeyForFilterScopeTree({
      activeFilterField,
      checkedFilterFields,
    });
    const updatedEntry = {
      ...filterScopeMap[key],
      expanded,
    };
    this.setState(() => ({
      filterScopeMap: {
        ...filterScopeMap,
        [key]: updatedEntry,
      },
    }));
  }

  onCheckFilterField(checkedFilterFields = []) {
    const { layout } = this.props;
    const { filterScopeMap } = this.state;
    const filterScopeTreeEntry = buildFilterScopeTreeEntry({
      checkedFilterFields,
      activeFilterField: null,
      filterScopeMap,
      layout,
    });

    this.setState(() => ({
      activeFilterField: null,
      checkedFilterFields,
      filterScopeMap: {
        ...filterScopeMap,
        ...filterScopeTreeEntry,
      },
    }));
  }

  onExpandFilterField(expandedFilterIds = []) {
    this.setState(() => ({
      expandedFilterIds,
    }));
  }

  onChangeFilterField(filterField = {}) {
    const { layout } = this.props;
    const nextActiveFilterField = filterField.value;
    const {
      activeFilterField: currentActiveFilterField,
      checkedFilterFields,
      filterScopeMap,
    } = this.state;

    // we allow single edit and multiple edit in the same view.
    // if user click on the single filter field,
    // will show filter scope for the single field.
    // if user click on the same filter filed again,
    // will toggle off the single filter field,
    // and allow multi-edit all checked filter fields.
    if (nextActiveFilterField === currentActiveFilterField) {
      const filterScopeTreeEntry = buildFilterScopeTreeEntry({
        checkedFilterFields,
        activeFilterField: null,
        filterScopeMap,
        layout,
      });

      this.setState({
        activeFilterField: null,
        filterScopeMap: {
          ...filterScopeMap,
          ...filterScopeTreeEntry,
        },
      });
    } else if (this.allfilterFields.includes(nextActiveFilterField)) {
      const filterScopeTreeEntry = buildFilterScopeTreeEntry({
        checkedFilterFields,
        activeFilterField: nextActiveFilterField,
        filterScopeMap,
        layout,
      });

      this.setState({
        activeFilterField: nextActiveFilterField,
        filterScopeMap: {
          ...filterScopeMap,
          ...filterScopeTreeEntry,
        },
      });
    }
  }

  onSearchInputChange(e) {
    this.setState({ searchText: e.target.value }, this.filterTree);
  }

  onClose() {
    this.props.onCloseModal();
  }

  onSave() {
    const { filterScopeMap } = this.state;

    const allFilterFieldScopes = this.allfilterFields.reduce(
      (map, filterKey) => {
        const { nodes } = filterScopeMap[filterKey];
        const checkedChartIds = filterScopeMap[filterKey].checked;

        return {
          ...map,
          [filterKey]: getFilterScopeFromNodesTree({
            filterKey,
            nodes,
            checkedChartIds,
          }),
        };
      },
      {},
    );

    this.props.updateDashboardFiltersScope(allFilterFieldScopes);
    this.props.setUnsavedChanges(true);

    // click Save button will do save and close modal
    this.props.onCloseModal();
  }

  filterTree() {
    // Reset nodes back to unfiltered state
    if (!this.state.searchText) {
      this.setState(prevState => {
        const { activeFilterField, checkedFilterFields, filterScopeMap } =
          prevState;
        const key = getKeyForFilterScopeTree({
          activeFilterField,
          checkedFilterFields,
        });

        const updatedEntry = {
          ...filterScopeMap[key],
          nodesFiltered: filterScopeMap[key].nodes,
        };
        return {
          filterScopeMap: {
            ...filterScopeMap,
            [key]: updatedEntry,
          },
        };
      });
    } else {
      const updater = prevState => {
        const { activeFilterField, checkedFilterFields, filterScopeMap } =
          prevState;
        const key = getKeyForFilterScopeTree({
          activeFilterField,
          checkedFilterFields,
        });

        const nodesFiltered = filterScopeMap[key].nodes.reduce(
          this.filterNodes,
          [],
        );
        const expanded = getFilterScopeParentNodes([...nodesFiltered]);
        const updatedEntry = {
          ...filterScopeMap[key],
          nodesFiltered,
          expanded,
        };

        return {
          filterScopeMap: {
            ...filterScopeMap,
            [key]: updatedEntry,
          },
        };
      };

      this.setState(updater);
    }
  }

  filterNodes(filtered = [], node = {}) {
    const { searchText } = this.state;
    const children = (node.children || []).reduce(this.filterNodes, []);

    if (
      // Node's label matches the search string
      node.label.toLocaleLowerCase().indexOf(searchText.toLocaleLowerCase()) >
        -1 ||
      // Or a children has a matching node
      children.length
    ) {
      filtered.push({ ...node, children });
    }

    return filtered;
  }

  renderFilterFieldList() {
    const {
      activeFilterField,
      filterFieldNodes,
      checkedFilterFields,
      expandedFilterIds,
    } = this.state;
    return (
      <FilterFieldTree
        activeKey={activeFilterField}
        nodes={filterFieldNodes}
        checked={checkedFilterFields}
        expanded={expandedFilterIds}
        onClick={this.onChangeFilterField}
        onCheck={this.onCheckFilterField}
        onExpand={this.onExpandFilterField}
      />
    );
  }

  renderFilterScopeTree() {
    const {
      filterScopeMap,
      activeFilterField,
      checkedFilterFields,
      searchText,
    } = this.state;

    const key = getKeyForFilterScopeTree({
      activeFilterField,
      checkedFilterFields,
    });

    const selectedChartId = getSelectedChartIdForFilterScopeTree({
      activeFilterField,
      checkedFilterFields,
    });
    return (
      <>
        <input
          className="filter-text scope-search multi-edit-mode"
          placeholder={t('Search...')}
          type="text"
          value={searchText}
          onChange={this.onSearchInputChange}
        />
        <FilterScopeTree
          nodes={filterScopeMap[key].nodesFiltered}
          checked={filterScopeMap[key].checked}
          expanded={filterScopeMap[key].expanded}
          onCheck={this.onCheckFilterScope}
          onExpand={this.onExpandFilterScope}
          // pass selectedFilterId prop to FilterScopeTree component,
          // to hide checkbox for selected filter field itself
          selectedChartId={selectedChartId}
        />
      </>
    );
  }

  renderEditingFiltersName() {
    const { dashboardFilters } = this.props;
    const { activeFilterField, checkedFilterFields } = this.state;
    const currentFilterLabels = []
      .concat(activeFilterField || checkedFilterFields)
      .map(key => {
        const { chartId, column } = getChartIdAndColumnFromFilterKey(key);
        return dashboardFilters[chartId].labels[column] || column;
      });

    return (
      <div className="selected-fields multi-edit-mode">
        {currentFilterLabels.length === 0 && t('No filter is selected.')}
        {currentFilterLabels.length === 1 && t('Editing 1 filter:')}
        {currentFilterLabels.length > 1 &&
          t('Batch editing %d filters:', currentFilterLabels.length)}
        <span className="selected-scopes">
          {currentFilterLabels.join(', ')}
        </span>
      </div>
    );
  }

  render() {
    const { showSelector } = this.state;

    return (
      <ScopeContainer>
        <ScopeHeader>
          <h4>{t('Configure filter scopes')}</h4>
          {showSelector && this.renderEditingFiltersName()}
        </ScopeHeader>

        <ScopeBody className="filter-scope-body">
          {!showSelector ? (
            <div className="warning-message">
              {t('There are no filters in this dashboard.')}
            </div>
          ) : (
            <ScopeSelector className="filters-scope-selector">
              <div className={cx('filter-field-pane multi-edit-mode')}>
                {this.renderFilterFieldList()}
              </div>
              <div className="filter-scope-pane multi-edit-mode">
                {this.renderFilterScopeTree()}
              </div>
            </ScopeSelector>
          )}
        </ScopeBody>

        <ActionsContainer>
          <Button buttonSize="small" onClick={this.onClose}>
            {t('Close')}
          </Button>
          {showSelector && (
            <Button
              buttonSize="small"
              buttonStyle="primary"
              onClick={this.onSave}
            >
              {t('Save')}
            </Button>
          )}
        </ActionsContainer>
      </ScopeContainer>
    );
  }
}

FilterScopeSelector.propTypes = propTypes;
