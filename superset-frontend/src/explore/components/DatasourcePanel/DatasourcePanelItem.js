"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
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
var theme_1 = require("@apache-superset/core/theme");
var Icons_1 = require("@superset-ui/core/components/Icons");
var Tooltip_1 = require("@superset-ui/core/components/Tooltip");
var components_1 = require("@superset-ui/core/components");
var DatasourcePanelDragOption_1 = require("./DatasourcePanelDragOption");
var DndItemType_1 = require("../DndItemType");
var core_2 = require("@superset-ui/core");
var RelationshipBadge_1 = require("src/features/datasets/relationships/components/RelationshipBadge");
var LabelWrapper = theme_1.styled.div(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n  ", "\n"], ["\n  ", "\n"])), function (_a) {
    var theme = _a.theme;
    return (0, theme_1.css)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    color: ", ";\n    overflow: hidden;\n    text-overflow: ellipsis;\n    font-size: ", "px;\n    background-color: ", ";\n    margin: ", "px 0;\n    border-radius: ", "px;\n    padding: 0 ", "px;\n\n    &:first-of-type {\n      margin-top: 0;\n    }\n    &:last-of-type {\n      margin-bottom: 0;\n    }\n\n    padding: 0;\n    cursor: grab;\n    &:active {\n      cursor: grabbing;\n    }\n    &:hover {\n      background-color: ", ";\n    }\n\n    & > span {\n      white-space: nowrap;\n    }\n\n    .option-label {\n      display: inline;\n    }\n\n    .metric-option {\n      & > svg {\n        min-width: ", "px;\n      }\n      & > .option-label {\n        overflow: hidden;\n        text-overflow: ellipsis;\n      }\n    }\n  "], ["\n    color: ", ";\n    overflow: hidden;\n    text-overflow: ellipsis;\n    font-size: ", "px;\n    background-color: ", ";\n    margin: ", "px 0;\n    border-radius: ", "px;\n    padding: 0 ", "px;\n\n    &:first-of-type {\n      margin-top: 0;\n    }\n    &:last-of-type {\n      margin-bottom: 0;\n    }\n\n    padding: 0;\n    cursor: grab;\n    &:active {\n      cursor: grabbing;\n    }\n    &:hover {\n      background-color: ", ";\n    }\n\n    & > span {\n      white-space: nowrap;\n    }\n\n    .option-label {\n      display: inline;\n    }\n\n    .metric-option {\n      & > svg {\n        min-width: ", "px;\n      }\n      & > .option-label {\n        overflow: hidden;\n        text-overflow: ellipsis;\n      }\n    }\n  "])), theme.colorText, theme.fontSizeSM, theme.colorBgTextActive, theme.sizeUnit * 2, theme.borderRadius, theme.sizeUnit, theme.colorBgTextHover, theme.sizeUnit * 4);
});
var SectionHeaderButton = theme_1.styled.button(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n  border: none;\n  background: transparent;\n  width: 100%;\n  height: 100%;\n  padding-inline: 0;\n"], ["\n  border: none;\n  background: transparent;\n  width: 100%;\n  height: 100%;\n  padding-inline: 0;\n"])));
var SectionHeaderTextContainer = theme_1.styled.div(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  width: 100%;\n"], ["\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  width: 100%;\n"])));
var SectionHeader = (0, theme_1.styled)(components_1.Typography.Text)(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n  ", "\n"], ["\n  ", "\n"])), function (_a) {
    var theme = _a.theme;
    return (0, theme_1.css)(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    font-size: ", "px;\n    font-weight: ", ";\n    line-height: 1.3;\n    text-align: left;\n    display: -webkit-box;\n    -webkit-line-clamp: 1;\n    -webkit-box-orient: vertical;\n    overflow: hidden;\n    text-overflow: ellipsis;\n  "], ["\n    font-size: ", "px;\n    font-weight: ", ";\n    line-height: 1.3;\n    text-align: left;\n    display: -webkit-box;\n    -webkit-line-clamp: 1;\n    -webkit-box-orient: vertical;\n    overflow: hidden;\n    text-overflow: ellipsis;\n  "])), theme.fontSize, theme.fontWeightStrong);
});
var Divider = theme_1.styled.div(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n  ", "\n"], ["\n  ", "\n"])), function (_a) {
    var theme = _a.theme;
    return (0, theme_1.css)(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n    height: 16px;\n    border-bottom: 1px solid ", ";\n  "], ["\n    height: 16px;\n    border-bottom: 1px solid ", ";\n  "])), theme.colorSplit);
});
var DatasourcePanelItem = function (_a) {
    var index = _a.index, style = _a.style, data = _a.data;
    var flattenedItems = data.flattenedItems, folderMap = data.folderMap, width = data.width, onToggleCollapse = data.onToggleCollapse, collapsedFolderIds = data.collapsedFolderIds, columnRelationshipMap = data.columnRelationshipMap, activeJoins = data.activeJoins, onToggleJoin = data.onToggleJoin;
    var item = flattenedItems[index];
    var theme = (0, theme_1.useTheme)();
    var _b = (0, core_1.useCSSTextTruncation)({
        isVertical: true,
        isHorizontal: false,
    }), labelRef = _b[0], labelIsTruncated = _b[1];
    var getTooltipNode = (0, react_1.useCallback)(function (folder) {
        var tooltipNode = null;
        if (labelIsTruncated) {
            tooltipNode = (<div>
            <b>{(0, translation_1.t)('Name')}:</b> {folder.name}
          </div>);
        }
        if (folder.description) {
            tooltipNode = (<div>
            {tooltipNode}
            <div css={tooltipNode && (0, theme_1.css)(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n                  margin-top: ", "px;\n                "], ["\n                  margin-top: ", "px;\n                "])), theme.sizeUnit)}>
              <b>{(0, translation_1.t)('Description')}:</b> {folder.description}
            </div>
          </div>);
        }
        return tooltipNode;
    }, [labelIsTruncated]);
    if (!item)
        return null;
    var folder = folderMap.get(item.folderId);
    if (!folder)
        return null;
    var indentation = item.depth * theme.sizeUnit * 4;
    return (<div style={__assign(__assign({}, style), { paddingLeft: theme.sizeUnit * 4 + indentation, paddingRight: theme.sizeUnit * 4 })}>
      {item.type === 'header' && (<SectionHeaderButton onClick={function () { return onToggleCollapse(folder.id); }}>
          <Tooltip_1.Tooltip title={getTooltipNode(folder)}>
            <SectionHeaderTextContainer>
              <SectionHeader ref={labelRef}>{folder.name}</SectionHeader>
              {collapsedFolderIds.has(folder.id) ? (<Icons_1.Icons.DownOutlined iconSize="s" iconColor={theme.colorText}/>) : (<Icons_1.Icons.UpOutlined iconSize="s" iconColor={theme.colorText}/>)}
            </SectionHeaderTextContainer>
          </Tooltip_1.Tooltip>
        </SectionHeaderButton>)}

      {item.type === 'subtitle' && (<div css={(0, theme_1.css)(templateObject_10 || (templateObject_10 = __makeTemplateObject(["\n            display: flex;\n            gap: ", "px;\n            justify-content: space-between;\n            align-items: baseline;\n          "], ["\n            display: flex;\n            gap: ", "px;\n            justify-content: space-between;\n            align-items: baseline;\n          "])), theme.sizeUnit * 2)}>
          <div className="field-length" css={(0, theme_1.css)(templateObject_11 || (templateObject_11 = __makeTemplateObject(["\n              flex-shrink: 0;\n            "], ["\n              flex-shrink: 0;\n            "])))}>
            {(0, translation_1.t)("Showing %s of %s items", item.showingItems, item.totalItems)}
          </div>
        </div>)}

      {item.type === 'item' && item.item && (<LabelWrapper key={(item.item.type === 'column'
                ? item.item.column_name
                : item.item.metric_name) + String(width)} className="column">
          <div css={(0, theme_1.css)(templateObject_12 || (templateObject_12 = __makeTemplateObject(["\n              display: flex;\n              align-items: center;\n              width: 100%;\n            "], ["\n              display: flex;\n              align-items: center;\n              width: 100%;\n            "])))}>
            <div css={(0, theme_1.css)(templateObject_13 || (templateObject_13 = __makeTemplateObject(["flex: 1; min-width: 0;"], ["flex: 1; min-width: 0;"])))}>
              <DatasourcePanelDragOption_1.default value={item.item} type={item.item.type === 'column'
                ? DndItemType_1.DndItemType.Column
                : DndItemType_1.DndItemType.Metric}/>
            </div>
            {/* Relationship badges — only for columns */}
            {item.item.type === 'column' &&
                (0, core_2.isFeatureEnabled)(core_2.FeatureFlag.DatasetRelationships) &&
                columnRelationshipMap &&
                onToggleJoin &&
                (function () {
                    var colName = item.item.column_name;
                    var rels = colName
                        ? columnRelationshipMap.get(colName)
                        : undefined;
                    if (!rels || rels.length === 0)
                        return null;
                    return (<div css={(0, theme_1.css)(templateObject_14 || (templateObject_14 = __makeTemplateObject(["display: flex; gap: 2px; flex-shrink: 0; padding-right: 4px;"], ["display: flex; gap: 2px; flex-shrink: 0; padding-right: 4px;"])))}>
                    {rels.map(function (rel) {
                            var _a, _b;
                            return (<RelationshipBadge_1.RelationshipBadge key={rel.id} relationship={rel} joinActive={(_b = (_a = activeJoins === null || activeJoins === void 0 ? void 0 : activeJoins.get(rel.id)) === null || _a === void 0 ? void 0 : _a.enabled) !== null && _b !== void 0 ? _b : false} onToggleJoin={onToggleJoin}/>);
                        })}
                  </div>);
                })()}
          </div>
        </LabelWrapper>)}

      {item.type === 'divider' && (<Divider data-test="datasource-panel-divider"/>)}
    </div>);
};
exports.default = DatasourcePanelItem;
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13, templateObject_14;
