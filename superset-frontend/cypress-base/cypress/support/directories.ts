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

const dataTestLocator = (value: string) => `[data-test='${value}']`;

export function dataTestChartName(chartName: string): string {
  return `[data-test-chart-name='${chartName}']`;
}

export const pageHeader = {
  logo: '.navbar-brand > img',
  headerNavigationItem: '.ant-menu-submenu-title',
  headerNavigationDropdown: "[aria-label='triangle-down']",
  headerNavigationItemMenu: '.ant-menu-item-group-list',
  plusIcon: ':nth-child(2) > .ant-menu-submenu-title',
  plusIconMenuOptions: {
    sqlQueryOption: dataTestLocator('menu-item-SQL query'),
    chartOption: dataTestLocator('menu-item-Chart'),
    dashboardOption: dataTestLocator('menu-item-Dashboard'),
  },
  plusMenu: '.ant-menu-submenu-popup',
  barButtons: '[role="presentation"]',
  sqlLabMenu: '[id="item_3$Menu"]',
  dataMenu: '[id="item_4$Menu"]',
};

export const profile = {
  activeTab: '.ant-tabs-tab-active',
  inactiveTab: '.ant-tabs-tab',
  emptyFavoritedPlaceholder: '.ant-empty-normal',
  tableRow: '.table-row',
  favoritesSpace: '#rc-tabs-0-panel-2',
};
export const securityAccess = {
  rolesBubble: '.antd5-badge-count',
};
export const homePage = {
  homeSection: {
    sectionArea: '.ant-collapse-content-box',
    sectionElement: '.ant-card-meta-title',
  },
  sections: {
    expandedSection: '.ant-collapse-item-active',
    expandedSectionHeader: '[aria-expanded="true"]',
    collapseExpandButton: '.ant-collapse-arrow',
    collapsedSection: '[class="ant-collapse-item"]',
    collapsedSectionHeader: '[aria-expanded="false"]',
    section: '[class^="ant-collapse-item"]',
    sectionsMenuContainer: "[role='navigation']",
    sectionsMenuItem: "[role='menuitem']",
    card: dataTestLocator('styled-card'),
  },
  thumbnailsSection: {
    container: "[class='switch']",
    toggle: "[role ='switch']",
  },
};
export const databasesPage = {
  addDatabaseButton: dataTestLocator('btn-create-database'),
  searchInput: dataTestLocator('search-input'),
  table: {
    tableRow: dataTestLocator('table-row'),
    tableCell: dataTestLocator('table-row-cell'),
    editButton: dataTestLocator('edit-alt'),
  },
  modal: {
    header: '#rcDialogTitle0 > h4',
    step: '.helper-top',
    selectDbStepTitle: '.select-db > h4',
    preferredBlockBigQuery: '.preferred > :nth-child(1)',
    preferredBlockPostgreSQL: '.preferred > :nth-child(2)',
    preferredBlockSnowflake: '.preferred > :nth-child(3)',
    preferredBlockMySQL: '.preferred > :nth-child(4)',
    preferredBlockAthena: '.preferred > :nth-child(5)',
    preferredBlockSheets: '.preferred > :nth-child(6)',
    supportedDatabasesText: '.control-label',
    orChoose: '.available-label',
    dbDropdown: '[class="ant-select-selection-search-input"]',
    dbDropdownMenu: '.rc-virtual-list-holder-inner',
    dbDropdownMenuItem: '[class="ant-select-item-option-content"]',
    infoAlert: '.ant-alert',
    serviceAccountInput: '[name="credentials_info"]',
    connectionStep: {
      modal: '.ant-modal-content',
      modalBody: '.ant-modal-body',
      stepTitle: '.css-7x6kk > h4',
      helperBottom: '.helper-bottom',
      postgresDatabase: '[name="database"]',
      dbInput: '[name="database_name"]',
      alertMessage: '.ant-alert-message',
      errorField: '[role="alert"]',
      uploadJson: '[title="Upload JSON file"]',
      chooseFile: '[class="ant-btn input-upload-btn"]',
      additionalParameters: '[name="query_input"]',
      sqlAlchemyUriInput: dataTestLocator('sqlalchemy-uri-input'),
      advancedTab: '#rc-tabs-0-tab-2',
      activeTab: '.ant-tabs-tab-active',
      securitySubMenu:
        ':nth-child(3) > .ant-collapse-header > .anticon > svg > path',
      aceTextInput: '.ace_text-input',
      aceContent: '.ace_content',
      connectButton: '.css-16i3wh7',
      hostInput: '[name="host"]',
      portInput: '[name="port"]',
      usernameInput: '[name="username"]',
      passwordInput: '[name="password"]',
      switch: '.ant-switch',
    },
  },
};

