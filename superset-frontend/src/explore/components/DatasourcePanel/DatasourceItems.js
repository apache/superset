"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatasourceItems = void 0;
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
var react_window_1 = require("react-window");
var DatasourcePanelItem_1 = require("./DatasourcePanelItem");
var BORDER_WIDTH = 2;
var HEADER_ITEM_HEIGHT = 50;
var METRIC_OR_COLUMN_ITEM_HEIGHT = 32;
var SUBTITLE_ITEM_HEIGHT = 32;
var DIVIDER_ITEM_HEIGHT = 16;
var flattenFolderStructure = function (foldersToFlatten, collapsedFolderIds, depth, folderMap) {
    if (depth === void 0) { depth = 0; }
    if (folderMap === void 0) { folderMap = new Map(); }
    var flattenedItems = [];
    foldersToFlatten.forEach(function (folder, idx) {
        folderMap.set(folder.id, folder);
        flattenedItems.push({
            type: 'header',
            folderId: folder.id,
            depth: depth,
            height: HEADER_ITEM_HEIGHT,
        });
        if (!collapsedFolderIds.has(folder.id)) {
            flattenedItems.push({
                type: 'subtitle',
                folderId: folder.id,
                depth: depth,
                height: SUBTITLE_ITEM_HEIGHT,
                totalItems: folder.totalItems,
                showingItems: folder.showingItems,
            });
            folder.items.forEach(function (item) {
                flattenedItems.push({
                    type: 'item',
                    folderId: folder.id,
                    depth: depth,
                    item: item,
                    height: METRIC_OR_COLUMN_ITEM_HEIGHT,
                });
            });
            if (folder.subFolders && folder.subFolders.length > 0) {
                var subItems = flattenFolderStructure(folder.subFolders, collapsedFolderIds, depth + 1, folderMap).flattenedItems;
                flattenedItems.push.apply(flattenedItems, subItems);
            }
        }
        if (depth === 0 && idx !== foldersToFlatten.length - 1) {
            flattenedItems.push({
                type: 'divider',
                folderId: folder.id,
                depth: depth,
                height: DIVIDER_ITEM_HEIGHT,
            });
        }
    });
    return { flattenedItems: flattenedItems, folderMap: folderMap };
};
var DatasourceItems = function (_a) {
    var width = _a.width, height = _a.height, folders = _a.folders, columnRelationshipMap = _a.columnRelationshipMap, activeJoins = _a.activeJoins, onToggleJoin = _a.onToggleJoin;
    var listRef = (0, react_1.useRef)(null);
    var _b = (0, react_1.useState)(new Set(folders.filter(function (folder) { return folder.isCollapsed; }).map(function (folder) { return folder.id; }))), collapsedFolderIds = _b[0], setCollapsedFolderIds = _b[1];
    var _c = (0, react_1.useMemo)(function () { return flattenFolderStructure(folders, collapsedFolderIds); }, [folders, collapsedFolderIds]), flattenedItems = _c.flattenedItems, folderMap = _c.folderMap;
    var handleToggleCollapse = (0, react_1.useCallback)(function (folderId) {
        setCollapsedFolderIds(function (prevIds) {
            var newIds = new Set(prevIds);
            if (newIds.has(folderId)) {
                newIds.delete(folderId);
            }
            else {
                newIds.add(folderId);
            }
            return newIds;
        });
    }, []);
    (0, react_1.useEffect)(function () {
        var _a;
        // reset the list cache when flattenedItems length changes to recalculate the heights
        (_a = listRef.current) === null || _a === void 0 ? void 0 : _a.resetAfterIndex(0);
    }, [flattenedItems]);
    var getItemSize = (0, react_1.useCallback)(function (index) { return flattenedItems[index].height; }, [flattenedItems]);
    var itemData = (0, react_1.useMemo)(function () { return ({
        flattenedItems: flattenedItems,
        folderMap: folderMap,
        width: width,
        onToggleCollapse: handleToggleCollapse,
        collapsedFolderIds: collapsedFolderIds,
        columnRelationshipMap: columnRelationshipMap,
        activeJoins: activeJoins,
        onToggleJoin: onToggleJoin,
    }); }, [
        flattenedItems,
        folderMap,
        width,
        handleToggleCollapse,
        collapsedFolderIds,
        columnRelationshipMap,
        activeJoins,
        onToggleJoin,
    ]);
    return (<react_window_1.VariableSizeList ref={listRef} width={width - BORDER_WIDTH} height={height} itemSize={getItemSize} itemCount={flattenedItems.length} itemData={itemData} overscanCount={5}>
      {DatasourcePanelItem_1.default}
    </react_window_1.VariableSizeList>);
};
exports.DatasourceItems = DatasourceItems;
