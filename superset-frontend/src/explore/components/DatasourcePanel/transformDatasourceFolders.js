"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformDatasourceWithFolders = void 0;
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
var translation_1 = require("@apache-superset/core/translation");
var types_1 = require("src/components/Datasource/types");
var constants_1 = require("src/components/Datasource/FoldersEditor/constants");
var transformToFolderStructure = function (metricsToDisplay, columnsToDisplay, folderConfig, allMetrics, allColumns) {
    var metricsMap = new Map();
    var columnsMap = new Map();
    metricsToDisplay.forEach(function (metric) {
        metricsMap.set(metric.uuid, metric);
    });
    columnsToDisplay.forEach(function (column) {
        columnsMap.set(column.uuid, column);
    });
    var metricsInFolders = 0;
    var columnsInFolders = 0;
    var processFolder = function (datasourceFolder, parentId) {
        var folder = {
            id: datasourceFolder.uuid,
            name: datasourceFolder.name,
            description: datasourceFolder.description,
            isCollapsed: false,
            items: [],
            totalItems: 0,
            showingItems: 0,
            parentId: parentId,
        };
        if (datasourceFolder.children && datasourceFolder.children.length > 0) {
            if (!folder.subFolders) {
                folder.subFolders = [];
            }
            datasourceFolder.children.forEach(function (child) {
                if (child.type === 'folder') {
                    var subFolder = processFolder(child, folder.id);
                    folder.subFolders.push(subFolder);
                    folder.totalItems += subFolder.totalItems;
                    folder.showingItems += subFolder.showingItems;
                }
                else if (child.type === 'metric') {
                    folder.totalItems += 1;
                    metricsInFolders += 1;
                    var metric = metricsMap.get(child.uuid);
                    if (metric) {
                        folder.items.push(metric);
                        metricsMap.delete(metric.uuid);
                        folder.showingItems += 1;
                    }
                }
                else if (child.type === 'column') {
                    folder.totalItems += 1;
                    columnsInFolders += 1;
                    var column = columnsMap.get(child.uuid);
                    if (column) {
                        folder.items.push(column);
                        columnsMap.delete(column.uuid);
                        folder.showingItems += 1;
                    }
                }
            });
        }
        return folder;
    };
    var addUnassignedToFolder = function (folders, items, folderId, folderName, allItemsCount, inFoldersCount) {
        var _a;
        if (items.length === 0)
            return;
        var existing = folders.find(function (f) { return f.id === folderId; });
        if (existing) {
            (_a = existing.items).push.apply(_a, items);
            existing.totalItems += items.length;
            existing.showingItems += items.length;
        }
        else {
            folders.push({
                id: folderId,
                name: folderName,
                isCollapsed: false,
                items: items,
                totalItems: allItemsCount - inFoldersCount,
                showingItems: items.length,
            });
        }
    };
    if (!folderConfig) {
        return [
            {
                id: constants_1.DEFAULT_METRICS_FOLDER_UUID,
                name: (0, translation_1.t)('Metrics'),
                isCollapsed: false,
                items: metricsToDisplay,
                totalItems: allMetrics.length,
                showingItems: metricsToDisplay.length,
            },
            {
                id: constants_1.DEFAULT_COLUMNS_FOLDER_UUID,
                name: (0, translation_1.t)('Columns'),
                isCollapsed: false,
                items: columnsToDisplay,
                totalItems: allColumns.length,
                showingItems: columnsToDisplay.length,
            },
        ];
    }
    var folders = folderConfig.map(function (config) { return processFolder(config); });
    var unassignedMetrics = metricsToDisplay.filter(function (metric) {
        return metricsMap.has(metric.uuid);
    });
    var unassignedColumns = columnsToDisplay.filter(function (column) {
        return columnsMap.has(column.uuid);
    });
    addUnassignedToFolder(folders, unassignedMetrics, constants_1.DEFAULT_METRICS_FOLDER_UUID, (0, translation_1.t)('Metrics'), allMetrics.length, metricsInFolders);
    addUnassignedToFolder(folders, unassignedColumns, constants_1.DEFAULT_COLUMNS_FOLDER_UUID, (0, translation_1.t)('Columns'), allColumns.length, columnsInFolders);
    return folders;
};
var transformDatasourceWithFolders = function (metricsToDisplay, columnsToDisplay, folderConfig, allMetrics, allColumns) {
    var metricsWithType = metricsToDisplay.map(function (metric) { return (__assign(__assign({}, metric), { type: types_1.FoldersEditorItemType.Metric })); });
    var columnsWithType = columnsToDisplay.map(function (column) { return (__assign(__assign({}, column), { type: types_1.FoldersEditorItemType.Column })); });
    return transformToFolderStructure(metricsWithType, columnsWithType, folderConfig, allMetrics, allColumns);
};
exports.transformDatasourceWithFolders = transformDatasourceWithFolders;
