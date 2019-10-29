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
import { safeStringify } from '../../../utils/safeStringify';

import getFilterScopeNodesTree from '../../util/getFilterScopeNodesTree';
import getFilterFieldNodesTree from '../../util/getFilterFieldNodesTree';
import getFilterScopeParentNodes from '../../util/getFilterScopeParentNodes';
import getCurrentScopeChartIds from '../../util/getCurrentScopeChartIds';
import getRevertedFilterScope from '../../util/getRevertedFilterScope';
import FilterScopeTree from './FilterScopeTree';
import FilterFieldTree from './FilterFieldTree';
import {
  getChartIdAndColumnFromFilterKey,
  getDashboardFilterKey,
} from '../../util/getDashboardFilterKey';

const propTypes = {
  dashboardFilters: PropTypes.object.isRequired,
  layout: PropTypes.object.isRequired,
  filterImmuneSlices: PropTypes.arrayOf(PropTypes.number).isRequired,
  filterImmuneSliceFields: PropTypes.object.isRequired,
  setDirectPathToChild: PropTypes.func.isRequired,
  onCloseModal: PropTypes.func.isRequired,
};

export default class FilterScopeSelector extends React.PureComponent {
  constructor(props) {
    super(props);

    const {
      dashboardFilters,
      filterImmuneSlices,
      filterImmuneSliceFields,
      layout,
    } = props;

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

      if (filterFieldNodes.length && filterFieldNodes[0].children) {
        this.defaultFilterKey = filterFieldNodes[0].children[0].value;
      }
      const checkedFilterFields = [this.defaultFilterKey];
      // expand defaultFilterKey
      const { chartId } = getChartIdAndColumnFromFilterKey(
        this.defaultFilterKey,
      );
      const expandedFilterIds = [chartId];

      // display checkbox tree of whole dashboard layout
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
                isSingleEditMode: true,
                checkedFilterFields,
                selectedChartId: filterId,
              });
              const checked = getCurrentScopeChartIds({
                scopeComponentIds: ['ROOT_ID'], // dashboardFilters[chartId].scopes[columnName],
                filterField: columnName,
                filterImmuneSlices,
                filterImmuneSliceFields,
                components: layout,
              });
              const expanded = getFilterScopeParentNodes(nodes, 1);
              return {
                ...mapByChartId,
                [filterKey]: {
                  // unfiltered nodes
                  nodes,
                  // filtered nodes in display if searchText is not empty
                  nodesFiltered: nodes.slice(),
                  checked,
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
    this.onCheckFilterField = this.onCheckFilterField.bind(this);
    this.onExpandFilterField = this.onExpandFilterField.bind(this);
    this.onClose = this.onClose.bind(this);
    this.onSave = this.onSave.bind(this);
  }

  onCheckFilterScope(checked = []) {
    const {
      activeKey,
      filterScopeMap,
      isSingleEditMode,
      checkedFilterFields,
    } = this.state;

    if (isSingleEditMode) {
      const updatedEntry = {
        ...filterScopeMap[activeKey],
        checked: checked.map(c => parseInt(c, 10)),
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

  onExpandFilterScope(expanded = []) {
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

  onCheckFilterField(checkedFilterFields = []) {
    const { layout } = this.props;
    const { isSingleEditMode, filterScopeMap } = this.state;
    const nodes = getFilterScopeNodesTree({
      components: layout,
      isSingleEditMode,
      checkedFilterFields,
    });
    const activeKey = safeStringify(checkedFilterFields);
    const checkedChartIdSet = new Set();
    checkedFilterFields.forEach(filterField => {
      (filterScopeMap[filterField].checked || []).forEach(chartId => {
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
          nodesFiltered: [...nodes],
          checked: [...checkedChartIdSet],
          expanded: getFilterScopeParentNodes(nodes, 1),
        },
      },
    }));
  }

  onExpandFilterField(expandedFilterIds = []) {
    this.setState(() => ({
      expandedFilterIds,
    }));
  }

  onSearchInputChange(e) {
    this.setState({ searchText: e.target.value }, this.filterTree);
  }

  onChangeFilterField(filterField = {}) {
    const nextActiveKey = filterField.value;
    const {
      isSingleEditMode,
      activeKey: currentActiveKey,
      checkedFilterFields,
    } = this.state;

    // multi-edit mode: if user click on the single filter field,
    // will show filter scope for the single field.
    // if user click on the same filter filed again,
    // will toggle activeKey back to group selected fields
    if (!isSingleEditMode && nextActiveKey === currentActiveKey) {
      this.onCheckFilterField(checkedFilterFields);
    } else if (this.allfilterFields.includes(nextActiveKey)) {
      this.setState({ activeKey: nextActiveKey });
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

    console.log(
      'i am current state',
      this.allfilterFields.reduce(
        (map, key) => ({
          ...map,
          [key]: filterScopeMap[key].checked,
        }),
        {},
      ),
    );
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
    } else {
      const updater = prevState => {
        const { activeKey, filterScopeMap } = prevState;
        const nodesFiltered = filterScopeMap[activeKey].nodes.reduce(
          this.filterNodes,
          [],
        );
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
      activeKey,
      filterFieldNodes,
      checkedFilterFields,
      expandedFilterIds,
    } = this.state;
    return (
      <FilterFieldTree
        activeKey={activeKey}
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
      activeKey,
      isSingleEditMode,
      searchText,
    } = this.state;

    const selectedFilterId = isSingleEditMode
      ? getChartIdAndColumnFromFilterKey(activeKey).chartId
      : 0;
    return (
      <React.Fragment>
        <input
          className={cx('filter-text scope-search', {
            'multi-edit-mode': !isSingleEditMode,
          })}
          placeholder={t('Search...')}
          type="text"
          value={searchText}
          onChange={this.onSearchInputChange}
        />
        <FilterScopeTree
          nodes={filterScopeMap[activeKey].nodesFiltered}
          checked={filterScopeMap[activeKey].checked}
          expanded={filterScopeMap[activeKey].expanded}
          onCheck={this.onCheckFilterScope}
          onExpand={this.onExpandFilterScope}
          // pass selectedFilterId prop to FilterScopeTree component,
          // to hide checkbox for selected filter field itself
          selectedFilterId={selectedFilterId}
        />
      </React.Fragment>
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
    const { dashboardFilters } = this.props;
    const { showSelector, isSingleEditMode, activeKey } = this.state;
    const isSingleValue = activeKey.indexOf('[') === -1;
    const currentFilterLabels = []
      .concat(isSingleValue ? activeKey : JSON.parse(activeKey))
      .map(key => {
        const { chartId, column } = getChartIdAndColumnFromFilterKey(key);
        return dashboardFilters[chartId].labels[column] || column;
      });

    return (
      <React.Fragment>
        <div className="filter-scope-container">
          <div className="filter-scope-header">
            <h4>{t('Configure filter scopes')}</h4>
            <div
              className={cx('selected-fields', {
                'multi-edit-mode': !isSingleEditMode,
              })}
            >
              {`Batch editing ${currentFilterLabels.length} filters: `}
              <span className="selected-scopes">
                {currentFilterLabels.join(', ')}
              </span>
            </div>
          </div>

          {!showSelector ? (
            <div>{t('There are no filter in this dashboard')}</div>
          ) : (
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