export const sqlLabView = {
  sqlEditorLeftBar: {
    sqlEditorLeftBar: '[data-test="sql-editor-left-bar"]',
    databaseSchemaTableSection:
      '[data-test="sql-editor-left-bar"] > :nth-child(1)',
    tableSchemaSection:
      '[data-test="sql-editor-left-bar"] > :nth-child(1) > :nth-child(3) > :nth-child(1)',
    tableSchemaInputEmpty: '[aria-label="Select table or type table name"]',
  },
  databaseInput: '[data-test=DatabaseSelector] > :nth-child(1)',
  emptyMenuOptionsPlaceholder: '[class="ant-empty-img-simple"]',
  removeTabButton: '.ant-tabs-tab-remove > .anticon > svg',
  tabsNavList: "[class='ant-tabs-nav-list']",
  tab: "[class='ant-tabs-tab-btn']",
  addTabButton: dataTestLocator('add-tab-icon'),
  tooltip: '.ant-tooltip-content',
  tabName: '.css-1suejie',
  schemaInput: '[data-test=DatabaseSelector] > :nth-child(2)',
  loadingIndicator: '.Select__loading-indicator',
  menuItem: '[class="ant-select-item-option-content"]',
  examplesMenuItem: '[title="examples"]',
  tableInput: ':nth-child(4) > .select > :nth-child(1)',
  sqlEditor: '#brace-editor textarea',
  saveAsButton: '.SaveQuery > .ant-btn',
  saveAsModal: {
    footer: '.ant-modal-footer',
    queryNameInput: 'input[class^="ant-input"]',
  },
  sqlToolbar: {
    toolbar: '#js-sql-toolbar',
    runButton: '.css-d3dxop',
  },
  rowsLimit: {
    dropdown: '.ant-dropdown-menu',
    limitButton: '.ant-dropdown-menu-item',
    limitButtonText: '.css-151uxnz',
    limitTextWithValue: '[class="ant-dropdown-trigger"]',
  },
  renderedTableHeader: '.ReactVirtualized__Table__headerRow',
  renderedTableRow: '.ReactVirtualized__Table__row',
  errorBody: '.error-body',
  alertMessage: '.ant-alert-message',
  historyTable: {
    header: '[role=columnheader]',
    table: '.QueryTable',
    row: dataTestLocator('table-row'),
    failureMarkIcon: '[aria-label=x-small]',
    successMarkIcon: '[aria-label=check]',
  },
};
export const queryHistory = {
  tableHeader: dataTestLocator('sort-header'),
  row: dataTestLocator('table-row'),
  cell: dataTestLocator('table-row-cell'),
  action: '[aria-label=full]',
};
export const savedQuery = {
  tableHeader: dataTestLocator('sort-header'),
  row: dataTestLocator('table-row'),
  cell: dataTestLocator('table-row-cell'),
  trash: dataTestLocator('delete-action'),
  deleteQueryIcon: '[data-test="delete-action"]',
  deleteModal: {
    deleteInput: dataTestLocator('delete-modal-input'),
    deleteButton: dataTestLocator('modal-confirm-button'),
  },
};
export const annotationLayersView = {
  emptyDescription: {
    description: '.ant-empty-description',
    addAnnotationLayerButton: '.ant-empty-footer > .ant-btn',
  },
  modal: {
    content: {
      content: '.ant-modal-body',
      title: '.ant-modal-body > :nth-child(2) > input',
      description: "[name='descr']",
    },
    footer: {
      footer: '.ant-modal-footer',
      addButton: dataTestLocator('modal-confirm-button'),
      cancelButton: dataTestLocator('modal-cancel-button'),
    },
  },
};
export const datasetsList = {
  newDatasetButton: '.css-yff34v',
  searchInput: dataTestLocator('filters-search'),
  newDatasetModal: {
    inputField: '[class="section"]',
    addButton: dataTestLocator('modal-confirm-button'),
    body: '.ant-modal-body',
  },
  table: {
    tableRow: {
      row: dataTestLocator('table-row'),
      rowText: dataTestLocator('cell-text'),
      rowCell: dataTestLocator('table-row-cell'),
    },
    tableRowHeader: {
      header: dataTestLocator('sort-header'),
      unsorted: '[aria-label="sort"]',
      sortAsc: '[aria-label="sort-asc"]',
      sortDesc: '[aria-label="sort-desc"]',
    },
    rowActionItems: dataTestLocator('table-row-cell'),
    actionButton: '.action-button',
    editButton: '[aria-label="edit-alt"]',
  },
  editDatasetModal: {
    modal: dataTestLocator('edit-dataset-tabs'),
    sourceNavigationTab: '#table-tabs-tab-0',
    metricsNavigationTab: dataTestLocator('collection-tab-Metrics'),
    columnsNavigationTab: dataTestLocator('collection-tab-Columns'),
    calculatedColumnsNavigationTab: dataTestLocator(
      'collection-tab-Calculated columns',
    ),
    settingsNavigationTab: '#table-tabs-tab-4',
    saveButton: dataTestLocator('datasource-modal-save'),
    sourceContent: '#table-tabs-panel-0',
    metricsContent: '#table-tabs-panel-1',
    columnsContent: '#table-tabs-panel-2',
    calculatedColumnsContent: '#table-tabs-panel-3',
    settingsContent: '#table-tabs-panel-4',
    aceTextInput: '.ace_text-input',
    sourceSQLInput: '.ace_content',
    sourceVirtualSQLRadio: ':nth-child(2) > .ant-radio > .ant-radio-inner',
    sourcePadlock: '[aria-label=lock-locked]',
    legacy: {
      panel: '.panel-body',
      sqlInput: '#sql',
      save: '.well > .btn-primary',
      description: '#description',
    },
  },
  deleteDatasetModal: {
    modal: '.ant-modal-content',
    deleteInput: dataTestLocator('delete-modal-input'),
    deleteButton: dataTestLocator('modal-confirm-button'),
    text: '.css-kxmt87',
  },
};
export const chartListView = {
  filtersBar: {
    searchField: dataTestLocator('filters-search'),
  },
  top: {
    bulkSelect: dataTestLocator('bulk-select'),
  },
  header: {
    cardView: '[aria-label="card-view"]',
    listView: '[aria-label="list-view"]',
    sort: '[class="ant-select-selection-search-input"][aria-label="Sort"]',
    sortRecentlyModifiedMenuOption: '[label="Recently modified"]',
    sortAlphabeticalMenuOption: '[label="Alphabetical"]',
    sortDropdown: '.Select__menu',
  },
  card: {
    card: dataTestLocator('styled-card'),
    cardCover: '[class="ant-card-cover"]',
    cardImage: '[class="gradient-container"]',
    selectedStarIcon: "[aria-label='favorite-selected']",
    unselectedStarIcon: "[aria-label='favorite-unselected']",
    starIcon: dataTestLocator('fave-unfave-icon'),
  },
  deleteModal: {
    deleteInput: dataTestLocator('delete-modal-input'),
    deleteButton: dataTestLocator('modal-confirm-button'),
  },
  table: {
    bulkSelect: {
      checkboxOff: '[aria-label="checkbox-off"]',
      checkboxOn: '[aria-label="checkbox-on"]',
      action: dataTestLocator('bulk-select-action'),
    },
    tableList: dataTestLocator('listview-table'),
    table: '[role="rowgroup"]',
    tableRowHeader: {
      header: dataTestLocator('sort-header'),
      unsorted: '[aria-label="sort"]',
      sortAsc: '[aria-label="sort-asc"]',
      sortDesc: '[aria-label="sort-desc"]',
    },
    tableRow: {
      row: dataTestLocator('table-row'),
      rowText: dataTestLocator('cell-text'),
      rowCell: dataTestLocator('table-row-cell'),
    },
  },
  addChartButton: '.css-yff34v',
};
export const nativeFilters = {
  modal: {
    container: '.ant-modal',
    footer: '.ant-modal-footer',
    saveButton: dataTestLocator('native-filter-modal-save-button'),
    cancelButton: dataTestLocator('native-filter-modal-cancel-button'),
    confirmCancelButton: dataTestLocator(
      'native-filter-modal-confirm-cancel-button',
    ),
    alertXUnsavedFilters: '.ant-alert-message',
    tabsList: {
      filterItemsContainer: dataTestLocator('filter-title-container'),
      tabsContainer: '[class="ant-tabs-nav-list"]',
      tab: '.ant-tabs-tab',
      removeTab: '[aria-label="trash"]',
    },
    addFilter: dataTestLocator('add-filter-button'),
    defaultValueCheck: '.ant-checkbox-checked',
  },
  addFilterButton: {
    button: `.ant-modal-content [data-test="new-dropdown-icon"]`,
    dropdownItem: '.ant-dropdown-menu-item',
  },
  filtersPanel: {
    filterName: dataTestLocator('filters-config-modal__name-input'),
    datasetName: dataTestLocator('filters-config-modal__datasource-input'),
    filterInfoInput: '.ant-select-selection-search-input',
    inputDropdown: '.ant-select-item-option-content',
    columnEmptyInput: '.ant-select-selection-placeholder',
    filterTypeInput: dataTestLocator('filters-config-modal__filter-type'),
    fieldInput: dataTestLocator('field-input'),
    filterTypeItem: '.ant-select-selection-item',
  },
  filterFromDashboardView: {
    filterValueInput: '[class="ant-select-selection-search-input"]',
    expand: dataTestLocator('filter-bar__expand-button'),
    collapse: dataTestLocator('filter-bar__collapse-button'),
    filterName: dataTestLocator('filter-control-name'),
    filterContent: '.ant-select-selection-item',
    createFilterButton: dataTestLocator('filter-bar__create-filter'),
    timeRangeFilterContent: dataTestLocator('time-range-trigger'),
  },
  createFilterButton: dataTestLocator('filter-bar__create-filter'),
  removeFilter: '[aria-label="remove"]',
  silentLoading: '.loading inline-centered css-101mkpk',
  filterConfigurationSections: {
    sectionHeader: '.ant-collapse-header',
    displayedSection: 'div[style="height: 100%; overflow-y: auto;"]',
    collapseExpandButton: '.ant-collapse-arrow',
    checkedCheckbox: '.ant-checkbox-wrapper-checked',
    infoTooltip: '[aria-label="Show info tooltip"]',
    parentFilterInput: dataTestLocator('parent-filter-input'),
    filterPlaceholder: '.ant-select-selection-placeholder',
    collapsedSectionContainer: '[class="ant-collapse-content-box"]',
  },
  filtersList: {
    list: '.ant-tabs-nav-list',
    listItemNotActive: '[class="ant-tabs-tab ant-tabs-tab-with-remove"]',
    listItemActive:
      '[class="ant-tabs-tab ant-tabs-tab-with-remove ant-tabs-tab-active"]',
    removeIcon: '[aria-label="trash"]',
  },
  filterItem: dataTestLocator('form-item-value'),
  filterItemDropdown: '.ant-select-selection-search',
  applyFilter: dataTestLocator('filter-bar__apply-button'),
  defaultInput: dataTestLocator('default-input'),
  filterIcon: dataTestLocator('filter-icon'),
  slider: {
    slider: '[class="ant-slider"]',
    startHandle: '[class="ant-slider-handle ant-slider-handle-1"]',
    endHandle: '[class="ant-slider-handle ant-slider-handle-2"]',
    sliderText: '[class="ant-slider-mark-text ant-slider-mark-text-active"]',
  },
};
export const dashboardListView = {
  dashboardListView: dataTestLocator('dashboard-list-view'),
  editItemAction: dataTestLocator('edit-alt'),
  filtersBar: {
    searchField: dataTestLocator('filters-search'),
  },
  top: {
    bulkSelect: dataTestLocator('bulk-select'),
  },
  card: {
    card: dataTestLocator('styled-card'),
    cardCover: '[class="ant-card-cover"]',
    cardImage: '[class="gradient-container"]',
    selectedStarIcon: "[aria-label='favorite-selected']",
    unselectedStarIcon: "[aria-label='favorite-unselected']",
    starIcon: dataTestLocator('fave-unfave-icon'),
  },
  deleteModal: {
    deleteInput: dataTestLocator('delete-modal-input'),
    deleteButton: dataTestLocator('modal-confirm-button'),
  },
  table: {
    starIcon: dataTestLocator('fave-unfave-icon'),
    selectedStarIcon: "[aria-label='favorite-selected']",
    unselectedStarIcon: "[aria-label='favorite-unselected']",
    bulkSelect: {
      checkboxOff: '[aria-label="checkbox-off"]',
      checkboxOn: '[aria-label="checkbox-on"]',
      action: dataTestLocator('bulk-select-action'),
    },
    tableRow: {
      sortHeader: dataTestLocator('sort-header'),
      row: dataTestLocator('table-row'),
      rowText: dataTestLocator('cell-text'),
      rowCell: dataTestLocator('table-row-cell'),
    },
    tableRowList: '[role="rowgroup"]',
    tableList: dataTestLocator('listview-table'),
    trashIcon: dataTestLocator('dashboard-list-trash-icon'),
  },
  actions: {
    importButton: dataTestLocator('import-button'),
    newDashboardButton: '.css-yff34v',
  },
  importModal: {
    selectFileButton: '.ant-upload > .ant-btn > span',
    importButton: dataTestLocator('modal-confirm-button'),
  },
  header: {
    cardView: '[aria-label="card-view"]',
    listView: '[aria-label="list-view"]',
    sort: dataTestLocator('sort-header'),
    sortDropdown: '.Select__menu',
    statusFilterInput: `${dataTestLocator(
      'filters-select',
    )}[aria-label='Status']`,
    ownerFilterInput: `${dataTestLocator(
      'filters-select',
    )}[aria-label='Owner']`,
    createdByFilterInput: `${dataTestLocator(
      'filters-select',
    )}[aria-label='Created by']`,
    FavoriteFilterInput: `${dataTestLocator(
      'filters-select',
    )}[aria-label='Favorite']`,
    searchFilterInput: `${dataTestLocator(
      'filters-search',
    )}[name='dashboard_title']`,
    draftStatusFilterOption: "[title='Draft']",
  },
};
export const exploreView = {
  openDatasourceMenu: dataTestLocator('open-datasource-tab'),
  sectionsHeader: '.ant-collapse-header',
  datasourceMenuThreeDots: dataTestLocator('datasource-menu-trigger'),
  threeDotsMenuDropdown: {
    editDataset: dataTestLocator('edit-dataset'),
  },
  chartContainer: dataTestLocator('chart-container'),
  chartHeading: {
    queryMenu: '#query',
    viewQueryButton: dataTestLocator('view-query-menu-item'),
    shortLinkButton: dataTestLocator('short-link-button'),
    embedCodeButton: dataTestLocator('embed-code-button'),
  },
  chartAreaItem: '.nv-legend-text',
  viewQueryModal: {
    container: '.ant-modal-content',
    closeButton: 'button.ant-modal-close',
  },
  embedCodeModal: {
    container: dataTestLocator('embed-code-popover'),
    textfield: dataTestLocator('embed-code-textarea'),
  },
  saveModal: {
    modal: '.ant-modal-content',
    chartNameInput: dataTestLocator('new-chart-name'),
    dashboardNameInput: '.ant-select-selection-search-input',
    addToDashboardInput: dataTestLocator(
      'save-chart-modal-select-dashboard-form',
    ),
    saveButton: dataTestLocator('btn-modal-save'),
    saveAsCircle: dataTestLocator('saveas-radio'),
    overwriteCircle: dataTestLocator('save-overwrite-radio'),
    saveAndGoToDashboard: '#btn_modal_save_goto_dash',
  },
  controlPanel: {
    panel: dataTestLocator('control-tabs'),
    categoryArea: '.ant-collapse-content-box',
    dragField: dataTestLocator('datasource'),
    metricsField: dataTestLocator('metrics'),
    optionField: dataTestLocator('option-label'),
    fieldInput: '.Select__control input',
    removeFieldValue: dataTestLocator('remove-control-button'),
    addFieldValue: '[aria-label="plus-small"]',
    vizType: dataTestLocator('visualization-type'),
    runButton: dataTestLocator('run-query-button'),
    saveQuery: dataTestLocator('query-save-button'),
    fieldValue: dataTestLocator('control-label'),
    addMetricModal: {
      container: dataTestLocator('metrics-edit-popover'),
      metricNameEdit: {
        editButton: dataTestLocator('AdhocMetricEditTitle#trigger'),
        input: dataTestLocator('AdhocMetricEditTitle#input'),
      },
      simpleTab: {
        tab: '#adhoc-metric-edit-tabs-tab-SIMPLE',
        columnInput: '[name="select-column"]',
        aggregateInput: '[name="select-aggregate"]',
      },
      customSQLTab: {
        tab: '#adhoc-metric-edit-tabs-tab-SQL',
        inputContainerField: '.ace_content',
        input: '.ace_text-input',
      },
      saveButton: dataTestLocator('AdhocMetricEdit#save'),
    },
    querySection: {
      groupByField: dataTestLocator('groupby'),
      filtersField: dataTestLocator('adhoc_filters'),
      filterValue: dataTestLocator('adhoc-filter-simple-value'),
      filterModal: {
        customSQL: {
          tab: '#adhoc-filter-edit-tabs-tab-SQL',
          inputArea: '.ace_content',
          input: '.ace_text-input',
        },
        simple: {
          tab: '#adhoc-filter-edit-tabs-tab-SIMPLE',
        },
        container: dataTestLocator('filter-edit-popover'),
        saveButton: dataTestLocator('adhoc-filter-edit-popover-save-button'),
      },
    },
    annotationLayerSection: {
      addAnnotationLayer: dataTestLocator('annotation_layers'),
      addAnnotationLayerModal: {
        container: dataTestLocator('popover-content'),
        name: dataTestLocator('annotation-layer-name-header'),
        formula: dataTestLocator('annotation-layer-value-header'),
        input: dataTestLocator(''),
      },
    },
    timeSection: {
      timeRangeFilter: dataTestLocator('time-range-trigger'),
      timeRangeFilterModal: {
        container: '.ant-popover-content',
        footer: '.footer',
        cancelButton: dataTestLocator('cancel-button'),
        configureLastTimeRange: {
          container: '.ant-radio-group',
          checkedItem: '.ant-radio-checked + span',
        },
        configureCustomTimeRange: {
          container: dataTestLocator('custom-frame'),
          timeInput: '.ant-input-number-input-wrap > input',
        },
        configureNoFilterTimeRange: {
          container: dataTestLocator('no-filter'),
        },
      },
    },
    advancedAnalyticsSection: {
      timeShift: {
        container: dataTestLocator('time_compare'),
        input: 'input[type=text]',
        selectedValues: '.Select__multi-value__label',
      },
    },
  },
  editDatasetModal: {
    container: '.ant-modal-content',
    datasetTabsContainer: dataTestLocator('edit-dataset-tabs'),
    saveButton: dataTestLocator('datasource-modal-save'),
    metricsTab: {
      addItem: dataTestLocator('crud-add-table-item'),
      rowsContainer: dataTestLocator('table-content-rows'),
    },
    confirmModal: {
      okButton: '.ant-modal-confirm-btns .ant-btn-primary',
    },
  },
  visualizationTypeModal: {
    vizTypeButton: dataTestLocator('viztype-selector-container'),
  },
};
export const createChartView = {
  chooseDatasetInput: '.ant-select-selection-search-input',
  chooseDatasetOption: '.ant-select-item-option-content',
  chooseDatasetList: '.rc-virtual-list-holder-inner',
  tableVizType: "[alt='Table']",
};
export const editDashboardView = {
  dashboardName: dataTestLocator('dashboard-title-input'),
  dashboardEditingContainer: dataTestLocator('dashboard-content'),
  editComponent: dataTestLocator('new-component'),
  discardChanges: dataTestLocator('discard-changes-button'),
  chartBox: dataTestLocator('chart-grid-component'),
  tabsList: {
    tabsContainer: '[class="ant-tabs-nav-list"]',
    tab: '.ant-tabs-tab',
  },
};
export const dashboardView = {
  dashboardContainer: dataTestLocator('grid-container'),
  dashboardAlert: {
    modal: dataTestLocator('toast-container'),
    closeButton: dataTestLocator('close-button'),
  },
  saveModal: {
    modal: '.ant-modal-content',
    dashboardNameInput: '.ant-input',
    saveButton: dataTestLocator('modal-save-dashboard-button'),
  },
  dashboardProperties: {
    modal: '.ant-modal-content',
    dashboardTitleInput: dataTestLocator('dashboard-title-input'),
    modalButton: '[type="button"]',
  },
  chart: {
    trashIcon: dataTestLocator('dashboard-delete-component-button'),
    refreshChart: dataTestLocator('refresh-chart-menu-item'),
  },
  threeDotsMenuIcon:
    '.header-with-actions .right-button-panel .ant-dropdown-trigger',
  threeDotsMenuDropdown: dataTestLocator('header-actions-menu'),
  refreshDashboard: dataTestLocator('refresh-dashboard-menu-item'),
  saveAsMenuOption: dataTestLocator('save-as-menu-item'),
  dashboardTab: dataTestLocator('dragdroppable-object'),
  salesDashboardSpecific: {
    vehicleSalesFilterTimeRange: dataTestLocator('time-range-trigger'),
    secondTabSalesDashboard: dataTestLocator('dragdroppable-object'),
  },
  timeRangeModal: {
    rangeTypeField: '.ant-select-selection-item',
    startTimeInputNumber: '.ant-input-number-input',
    datePicker: '.ant-picker-input',
    applyButton: dataTestLocator('date-filter-control__apply-button'),
    radioGroup: '.ant-radio-group',
    radioButton: '.ant-radio',
    finalFilterRangePreviewCustom:
      '.css-c2bup7 > :nth-child(6) > :nth-child(2)',
    finalFilterRangePreviewLast: '.css-c2bup7 > :nth-child(7) > :nth-child(2)',
    finalFilterRangePreviewPrevious:
      '.css-c2bup7 > :nth-child(7) > :nth-child(2)',
  },
  treeMapChartModal: {
    selectItem: '.Select_control',
    selectItemInput: '.Select__control input[type=text]',
    applyButton: '.filter button:not(:disabled)',
    clearItemIcon: '.Select__clear-indicator',
  },
  sliceThreeDots: '[aria-label="More Options"]',
  sliceThreeDotsDropdown: '[role="menu"]',
  editDashboardButton: '[aria-label="Edit dashboard"]',
  starIcon: dataTestLocator('fave-unfave-icon'),
  dashboardHeader: dataTestLocator('dashboard-header'),
  dashboardSectionContainer: dataTestLocator(
    'grid-row-background--transparent',
  ),
  markdownEditor: dataTestLocator('dashboard-markdown-editor'),
  dashboardComponent: dataTestLocator('dashboard-component-chart-holder'),
  tabsList: {
    tabsContainer: dataTestLocator('dashboard-component-tabs'),
    tabsNavList: dataTestLocator('nav-list'),
    tabs: '.ant-tabs-nav-list',
    tab: '.ant-tabs-tab',
  },
};
