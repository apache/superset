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
import {
  useState,
  useCallback,
  useMemo,
  ChangeEvent,
  type ReactElement,
} from 'react';
import cx from 'classnames';
import { Button, Input } from '@superset-ui/core/components';
import { css, styled, t } from '@apache-superset/core/ui';

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
import FilterScopeTree from './FilterScopeTree';
import FilterFieldTree from './FilterFieldTree';
import type { DashboardLayout } from 'src/dashboard/types';

interface DashboardFilter {
  chartId: number;
  componentId: string;
  filterName: string;
  datasourceId: string;
  directPathToFilter: string[];
  isDateFilter: boolean;
  isInstantFilter: boolean;
  columns: Record<string, unknown>;
  labels: Record<string, string>;
  scopes: Record<string, { scope: string[]; immune: number[] }>;
}

interface FilterFieldNode {
  value: string | number;
  label: string;
  type?: string;
  children?: FilterFieldNode[];
  showCheckbox?: boolean;
}

interface FilterScopeTreeNode {
  value: string | number;
  label: string;
  type?: string;
  children?: FilterScopeTreeNode[];
  showCheckbox?: boolean;
}

interface FilterScopeMapEntry {
  nodes: FilterScopeTreeNode[];
  nodesFiltered: FilterScopeTreeNode[];
  checked: (string | number)[];
  expanded: string[];
}

interface FilterScopeMap {
  [key: string]: FilterScopeMapEntry;
}

interface FilterScopeSelectorProps {
  dashboardFilters: Record<number, DashboardFilter>;
  layout: DashboardLayout;
  updateDashboardFiltersScope: (
    scopes: Record<string, ReturnType<typeof getFilterScopeFromNodesTree>>,
  ) => void;
  setUnsavedChanges: (hasChanges: boolean) => void;
  onCloseModal: () => void;
}

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
            color: ${theme.colorPrimaryTextActive};

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
              background: ${theme.colorFill};
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

    border-top: ${theme.sizeUnit / 4}px solid ${theme.colorPrimaryBg};
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

