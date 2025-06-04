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
import { PureComponent } from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import { Button, Input } from '@superset-ui/core/components';
import { css, t, styled } from '@superset-ui/core';

import buildFilterScopeTreeEntry from 'src/dashboard/util/buildFilterScopeTreeEntry';
import getFilterScopeNodesTree from 'src/dashboard/util/getFilterScopeNodesTree';
import getFilterFieldNodesTree from 'src/dashboard/util/getFilterFieldNodesTree';
import getFilterScopeParentNodes from 'src/dashboard/util/getFilterScopeParentNodes';
import getKeyForFilterScopeTree from 'src/dashboard/util/getKeyForFilterScopeTree';
import getSelectedChartIdForFilterScopeTree from 'src/dashboard/util/getSelectedChartIdForFilterScopeTree';
import getFilterScopeFromNodesTree from 'src/dashboard/util/getFilterScopeFromNodesTree';
import getRevertedFilterScope from 'src/dashboard/util/getRevertedFilterScope';
import { getChartIdsInFilterScope } from 'src/dashboard/util/activeDashboardFilters';
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
    margin-right: ${theme.sizeUnit * -6}px;
    font-size: ${theme.fontSize}px;

    & .nav.nav-tabs {
      border: none;
    }

    & .filter-scope-body {
      flex: 1;
      max-height: calc(100% - ${theme.sizeUnit * 32}px);

      .filter-field-pane,
      .filter-scope-pane {
        overflow-y: auto;
      }
    }

    & .warning-message {
      padding: ${theme.sizeUnit * 6}px;
    }
  `}
`;

const ScopeBody = styled.div`
  ${({ theme }) => css`
    &.filter-scope-body {
      flex: 1;
      max-height: calc(100% - ${theme.sizeUnit * 32}px);

      .filter-field-pane,
      .filter-scope-pane {
        overflow-y: auto;
      }
    }
  `}
`;

