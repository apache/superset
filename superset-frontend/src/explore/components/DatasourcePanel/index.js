"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
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
var react_1 = require("react");
var translation_1 = require("@apache-superset/core/translation");
var core_1 = require("@superset-ui/core");
var components_1 = require("@apache-superset/core/components");
var theme_1 = require("@apache-superset/core/theme");
var react_virtualized_auto_sizer_1 = require("react-virtualized-auto-sizer");
var match_sorter_1 = require("match-sorter");
var components_2 = require("@superset-ui/core/components");
var SaveDatasetModal_1 = require("src/SqlLab/components/SaveDatasetModal");
var datasourceUtils_1 = require("src/utils/datasourceUtils");
var Control_1 = require("src/explore/components/Control");
var DndItemType_1 = require("../DndItemType");
var ExploreContainer_1 = require("../ExploreContainer");
var DatasourceItems_1 = require("./DatasourceItems");
var transformDatasourceFolders_1 = require("./transformDatasourceFolders");
var core_2 = require("@superset-ui/core");
var useExploreRelationships_1 = require("src/features/datasets/relationships/hooks/useExploreRelationships");
var useSyncRelationshipsToFormData_1 = require("src/features/datasets/relationships/hooks/useSyncRelationshipsToFormData");
var RelationshipPanel_1 = require("src/features/datasets/relationships/components/RelationshipPanel");
var DatasourceContainer = theme_1.styled.div(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n  ", ";\n"], ["\n  ", ";\n"])), function (_a) {
    var theme = _a.theme;
    return (0, theme_1.css)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    position: relative;\n    height: 100%;\n    display: flex;\n    flex-direction: column;\n    max-height: 100%;\n    .field-selections {\n      padding: 0 0 ", "px;\n      overflow: auto;\n      height: 100%;\n    }\n    .field-length {\n      margin-bottom: ", "px;\n      font-size: ", "px;\n      color: ", ";\n    }\n    .form-control.input-md {\n      display: inline-flex;\n      width: calc(100% - ", "px);\n      height: ", "px;\n      margin: ", "px auto;\n    }\n    .type-label {\n      font-size: ", "px;\n      color: ", ";\n    }\n    .Control {\n      padding-bottom: 0;\n    }\n  "], ["\n    position: relative;\n    height: 100%;\n    display: flex;\n    flex-direction: column;\n    max-height: 100%;\n    .field-selections {\n      padding: 0 0 ", "px;\n      overflow: auto;\n      height: 100%;\n    }\n    .field-length {\n      margin-bottom: ", "px;\n      font-size: ", "px;\n      color: ", ";\n    }\n    .form-control.input-md {\n      display: inline-flex;\n      width: calc(100% - ", "px);\n      height: ", "px;\n      margin: ", "px auto;\n    }\n    .type-label {\n      font-size: ", "px;\n      color: ", ";\n    }\n    .Control {\n      padding-bottom: 0;\n    }\n  "])), theme.sizeUnit, theme.sizeUnit * 2, theme.fontSizeSM, theme.colorTextTertiary, theme.sizeUnit * 8, theme.sizeUnit * 8, theme.sizeUnit * 2, theme.fontSizeSM, theme.colorTextSecondary);
});
var StyledInfoboxWrapper = theme_1.styled.div(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n  ", "\n"], ["\n  ", "\n"])), function (_a) {
    var theme = _a.theme;
    return (0, theme_1.css)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    margin: 0 ", "px;\n\n    span {\n      text-decoration: underline;\n    }\n  "], ["\n    margin: 0 ", "px;\n\n    span {\n      text-decoration: underline;\n    }\n  "])), theme.sizeUnit * 2.5);
});
var BORDER_WIDTH = 2;
var sortColumns = function (slice) {
    return __spreadArray([], slice, true).sort(function (col1, col2) {
        var _a, _b;
        if ((col1 === null || col1 === void 0 ? void 0 : col1.is_dttm) && !(col2 === null || col2 === void 0 ? void 0 : col2.is_dttm)) {
            return -1;
        }
        if ((col2 === null || col2 === void 0 ? void 0 : col2.is_dttm) && !(col1 === null || col1 === void 0 ? void 0 : col1.is_dttm)) {
            return 1;
        }
        return ((_a = col1 === null || col1 === void 0 ? void 0 : col1.column_name) !== null && _a !== void 0 ? _a : '').localeCompare((_b = col2 === null || col2 === void 0 ? void 0 : col2.column_name) !== null && _b !== void 0 ? _b : '');
    })
        .sort(function (a, b) { var _a, _b; return ((_a = b === null || b === void 0 ? void 0 : b.is_certified) !== null && _a !== void 0 ? _a : 0) - ((_b = a === null || a === void 0 ? void 0 : a.is_certified) !== null && _b !== void 0 ? _b : 0); });
};
function DataSourcePanel(_a) {
    var _b;
    var datasource = _a.datasource, formData = _a.formData, datasourceControl = _a.controls.datasource, actions = _a.actions, width = _a.width;
    var dropzones = (0, react_1.useContext)(ExploreContainer_1.DropzoneContext)[0];
    var _columns = datasource.columns, metrics = datasource.metrics, _folders = datasource.folders;
    // Relationship management (gated behind feature flag)
    var relationshipsEnabled = (0, core_2.isFeatureEnabled)(core_2.FeatureFlag.DatasetRelationships);
    var relationships = relationshipsEnabled
        ? (_b = datasource.relationships) !== null && _b !== void 0 ? _b : []
        : [];
    var _c = (0, useExploreRelationships_1.useExploreRelationships)(relationships), activeJoins = _c.activeJoins, availableTargetColumns = _c.availableTargetColumns, columnRelationshipMap = _c.columnRelationshipMap, getColumnInfo = _c.getColumnInfo, toggleJoin = _c.toggleJoin, updateSelectedColumns = _c.updateSelectedColumns;
    // Sync active relationships into form_data.active_relationships
    (0, useSyncRelationshipsToFormData_1.useSyncRelationshipsToFormData)(activeJoins, relationships, function (name, value) { var _a; return (_a = actions.setControlValue) === null || _a === void 0 ? void 0 : _a.call(actions, name, value); });
    var allowedColumns = (0, react_1.useMemo)(function () {
        var validators = Object.values(dropzones);
        if (!Array.isArray(_columns))
            return [];
        return _columns.filter(function (column) {
            return validators.some(function (validator) {
                return validator({
                    value: column,
                    type: DndItemType_1.DndItemType.Column,
                });
            });
        });
    }, [dropzones, _columns]);
    var allowedMetrics = (0, react_1.useMemo)(function () {
        var validators = Object.values(dropzones);
        return metrics.filter(function (metric) {
            return validators.some(function (validator) {
                return validator({ value: metric, type: DndItemType_1.DndItemType.Metric });
            });
        });
    }, [dropzones, metrics]);
    var _d = (0, react_1.useState)(false), showSaveDatasetModal = _d[0], setShowSaveDatasetModal = _d[1];
    var _e = (0, react_1.useState)(''), inputValue = _e[0], setInputValue = _e[1];
    var searchKeyword = (0, react_1.useDeferredValue)(inputValue);
    var filteredColumns = (0, react_1.useMemo)(function () {
        if (!searchKeyword) {
            return allowedColumns !== null && allowedColumns !== void 0 ? allowedColumns : [];
        }
        return (0, match_sorter_1.matchSorter)(allowedColumns, searchKeyword, {
            keys: [
                {
                    key: 'verbose_name',
                    threshold: match_sorter_1.rankings.CONTAINS,
                },
                {
                    key: 'column_name',
                    threshold: match_sorter_1.rankings.CONTAINS,
                },
                {
                    key: function (item) {
                        var _a, _b;
                        return [(_a = item === null || item === void 0 ? void 0 : item.description) !== null && _a !== void 0 ? _a : '', (_b = item === null || item === void 0 ? void 0 : item.expression) !== null && _b !== void 0 ? _b : ''].map(function (x) { return (x === null || x === void 0 ? void 0 : x.replace(/[_\n\s]+/g, ' ')) || ''; });
                    },
                    threshold: match_sorter_1.rankings.CONTAINS,
                    maxRanking: match_sorter_1.rankings.CONTAINS,
                },
            ],
            keepDiacritics: true,
        });
    }, [allowedColumns, searchKeyword]);
    var filteredMetrics = (0, react_1.useMemo)(function () {
        if (!searchKeyword) {
            return __spreadArray([], (allowedMetrics !== null && allowedMetrics !== void 0 ? allowedMetrics : []), true).sort(function (a, b) { var _a, _b; return ((_a = a === null || a === void 0 ? void 0 : a.metric_name) !== null && _a !== void 0 ? _a : '').localeCompare((_b = b === null || b === void 0 ? void 0 : b.metric_name) !== null && _b !== void 0 ? _b : ''); });
        }
        return (0, match_sorter_1.matchSorter)(allowedMetrics, searchKeyword, {
            keys: [
                {
                    key: 'verbose_name',
                    threshold: match_sorter_1.rankings.CONTAINS,
                },
                {
                    key: 'metric_name',
                    threshold: match_sorter_1.rankings.CONTAINS,
                },
                {
                    key: function (item) {
                        var _a, _b;
                        return [(_a = item === null || item === void 0 ? void 0 : item.description) !== null && _a !== void 0 ? _a : '', (_b = item === null || item === void 0 ? void 0 : item.expression) !== null && _b !== void 0 ? _b : ''].map(function (x) { return (x === null || x === void 0 ? void 0 : x.replace(/[_\n\s]+/g, ' ')) || ''; });
                    },
                    threshold: match_sorter_1.rankings.CONTAINS,
                    maxRanking: match_sorter_1.rankings.CONTAINS,
                },
            ],
            keepDiacritics: true,
            baseSort: function (a, b) {
                var _a, _b, _c, _d, _e, _f;
                return Number((_b = (_a = b === null || b === void 0 ? void 0 : b.item) === null || _a === void 0 ? void 0 : _a.is_certified) !== null && _b !== void 0 ? _b : 0) -
                    Number((_d = (_c = a === null || a === void 0 ? void 0 : a.item) === null || _c === void 0 ? void 0 : _c.is_certified) !== null && _d !== void 0 ? _d : 0) ||
                    String((_e = a === null || a === void 0 ? void 0 : a.rankedValue) !== null && _e !== void 0 ? _e : '').localeCompare((_f = b === null || b === void 0 ? void 0 : b.rankedValue) !== null && _f !== void 0 ? _f : '');
            },
        });
    }, [allowedMetrics, searchKeyword]);
    var sortedColumns = (0, react_1.useMemo)(function () { return sortColumns(filteredColumns); }, [filteredColumns]);
    var folders = (0, react_1.useMemo)(function () {
        return (0, transformDatasourceFolders_1.transformDatasourceWithFolders)(filteredMetrics, sortedColumns, _folders, allowedMetrics, allowedColumns);
    }, [_folders, filteredMetrics, sortedColumns]);
    var showInfoboxCheck = function () {
        try {
            if (sessionStorage.getItem('showInfobox') === 'false')
                return false;
        }
        catch (error) {
            // continue regardless of error
        }
        return true;
    };
    var saveableDatasets = {
        query: core_1.DatasourceType.Query,
        saved_query: core_1.DatasourceType.SavedQuery,
    };
    var datasourceIsSaveable = datasource.type &&
        saveableDatasets[datasource.type];
    var theme = (0, theme_1.useTheme)();
    var mainBody = (0, react_1.useMemo)(function () { return (<>
        {/* Relationship panel — shows active JOIN configurations */}
        {relationshipsEnabled && relationships.length > 0 && (<RelationshipPanel_1.RelationshipPanel relationships={relationships} activeJoins={activeJoins} availableTargetColumns={availableTargetColumns} onToggleJoin={toggleJoin} onUpdateSelectedColumns={updateSelectedColumns}/>)}

        <div style={{ padding: theme.sizeUnit * 4 }}>
          <components_2.Input allowClear onChange={function (evt) {
            setInputValue(evt.target.value);
        }} value={inputValue} placeholder={(0, translation_1.t)('Search Metrics & Columns')}/>
        </div>
        <div className="field-selections" data-test="fieldSelections">
          {datasourceIsSaveable && showInfoboxCheck() && (<StyledInfoboxWrapper>
              <components_1.Alert closable onClose={function () {
                try {
                    sessionStorage.setItem('showInfobox', 'false');
                }
                catch (error) {
                    // continue regardless of error
                }
            }} type="info" message="" description={<>
                    <span role="button" tabIndex={0} onClick={function () { return setShowSaveDatasetModal(true); }} className="add-dataset-alert-description">
                      {(0, translation_1.t)('Create a dataset')}
                    </span>
                    {(0, translation_1.t)(' to edit or add columns and metrics.')}
                  </>}/>
            </StyledInfoboxWrapper>)}
          <react_virtualized_auto_sizer_1.default>
            {function (_a) {
            var height = _a.height;
            return (<DatasourceItems_1.DatasourceItems width={width - BORDER_WIDTH} height={height} folders={folders} columnRelationshipMap={columnRelationshipMap} activeJoins={activeJoins} onToggleJoin={toggleJoin}/>);
        }}
          </react_virtualized_auto_sizer_1.default>
        </div>
      </>); }, [
        inputValue,
        datasourceIsSaveable,
        width,
        folders,
        relationshipsEnabled,
        relationships,
        activeJoins,
        availableTargetColumns,
        toggleJoin,
        updateSelectedColumns,
    ]);
    return (<DatasourceContainer>
      {datasourceIsSaveable && showSaveDatasetModal && (<SaveDatasetModal_1.SaveDatasetModal visible={showSaveDatasetModal} onHide={function () { return setShowSaveDatasetModal(false); }} buttonTextOnSave={(0, translation_1.t)('Save')} buttonTextOnOverwrite={(0, translation_1.t)('Overwrite')} datasource={(0, datasourceUtils_1.getDatasourceAsSaveableDataset)(datasource)} openWindow={false} formData={formData}/>)}
      {/* @ts-expect-error */}
      <Control_1.default {...datasourceControl} name="datasource" actions={actions}/>
      {datasource.id != null && mainBody}
    </DatasourceContainer>);
}
exports.default = DataSourcePanel;
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
