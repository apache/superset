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
import { Button } from 'react-bootstrap';
import { t } from '@superset-ui/translation';

import getFilterScopeNodesTree from '../../util/getFilterScopeNodesTree';
import getFilterFieldNodesTree from '../../util/getFilterFieldNodesTree';
import getFilterScopeParentNodes from '../../util/getFilterScopeParentNodes';
import getFilterScopeFromNodesTree from '../../util/getFilterScopeFromNodesTree';
import getRevertedFilterScope from '../../util/getRevertedFilterScope';
import FilterScopeTree from './FilterScopeTree';
import FilterFieldTree from './FilterFieldTree';
import { getChartIdsInFilterScope } from '../../util/activeDashboardFilters';
import { getDashboardFilterKey } from '../../util/getDashboardFilterKey';
import { dashboardFilterPropShape } from '../../util/propShapes';

const propTypes = {
  dashboardFilters: dashboardFilterPropShape.isRequired,
  layout: PropTypes.object.isRequired,

  updateDashboardFiltersScope: PropTypes.func.isRequired,
  setUnsavedChanges: PropTypes.func.isRequired,
  onCloseModal: PropTypes.func.isRequired,
};

export default class FilterScopeSelector extends React.PureComponent {
  constructor(props) {
    super(props);

    const { dashboardFilters, layout } = props;

    if (Object.keys(dashboardFilters).length > 0) {
      // display filter fields in tree structure
      const filterFieldNodes = getFilterFieldNodesTree({
        dashboardFilters,
        isSingleEditMode: true,
      });
      this.allfilterFields = [];
      filterFieldNodes.forEach(({ children }) => {
        children.forEach(child => {
          this.allfilterFields.push(child.value);
        });
      });

      this.defaultFilterKey = Object.keys(filterFieldNodes).length
        ? filterFieldNodes[0].children[0].value
        : '';
      const checkedFilterFields = [this.defaultFilterKey];
      // do not expand filter box
      const expandedFilterIds = [];

      // display whole dashboard layout in tree structure
      const nodes = getFilterScopeNodesTree({
        components: layout,
        isSingleEditMode: true,
        checkedFilterFields,
      });
      const expanded = getFilterScopeParentNodes(nodes, 1);
      const filterScopeMap = Object.values(dashboardFilters).reduce(
        (map, { chartId, columns }) => {
          const filterScopeByChartId = Object.keys(columns).reduce(
            (mapByChartId, columnName) => {
              const filterKey = getDashboardFilterKey(chartId, columnName);
              const chartIdsInFilterScope = getChartIdsInFilterScope({
                filterScope: dashboardFilters[chartId].scopes[columnName],
              });
              // remove filter's id from its scope
              chartIdsInFilterScope.splice(
                chartIdsInFilterScope.indexOf(chartId),
                1,
              );
              return {
                ...mapByChartId,
                [filterKey]: {
                  // unfiltered nodes
                  nodes,
                  // filtered nodes in display if searchText is not empty
                  nodesFiltered: nodes.slice(),
                  checked: chartIdsInFilterScope.slice(),
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

      this.state = {
        showSelector: true,
        activeKey: this.defaultFilterKey,
        searchText: '',
        filterScopeMap,
        filterFieldNodes,
        checkedFilterFields,
        expandedFilterIds,
        isSingleEditMode: true,
      };
    } else {
      this.state = {
        showSelector: false,
      };
    }

    this.filterNodes = this.filterNodes.bind(this);
    this.onChangeFilterField = this.onChangeFilterField.bind(this);
    this.onToggleEditMode = this.onToggleEditMode.bind(this);
    this.onCheckFilterScope = this.onCheckFilterScope.bind(this);
    this.onExpandFilterScope = this.onExpandFilterScope.bind(this);
    this.onSearchInputChange = this.onSearchInputChange.bind(this);
    this.onClickFilterField = this.onClickFilterField.bind(this);
    this.onCheckFilterField = this.onCheckFilterField.bind(this);
    this.onExpandFilterField = this.onExpandFilterField.bind(this);
    this.onClose = this.onClose.bind(this);
    this.onSave = this.onSave.bind(this);
  }

  onCheckFilterScope(checked) {
    const {
      activeKey,
      filterScopeMap,
      isSingleEditMode,
      checkedFilterFields,
    } = this.state;

    if (isSingleEditMode) {
      const updatedEntry = {
        ...filterScopeMap[activeKey],
        checked: checked.map(c => JSON.parse(c)),
      };

      this.setState(() => ({
        filterScopeMap: {
          ...filterScopeMap,
          [activeKey]: updatedEntry,
        },
      }));
    } else {
      // multi edit mode: update every scope in checkedFilterFields based on grouped selection
      const updatedEntry = {
        ...filterScopeMap[activeKey],
        checked,
      };

      const updatedFilterScopeMap = getRevertedFilterScope({
        checked,
        checkedFilterFields,
        filterScopeMap,
      });

      this.setState(() => ({
        filterScopeMap: {
          ...filterScopeMap,
          ...updatedFilterScopeMap,
          [activeKey]: updatedEntry,
        },
      }));
    }
  }

  onExpandFilterScope(expanded) {
    const { activeKey, filterScopeMap } = this.state;
    const updatedEntry = {
      ...filterScopeMap[activeKey],
      expanded,
    };
    this.setState(() => ({
      filterScopeMap: {
        ...filterScopeMap,
        [activeKey]: updatedEntry,
      },
    }));
  }

  onClickFilterField(filterField) {
    this.onChangeFilterField(filterField.value);
  }

  onCheckFilterField(checkedFilterFields) {
    const { layout } = this.props;
    const { isSingleEditMode, filterScopeMap } = this.state;
    const nodes = getFilterScopeNodesTree({
      components: layout,
      isSingleEditMode,
      checkedFilterFields,
    });
    const activeKey = `[${checkedFilterFields.join(',')}]`;
    const checkedChartIdSet = new Set();
    checkedFilterFields.forEach(filterField => {
      filterScopeMap[filterField].checked.forEach(chartId => {
        checkedChartIdSet.add(`${chartId}:${filterField}`);
      });
    });

    this.setState(() => ({
      activeKey,
      checkedFilterFields,
      filterScopeMap: {
        ...filterScopeMap,
        [activeKey]: {
          nodes,
          nodesFiltered: nodes.slice(),
          checked: [...checkedChartIdSet],
          expanded: getFilterScopeParentNodes(nodes, 1),
        },
      },
    }));
  }

  onExpandFilterField(expandedFilterIds) {
    this.setState(() => ({
      expandedFilterIds,
    }));
  }

  onSearchInputChange(e) {
    this.setState({ searchText: e.target.value }, this.filterTree);
  }

  onChangeFilterField(activeKey) {
    if (this.allfilterFields.includes(activeKey)) {
      this.setState({ activeKey });
    }
  }

  onToggleEditMode() {
    const { activeKey, isSingleEditMode, checkedFilterFields } = this.state;
    const { dashboardFilters } = this.props;
    if (isSingleEditMode) {
      // single edit => multi edit
      this.setState(
        {
          isSingleEditMode: false,
          checkedFilterFields: [activeKey],
          filterFieldNodes: getFilterFieldNodesTree({
            dashboardFilters,
            isSingleEditMode: false,
          }),
        },
        () => this.onCheckFilterField([activeKey]),
      );
    } else {
      // multi edit => single edit
      const nextActiveKey =
        checkedFilterFields.length === 0
          ? this.defaultFilterKey
          : checkedFilterFields[0];

      this.setState(() => ({
        isSingleEditMode: true,
        activeKey: nextActiveKey,
        checkedFilterFields: [activeKey],
        filterFieldNodes: getFilterFieldNodesTree({
          dashboardFilters,
          isSingleEditMode: true,
        }),
      }));
    }
  }

  onClose() {
    this.props.onCloseModal();
  }

  onSave() {
    const { filterScopeMap } = this.state;

    const currentFiltersState = this.allfilterFields.reduce(
      (map, key) => ({
        ...map,
        [key]: {
          nodes: filterScopeMap[key].nodes,
          checked: filterScopeMap[key].checked,
        },
      }),
      {},
    );
    console.log('i am current state', currentFiltersState);
    this.props.updateDashboardFiltersScope(
      getFilterScopeFromNodesTree(currentFiltersState),
    );
    this.props.setUnsavedChanges(true);
    this.props.onCloseModal();
  }

  filterTree() {
    // Reset nodes back to unfiltered state
    if (!this.state.searchText) {
      this.setState(prevState => {
        const { activeKey, filterScopeMap } = prevState;
        const updatedEntry = {
          ...filterScopeMap[activeKey],
          nodesFiltered: filterScopeMap[activeKey].nodes,
        };
        return {
          filterScopeMap: {
            ...filterScopeMap,
            [activeKey]: updatedEntry,
          },
        };
      });

      return;
    }

    const updater = prevState => {
      const { activeKey, filterScopeMap } = prevState;
      const nodesFiltered = filterScopeMap[activeKey].nodes.reduce(this.filterNodes, []);
      const updatedEntry = {
        ...filterScopeMap[activeKey],
        nodesFiltered,
      };
      return {
        filterScopeMap: {
          ...filterScopeMap,
          [activeKey]: updatedEntry,
        },
      };
    };

    this.setState(updater);
  }

  filterNodes(filtered, node) {
    const { searchText } = this.state;
    const children = (node.children || []).reduce(this.filterNodes, []);

    if (
      // Node's label matches the search string
      node.label.toLocaleLowerCase().indexOf(searchText.toLocaleLowerCase()) > -1 ||
      // Or a children has a matching node
      children.length
    ) {
      filtered.push({ ...node, children });
    }

    return filtered;
  }

  renderFilterFieldList() {
    const {
      filterFieldNodes,
      checkedFilterFields,
      expandedFilterIds,
    } = this.state;
    return (
      <FilterFieldTree
        nodes={filterFieldNodes}
        checked={checkedFilterFields}
        expanded={expandedFilterIds}
        onClick={this.onClickFilterField}
        onCheck={this.onCheckFilterField}
        onExpand={this.onExpandFilterField}
      />
    );
  }

  renderFilterScopeTree() {
    const { filterScopeMap, activeKey: key } = this.state;
    return (
      <FilterScopeTree
        nodes={filterScopeMap[key].nodesFiltered}
        checked={filterScopeMap[key].checked}
        expanded={filterScopeMap[key].expanded}
        onCheck={this.onCheckFilterScope}
        onExpand={this.onExpandFilterScope}
      />
    );
  }

  renderEditModeControl() {
    const { isSingleEditMode } = this.state;
    return (
      <span
        role="button"
        tabIndex="0"
        className="edit-mode-toggle"
        onClick={this.onToggleEditMode}
      >
        {isSingleEditMode
          ? t('Edit multiple filters')
          : t('Edit individual filter')}
      </span>
    );
  }

  render() {
    const { showSelector, searchText, isSingleEditMode } = this.state;

    return (
      <React.Fragment>
        <div className="filter-scope-container">
          <div className="filter-scope-header">
            <h4>{t('Configure filter scopes')}</h4>
            <input
              className={cx('filter-text', {
                'multi-edit-mode': !isSingleEditMode,
              })}
              placeholder="Search..."
              type="text"
              value={searchText}
              onChange={this.onSearchInputChange}
            />
          </div>

          {!showSelector && <div>There is no filter in this dashboard</div>}

          {showSelector && (
            <div className="filters-scope-selector">
              <div
                className={cx('filter-field-pane', {
                  'multi-edit-mode': !isSingleEditMode,
                })}
              >
                {this.renderEditModeControl()}
                {this.renderFilterFieldList()}
              </div>
              <div
                className={cx('filter-scope-pane', {
                  'multi-edit-mode': !isSingleEditMode,
                })}
              >
                {this.renderFilterScopeTree()}
              </div>
            </div>
          )}
        </div>
        <div className="dashboard-modal-actions-container">
          <Button onClick={this.onClose}>{t('Cancel')}</Button>
          {showSelector && (
            <Button bsStyle="primary" onClick={this.onSave}>
              {t('Save')}
            </Button>
          )}
        </div>
      </React.Fragment>
    );
  }
}

FilterScopeSelector.propTypes = propTypes;