const ScopeHeader = styled.div`
  ${({ theme }) => css`
    height: ${theme.sizeUnit * 16}px;
    border-bottom: 1px solid ${theme.colorSplit};
    padding-left: ${theme.sizeUnit * 6}px;
    margin-left: ${theme.sizeUnit * -6}px;

    h4 {
      margin-top: 0;
    }

    .selected-fields {
      margin: ${theme.sizeUnit * 3}px 0 ${theme.sizeUnit * 4}px;
      visibility: hidden;

      &.multi-edit-mode {
        visibility: visible;
      }

      .selected-scopes {
        padding-left: ${theme.sizeUnit}px;
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
        font-family: ${theme.fontFamily};
        font-size: ${theme.fontSize}px;
        color: ${theme.colorPrimary};

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
        padding: ${theme.sizeUnit * 4}px;
        padding-left: 0;
        border-right: 1px solid ${theme.colorBorder};

        .filter-container label {
          font-weight: ${theme.fontWeightNormal};
          margin: 0 0 0 ${theme.sizeUnit * 4}px;
          word-break: break-all;
        }

        .filter-field-item {
          height: ${theme.sizeUnit * 9}px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 ${theme.sizeUnit * 6}px;
          margin-left: ${theme.sizeUnit * -6}px;

          &.is-selected {
            border: 1px solid ${theme.colorBorder};
            border-radius: ${theme.borderRadius}px;
            background-color: ${theme.colorBgContainer};
            margin-left: ${theme.sizeUnit * -6}px;
          }
        }

        .react-checkbox-tree {
          .rct-title .root {
            font-weight: ${theme.fontWeightStrong};
          }

          .rct-text {
            height: ${theme.sizeUnit * 10}px;
          }
        }
      }

      .filter-scope-pane {
        position: relative;
        flex: 1;
        padding: ${theme.sizeUnit * 4}px;
        padding-right: ${theme.sizeUnit * 6}px;
      }

      .react-checkbox-tree {
        flex-direction: column;
        color: ${theme.colorText};
        font-size: ${theme.fontSize}px;

        .filter-scope-type {
          padding: ${theme.sizeUnit * 2}px 0;
          display: flex;
          align-items: center;

          &.chart {
            font-weight: ${theme.fontWeightNormal};
          }

          &.selected-filter {
            padding-left: ${theme.sizeUnit * 7}px;
            position: relative;
            // @ts-expect-error TS(2339): Property 'colorBgContainerTextActive' does not exi... Remove this comment to see the full error message
            color: ${theme.colorBgContainerTextActive};

            &::before {
              content: ' ';
              position: absolute;
              left: 0;
              top: 50%;
              width: ${theme.sizeUnit * 4}px;
              height: ${theme.sizeUnit * 4}px;
              border-radius: ${theme.borderRadius}px;
              margin-top: ${theme.sizeUnit * -2}px;
              box-shadow: inset 0 0 0 2px ${theme.colorBorder};
              background: ${theme.colors.grayscale.light3};
            }
          }

          &.root {
            font-weight: ${theme.fontWeightStrong};
          }
        }

        .rct-checkbox {
          svg {
            position: relative;
            top: 3px;
            width: ${theme.sizeUnit * 4.5}px;
          }
        }

        .rct-node-leaf {
          .rct-bare-label {
            &::before {
              padding-left: ${theme.sizeUnit}px;
            }
          }
        }

        .rct-options {
          text-align: left;
          margin-left: 0;
          margin-bottom: ${theme.sizeUnit * 2}px;
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
        .filter-field-item {
          padding: 0 ${theme.sizeUnit * 4}px 0 ${theme.sizeUnit * 12}px;
          margin-left: ${theme.sizeUnit * -12}px;

          &.is-selected {
            margin-left: ${theme.sizeUnit * -13}px;
          }
        }
      }

      .scope-search {
        position: absolute;
        right: ${theme.sizeUnit * 4}px;
        top: ${theme.sizeUnit * 4}px;
        border-radius: ${theme.borderRadius}px;
        border: 1px solid ${theme.colorBorder};
        padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
        font-size: ${theme.fontSize}px;
        outline: none;

        &:focus {
          border: 1px solid ${theme.colorPrimary};
        }
      }
    }
  `}
`;

const ActionsContainer = styled.div`
  ${({ theme }) => `
    height: ${theme.sizeUnit * 16}px;

    border-top: ${theme.sizeUnit / 4}px solid ${theme.colors.primary.light3};
    padding: ${theme.sizeUnit * 6}px;
    margin: 0 0 0 ${-theme.sizeUnit * 6}px;
    text-align: right;

    .btn {
      margin-right: ${theme.sizeUnit * 4}px;

      &:last-child {
        margin-right: 0;
      }
    }
  `}
`;

export default class FilterScopeSelector extends PureComponent {
  allfilterFields: $TSFixMe;

  defaultFilterKey: $TSFixMe;

  constructor(props: $TSFixMe) {
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
              // @ts-expect-error TS(2345): Argument of type 'any[]' is not assignable to para... Remove this comment to see the full error message
              const expanded = getFilterScopeParentNodes(nodes, 1);
              const chartIdsInFilterScope = (
                getChartIdsInFilterScope({
                  filterScope: dashboardFilters[filterId].scopes[columnName],
                }) || []
              )
                // @ts-expect-error TS(7006): Parameter 'id' implicitly has an 'any' type.
                .filter(id => id !== filterId);

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
            // @ts-expect-error TS(2698): Spread types may only be created from object types... Remove this comment to see the full error message
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
      const checkedFilterFields: $TSFixMe = [];
      const activeFilterField = this.defaultFilterKey;
      // expand defaultFilterKey in filter field tree
      // @ts-expect-error TS(2769): No overload matches this call.
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
          // @ts-expect-error TS(2698): Spread types may only be created from object types... Remove this comment to see the full error message
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
    // @ts-expect-error TS(2339): Property 'activeFilterField' does not exist on typ... Remove this comment to see the full error message
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
    // @ts-expect-error TS(2339): Property 'activeFilterField' does not exist on typ... Remove this comment to see the full error message
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
    // @ts-expect-error TS(2339): Property 'layout' does not exist on type 'Readonly... Remove this comment to see the full error message
    const { layout } = this.props;
    // @ts-expect-error TS(2339): Property 'filterScopeMap' does not exist on type '... Remove this comment to see the full error message
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
    // @ts-expect-error TS(2339): Property 'layout' does not exist on type 'Readonly... Remove this comment to see the full error message
    const { layout } = this.props;
    // @ts-expect-error TS(2339): Property 'value' does not exist on type '{}'.
    const nextActiveFilterField = filterField.value;
    const {
      // @ts-expect-error TS(2339): Property 'activeFilterField' does not exist on typ... Remove this comment to see the full error message
      activeFilterField: currentActiveFilterField,
      // @ts-expect-error TS(2339): Property 'checkedFilterFields' does not exist on t... Remove this comment to see the full error message
      checkedFilterFields,
      // @ts-expect-error TS(2339): Property 'filterScopeMap' does not exist on type '... Remove this comment to see the full error message
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

  onSearchInputChange(e: $TSFixMe) {
    this.setState({ searchText: e.target.value }, this.filterTree);
  }

  onClose() {
    // @ts-expect-error TS(2339): Property 'onCloseModal' does not exist on type 'Re... Remove this comment to see the full error message
    this.props.onCloseModal();
  }

  onSave() {
    // @ts-expect-error TS(2339): Property 'filterScopeMap' does not exist on type '... Remove this comment to see the full error message
    const { filterScopeMap } = this.state;

    const allFilterFieldScopes = this.allfilterFields.reduce(
      (map: $TSFixMe, filterKey: $TSFixMe) => {
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

    // @ts-expect-error TS(2339): Property 'updateDashboardFiltersScope' does not ex... Remove this comment to see the full error message
    this.props.updateDashboardFiltersScope(allFilterFieldScopes);
    // @ts-expect-error TS(2339): Property 'setUnsavedChanges' does not exist on typ... Remove this comment to see the full error message
    this.props.setUnsavedChanges(true);

    // click Save button will do save and close modal
    // @ts-expect-error TS(2339): Property 'onCloseModal' does not exist on type 'Re... Remove this comment to see the full error message
    this.props.onCloseModal();
  }

  filterTree() {
    // Reset nodes back to unfiltered state
    // @ts-expect-error TS(2339): Property 'searchText' does not exist on type 'Read... Remove this comment to see the full error message
    if (!this.state.searchText) {
      this.setState(prevState => {
        // @ts-expect-error TS(2339): Property 'activeFilterField' does not exist on typ... Remove this comment to see the full error message
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
      const updater = (prevState: $TSFixMe) => {
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
        // @ts-expect-error TS(2345): Argument of type 'any[]' is not assignable to para... Remove this comment to see the full error message
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
    // @ts-expect-error TS(2339): Property 'searchText' does not exist on type 'Read... Remove this comment to see the full error message
    const { searchText } = this.state;
    // @ts-expect-error TS(2339): Property 'children' does not exist on type '{}'.
    const children = (node.children || []).reduce(this.filterNodes, []);

    if (
      // Node's label matches the search string
      // @ts-expect-error TS(2339): Property 'label' does not exist on type '{}'.
      node.label.toLocaleLowerCase().indexOf(searchText.toLocaleLowerCase()) >
        -1 ||
      // Or a children has a matching node
      children.length
    ) {
      // @ts-expect-error TS(2322): Type 'any' is not assignable to type 'never'.
      filtered.push({ ...node, children });
    }

    return filtered;
  }

  renderFilterFieldList() {
    const {
      // @ts-expect-error TS(2339): Property 'activeFilterField' does not exist on typ... Remove this comment to see the full error message
      activeFilterField,
      // @ts-expect-error TS(2339): Property 'filterFieldNodes' does not exist on type... Remove this comment to see the full error message
      filterFieldNodes,
      // @ts-expect-error TS(2339): Property 'checkedFilterFields' does not exist on t... Remove this comment to see the full error message
      checkedFilterFields,
      // @ts-expect-error TS(2339): Property 'expandedFilterIds' does not exist on typ... Remove this comment to see the full error message
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
      // @ts-expect-error TS(2339): Property 'filterScopeMap' does not exist on type '... Remove this comment to see the full error message
      filterScopeMap,
      // @ts-expect-error TS(2339): Property 'activeFilterField' does not exist on typ... Remove this comment to see the full error message
      activeFilterField,
      // @ts-expect-error TS(2339): Property 'checkedFilterFields' does not exist on t... Remove this comment to see the full error message
      checkedFilterFields,
      // @ts-expect-error TS(2339): Property 'searchText' does not exist on type 'Read... Remove this comment to see the full error message
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
        <Input
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
    // @ts-expect-error TS(2339): Property 'dashboardFilters' does not exist on type... Remove this comment to see the full error message
    const { dashboardFilters } = this.props;
    // @ts-expect-error TS(2339): Property 'activeFilterField' does not exist on typ... Remove this comment to see the full error message
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
    // @ts-expect-error TS(2339): Property 'showSelector' does not exist on type 'Re... Remove this comment to see the full error message
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

// @ts-expect-error TS(2339): Property 'propTypes' does not exist on type 'typeo... Remove this comment to see the full error message
FilterScopeSelector.propTypes = propTypes;