function initializeState(
  dashboardFilters: Record<number, DashboardFilter>,
  layout: DashboardLayout,
) {
  if (Object.keys(dashboardFilters).length === 0) {
    return {
      showSelector: false as const,
      allFilterFields: [] as string[],
      defaultFilterKey: '',
    };
  }

  // display filter fields in tree structure
  const filterFieldNodes = getFilterFieldNodesTree({
    dashboardFilters,
  });
  // filterFieldNodes root node is dashboard_root component,
  // so that we can offer a select/deselect all link
  const filtersNodes = filterFieldNodes[0].children ?? [];
  const allFilterFields: string[] = [];
  filtersNodes.forEach(({ children }) => {
    (children ?? []).forEach(child => {
      allFilterFields.push(String(child.value));
    });
  });
  const defaultFilterKey = String(filtersNodes[0]?.children?.[0]?.value ?? '');

  // build FilterScopeTree object for each filterKey
  const filterScopeMap: FilterScopeMap = Object.values(
    dashboardFilters,
  ).reduce<FilterScopeMap>((map, { chartId: filterId, columns }) => {
    const filterScopeByChartId = Object.keys(columns).reduce<FilterScopeMap>(
      (mapByChartId, columnName) => {
        const filterKey = getDashboardFilterKey({
          chartId: String(filterId),
          column: columnName,
        });
        const nodes = getFilterScopeNodesTree({
          components: layout,
          filterFields: [filterKey],
          selectedChartId: filterId,
        });
        const expanded = getFilterScopeParentNodes(nodes, 1);
        const chartIdsInFilterScope = (
          getChartIdsInFilterScope({
            filterScope: dashboardFilters[filterId].scopes[columnName],
          }) || []
        ).filter((id: number) => id !== filterId);

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
  }, {});

  // initial state: active defaultFilerKey
  const { chartId } = getChartIdAndColumnFromFilterKey(defaultFilterKey);
  const checkedFilterFields: string[] = [];
  const activeFilterField = defaultFilterKey;
  // expand defaultFilterKey in filter field tree
  const expandedFilterIds: (string | number)[] = [ALL_FILTERS_ROOT, chartId];

  const filterScopeTreeEntry = buildFilterScopeTreeEntry({
    checkedFilterFields,
    activeFilterField,
    filterScopeMap,
    layout,
  });

  return {
    showSelector: true as const,
    allFilterFields,
    defaultFilterKey,
    initialState: {
      activeFilterField,
      searchText: '',
      filterScopeMap: {
        ...filterScopeMap,
        ...filterScopeTreeEntry,
      } as FilterScopeMap,
      filterFieldNodes,
      checkedFilterFields,
      expandedFilterIds,
    },
  };
}

export default function FilterScopeSelector({
  dashboardFilters,
  layout,
  updateDashboardFiltersScope,
  setUnsavedChanges,
  onCloseModal,
}: FilterScopeSelectorProps): ReactElement {
  const initialized = useMemo(
    () => initializeState(dashboardFilters, layout),
    // Only initialize once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const { showSelector, allFilterFields } = initialized;

  const [activeFilterField, setActiveFilterField] = useState<string | null>(
    () =>
      initialized.showSelector
        ? initialized.initialState.activeFilterField
        : null,
  );
  const [searchText, setSearchText] = useState(() =>
    initialized.showSelector ? initialized.initialState.searchText : '',
  );
  const [filterScopeMap, setFilterScopeMap] = useState<FilterScopeMap>(() =>
    initialized.showSelector ? initialized.initialState.filterScopeMap : {},
  );
  const [filterFieldNodes] = useState<FilterFieldNode[]>(() =>
    initialized.showSelector ? initialized.initialState.filterFieldNodes : [],
  );
  const [checkedFilterFields, setCheckedFilterFields] = useState<string[]>(
    () =>
      initialized.showSelector
        ? initialized.initialState.checkedFilterFields
        : [],
  );
  const [expandedFilterIds, setExpandedFilterIds] = useState<
    (string | number)[]
  >(() =>
    initialized.showSelector ? initialized.initialState.expandedFilterIds : [],
  );

  const filterNodes = useCallback(
    (
      filtered: FilterScopeTreeNode[] = [],
      node: FilterScopeTreeNode = { value: '', label: '' },
      currentSearchText: string,
    ): FilterScopeTreeNode[] => {
      const filterNodesRecursive = (
        f: FilterScopeTreeNode[],
        n: FilterScopeTreeNode,
      ): FilterScopeTreeNode[] => filterNodes(f, n, currentSearchText);

      const children = (node.children || []).reduce<FilterScopeTreeNode[]>(
        filterNodesRecursive,
        [],
      );

      if (
        // Node's label matches the search string
        node.label
          .toLocaleLowerCase()
          .indexOf((currentSearchText ?? '').toLocaleLowerCase()) > -1 ||
        // Or a children has a matching node
        children.length
      ) {
        filtered.push({ ...node, children });
      }

      return filtered;
    },
    [],
  );

  const filterTree = useCallback(
    (currentSearchText: string) => {
      const key = getKeyForFilterScopeTree({
        activeFilterField: activeFilterField ?? undefined,
        checkedFilterFields,
      });

      // Reset nodes back to unfiltered state
      if (!currentSearchText) {
        setFilterScopeMap(prev => ({
          ...prev,
          [key]: {
            ...prev[key],
            nodesFiltered: prev[key].nodes,
          },
        }));
      } else {
        setFilterScopeMap(prev => {
          const nodesFiltered = prev[key].nodes.reduce<FilterScopeTreeNode[]>(
            (filtered, node) => filterNodes(filtered, node, currentSearchText),
            [],
          );
          const expanded = getFilterScopeParentNodes([...nodesFiltered]);

          return {
            ...prev,
            [key]: {
              ...prev[key],
              nodesFiltered,
              expanded,
            },
          };
        });
      }
    },
    [activeFilterField, checkedFilterFields, filterNodes],
  );

  const onCheckFilterScope = useCallback(
    (checked: (string | number)[] = []): void => {
      const key = getKeyForFilterScopeTree({
        activeFilterField: activeFilterField ?? undefined,
        checkedFilterFields,
      });
      const editingList = activeFilterField
        ? [activeFilterField]
        : checkedFilterFields;

      const updatedFilterScopeMap = getRevertedFilterScope({
        checked,
        filterFields: editingList,
        filterScopeMap,
      });

      setFilterScopeMap({
        ...filterScopeMap,
        ...updatedFilterScopeMap,
        [key]: {
          ...filterScopeMap[key],
          checked,
        },
      } as FilterScopeMap);
    },
    [activeFilterField, checkedFilterFields, filterScopeMap],
  );

  const onExpandFilterScope = useCallback(
    (expanded: string[] = []): void => {
      const key = getKeyForFilterScopeTree({
        activeFilterField: activeFilterField ?? undefined,
        checkedFilterFields,
      });

      setFilterScopeMap(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          expanded,
        },
      }));
    },
    [activeFilterField, checkedFilterFields],
  );

  const onCheckFilterField = useCallback(
    (newCheckedFilterFields: string[] = []): void => {
      const filterScopeTreeEntry = buildFilterScopeTreeEntry({
        checkedFilterFields: newCheckedFilterFields,
        activeFilterField: undefined,
        filterScopeMap,
        layout,
      });

      setActiveFilterField(null);
      setCheckedFilterFields(newCheckedFilterFields);
      setFilterScopeMap({
        ...filterScopeMap,
        ...filterScopeTreeEntry,
      });
    },
    [filterScopeMap, layout],
  );

  const onExpandFilterField = useCallback(
    (newExpandedFilterIds: (string | number)[] = []): void => {
      setExpandedFilterIds(newExpandedFilterIds);
    },
    [],
  );

  const onChangeFilterField = useCallback(
    (filterField: { value?: string } = {}): void => {
      const nextActiveFilterField = filterField.value;

      // we allow single edit and multiple edit in the same view.
      // if user click on the single filter field,
      // will show filter scope for the single field.
      // if user click on the same filter filed again,
      // will toggle off the single filter field,
      // and allow multi-edit all checked filter fields.
      if (nextActiveFilterField === activeFilterField) {
        const filterScopeTreeEntry = buildFilterScopeTreeEntry({
          checkedFilterFields,
          activeFilterField: undefined,
          filterScopeMap,
          layout,
        });

        setActiveFilterField(null);
        setFilterScopeMap({
          ...filterScopeMap,
          ...filterScopeTreeEntry,
        });
      } else if (
        nextActiveFilterField &&
        allFilterFields.includes(nextActiveFilterField)
      ) {
        const filterScopeTreeEntry = buildFilterScopeTreeEntry({
          checkedFilterFields,
          activeFilterField: nextActiveFilterField,
          filterScopeMap,
          layout,
        });

        setActiveFilterField(nextActiveFilterField);
        setFilterScopeMap({
          ...filterScopeMap,
          ...filterScopeTreeEntry,
        });
      }
    },
    [
      activeFilterField,
      allFilterFields,
      checkedFilterFields,
      filterScopeMap,
      layout,
    ],
  );

  const onSearchInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>): void => {
      const newSearchText = e.target.value;
      setSearchText(newSearchText);
      filterTree(newSearchText);
    },
    [filterTree],
  );

  const onClose = useCallback((): void => {
    onCloseModal();
  }, [onCloseModal]);

  const onSave = useCallback((): void => {
    const allFilterFieldScopes = allFilterFields.reduce<
      Record<string, ReturnType<typeof getFilterScopeFromNodesTree>>
    >((map, filterKey) => {
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
    }, {});

    updateDashboardFiltersScope(allFilterFieldScopes);
    setUnsavedChanges(true);

    // click Save button will do save and close modal
    onCloseModal();
  }, [
    allFilterFields,
    filterScopeMap,
    onCloseModal,
    setUnsavedChanges,
    updateDashboardFiltersScope,
  ]);

  const renderFilterFieldList = (): ReactElement | null => (
    <FilterFieldTree
      activeKey={activeFilterField}
      nodes={filterFieldNodes}
      checked={checkedFilterFields}
      expanded={expandedFilterIds}
      onClick={onChangeFilterField}
      onCheck={onCheckFilterField}
      onExpand={onExpandFilterField}
    />
  );

  const renderFilterScopeTree = (): ReactElement => {
    const key = getKeyForFilterScopeTree({
      activeFilterField: activeFilterField ?? undefined,
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
          onChange={onSearchInputChange}
        />
        <FilterScopeTree
          nodes={filterScopeMap[key].nodesFiltered}
          checked={filterScopeMap[key].checked}
          expanded={filterScopeMap[key].expanded}
          onCheck={onCheckFilterScope}
          onExpand={onExpandFilterScope}
          // pass selectedFilterId prop to FilterScopeTree component,
          // to hide checkbox for selected filter field itself
          selectedChartId={selectedChartId}
        />
      </>
    );
  };

  const renderEditingFiltersName = (): ReactElement => {
    const currentFilterLabels = ([] as string[])
      .concat(activeFilterField || checkedFilterFields)
      .filter(Boolean)
      .map(key => {
        const { chartId, column } = getChartIdAndColumnFromFilterKey(key);
        return dashboardFilters[chartId]?.labels[column] || column;
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
  };

  return (
    <ScopeContainer>
      <ScopeHeader>
        <h4>{t('Configure filter scopes')}</h4>
        {showSelector && renderEditingFiltersName()}
      </ScopeHeader>

      <ScopeBody className="filter-scope-body">
        {!showSelector ? (
          <div className="warning-message">
            {t('There are no filters in this dashboard.')}
          </div>
        ) : (
          <ScopeSelector className="filters-scope-selector">
            <div className={cx('filter-field-pane multi-edit-mode')}>
              {renderFilterFieldList()}
            </div>
            <div className="filter-scope-pane multi-edit-mode">
              {renderFilterScopeTree()}
            </div>
          </ScopeSelector>
        )}
      </ScopeBody>

      <ActionsContainer>
        <Button buttonSize="small" onClick={onClose}>
          {t('Close')}
        </Button>
        {showSelector && (
          <Button buttonSize="small" buttonStyle="primary" onClick={onSave}>
            {t('Save')}
          </Button>
        )}
      </ActionsContainer>
    </ScopeContainer>
  );
}
