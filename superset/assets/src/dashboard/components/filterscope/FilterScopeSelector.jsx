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

import buildFilterScopeTreeEntry from '../../util/buildFilterScopeTreeEntry';
import getFilterScopeNodesTree from '../../util/getFilterScopeNodesTree';
import getFilterFieldNodesTree from '../../util/getFilterFieldNodesTree';
import getFilterScopeParentNodes from '../../util/getFilterScopeParentNodes';
import getCurrentScopeChartIds from '../../util/getCurrentScopeChartIds';
import getKeyForFilterScopeTree from '../../util/getKeyForFilterScopeTree';
import getSelectedChartIdForFilterScopeTree from '../../util/getSelectedChartIdForFilterScopeTree';
import getRevertedFilterScope from '../../util/getRevertedFilterScope';
import FilterScopeTree from './FilterScopeTree';
import FilterFieldTree from './FilterFieldTree';
import {
  getChartIdAndColumnFromFilterKey,
  getDashboardFilterKey,
} from '../../util/getDashboardFilterKey';
import { ALL_FILTERS } from '../../util/constants';

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
                  nodesFiltered: [...nodes],
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

      // initial state: active defaultFilerKey
      const { chartId } = getChartIdAndColumnFromFilterKey(
        this.defaultFilterKey,
      );
      const checkedFilterFields = [];
      const activeFilterField = this.defaultFilterKey;
      // expand defaultFilterKey in filter field tree
      const expandedFilterIds = [ALL_FILTERS].concat(chartId);

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
    const {
      activeFilterField,
      filterScopeMap,
      checkedFilterFields,
    } = this.state;

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
    const {
      activeFilterField,
      checkedFilterFields,
      filterScopeMap,
    } = this.state;
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
      activeFilterField: '',
      filterScopeMap,
      layout,
    });

    this.setState(() => ({
      activeFilterField: '',
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
        activeFilterField: '',
        filterScopeMap,
        layout,
      });

      this.setState({
        activeFilterField: '',
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

    // save do not close modal
  }

  filterTree() {
    // Reset nodes back to unfiltered state
    if (!this.state.searchText) {
      this.setState(prevState => {
        const {
          activeFilterField,
          checkedFilterFields,
          filterScopeMap,
        } = prevState;
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
        const {
          activeFilterField,
          checkedFilterFields,
          filterScopeMap,
        } = prevState;
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
      <React.Fragment>
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
      </React.Fragment>
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
        {currentFilterLabels.length === 0 && t('No filters are selected.')}
        {currentFilterLabels.length === 1 && t('Editing 1 filter: ')}
        {currentFilterLabels.length > 1 &&
          t('Batch editing %d filters: ', currentFilterLabels.length)}
        <span className="selected-scopes">
          {currentFilterLabels.join(', ')}
        </span>
      </div>
    );
  }

  render() {
    const { showSelector } = this.state;

    return (
      <React.Fragment>
        <div className="filter-scope-container">
          <div className="filter-scope-header">
            <h4>{t('Configure filter scopes')}</h4>
            {this.renderEditingFiltersName()}
          </div>

          {!showSelector ? (
            <div>{t('There are no filters in this dashboard')}</div>
          ) : (
            <div className="filters-scope-selector">
              <div className={cx('filter-field-pane multi-edit-mode')}>
                {this.renderFilterFieldList()}
              </div>
              <div className="filter-scope-pane multi-edit-mode">
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
