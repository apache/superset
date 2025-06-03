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

import { Component } from 'react';
import { t, safeHtmlSpan } from '@superset-ui/core';
import PropTypes from 'prop-types';
import { PivotData, flatKey } from './utilities';
import { Styles } from './Styles';

const parseLabel = (value: $TSFixMe) => {
  if (typeof value === 'string') {
    if (value === 'metric') return t('metric');
    return value;
  }
  if (typeof value === 'number') {
    return value;
  }
  return String(value);
};

function displayHeaderCell(
  needToggle: $TSFixMe,
  ArrowIcon: $TSFixMe,
  onArrowClick: $TSFixMe,
  value: $TSFixMe,
  namesMapping: $TSFixMe,
  allowRenderHtml: $TSFixMe,
) {
  const name = namesMapping[value] || value;
  const parsedLabel = parseLabel(name);
  const labelContent =
    allowRenderHtml && typeof parsedLabel === 'string'
      ? safeHtmlSpan(parsedLabel)
      : parsedLabel;
  return needToggle ? (
    <span className="toggle-wrapper">
      <span
        role="button"
        // @ts-expect-error TS(2322): Type 'string' is not assignable to type 'number'.
        tabIndex="0"
        className="toggle"
        onClick={onArrowClick}
      >
        {ArrowIcon}
      </span>
      <span className="toggle-val">{labelContent}</span>
    </span>
  ) : (
    labelContent
  );
}

export class TableRenderer extends Component {
  cachedBasePivotSettings: $TSFixMe;

  cachedProps: $TSFixMe;

  constructor(props: $TSFixMe) {
    super(props);

    // We need state to record which entries are collapsed and which aren't.
    // This is an object with flat-keys indicating if the corresponding rows
    // should be collapsed.
    this.state = { collapsedRows: {}, collapsedCols: {} };

    this.clickHeaderHandler = this.clickHeaderHandler.bind(this);
    this.clickHandler = this.clickHandler.bind(this);
  }

  getBasePivotSettings() {
    // One-time extraction of pivot settings that we'll use throughout the render.

    const { props } = this;
    // @ts-expect-error TS(2339): Property 'cols' does not exist on type 'Readonly<{... Remove this comment to see the full error message
    const colAttrs = props.cols;
    // @ts-expect-error TS(2339): Property 'rows' does not exist on type 'Readonly<{... Remove this comment to see the full error message
    const rowAttrs = props.rows;

    const tableOptions = {
      rowTotals: true,
      colTotals: true,
      // @ts-expect-error TS(2339): Property 'tableOptions' does not exist on type 'Re... Remove this comment to see the full error message
      ...props.tableOptions,
    };
    const rowTotals = tableOptions.rowTotals || colAttrs.length === 0;
    const colTotals = tableOptions.colTotals || rowAttrs.length === 0;

    // @ts-expect-error TS(2339): Property 'namesMapping' does not exist on type 'Re... Remove this comment to see the full error message
    const namesMapping = props.namesMapping || {};
    const subtotalOptions = {
      arrowCollapsed: '\u25B2',
      arrowExpanded: '\u25BC',
      // @ts-expect-error TS(2339): Property 'subtotalOptions' does not exist on type ... Remove this comment to see the full error message
      ...props.subtotalOptions,
    };

    const colSubtotalDisplay = {
      displayOnTop: false,
      enabled: tableOptions.colSubTotals,
      hideOnExpand: false,
      ...subtotalOptions.colSubtotalDisplay,
    };

    const rowSubtotalDisplay = {
      displayOnTop: false,
      enabled: tableOptions.rowSubTotals,
      hideOnExpand: false,
      ...subtotalOptions.rowSubtotalDisplay,
    };

    const pivotData = new PivotData(props, {
      rowEnabled: rowSubtotalDisplay.enabled,
      colEnabled: colSubtotalDisplay.enabled,
      rowPartialOnTop: rowSubtotalDisplay.displayOnTop,
      colPartialOnTop: colSubtotalDisplay.displayOnTop,
    });
    const rowKeys = pivotData.getRowKeys();
    const colKeys = pivotData.getColKeys();

    // Also pre-calculate all the callbacks for cells, etc... This is nice to have to
    // avoid re-calculations of the call-backs on cell expansions, etc...
    const cellCallbacks = {};
    const rowTotalCallbacks = {};
    const colTotalCallbacks = {};
    let grandTotalCallback = null;
    if (tableOptions.clickCallback) {
      rowKeys.forEach((rowKey: $TSFixMe) => {
        const flatRowKey = flatKey(rowKey);
        if (!(flatRowKey in cellCallbacks)) {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          cellCallbacks[flatRowKey] = {};
        }
        colKeys.forEach((colKey: $TSFixMe) => {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          cellCallbacks[flatRowKey][flatKey(colKey)] = this.clickHandler(
            pivotData,
            rowKey,
            colKey,
          );
        });
      });

      // Add in totals as well.
      if (rowTotals) {
        rowKeys.forEach((rowKey: $TSFixMe) => {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          rowTotalCallbacks[flatKey(rowKey)] = this.clickHandler(
            pivotData,
            rowKey,
            [],
          );
        });
      }
      if (colTotals) {
        colKeys.forEach((colKey: $TSFixMe) => {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          colTotalCallbacks[flatKey(colKey)] = this.clickHandler(
            pivotData,
            [],
            colKey,
          );
        });
      }
      if (rowTotals && colTotals) {
        grandTotalCallback = this.clickHandler(pivotData, [], []);
      }
    }

    return {
      pivotData,
      colAttrs,
      rowAttrs,
      colKeys,
      rowKeys,
      rowTotals,
      colTotals,
      arrowCollapsed: subtotalOptions.arrowCollapsed,
      arrowExpanded: subtotalOptions.arrowExpanded,
      colSubtotalDisplay,
      rowSubtotalDisplay,
      cellCallbacks,
      rowTotalCallbacks,
      colTotalCallbacks,
      grandTotalCallback,
      namesMapping,
      // @ts-expect-error TS(2339): Property 'allowRenderHtml' does not exist on type ... Remove this comment to see the full error message
      allowRenderHtml: props.allowRenderHtml,
    };
  }

  clickHandler(pivotData: $TSFixMe, rowValues: $TSFixMe, colValues: $TSFixMe) {
    // @ts-expect-error TS(2339): Property 'cols' does not exist on type 'Readonly<{... Remove this comment to see the full error message
    const colAttrs = this.props.cols;
    // @ts-expect-error TS(2339): Property 'rows' does not exist on type 'Readonly<{... Remove this comment to see the full error message
    const rowAttrs = this.props.rows;
    const value = pivotData.getAggregator(rowValues, colValues).value();
    const filters = {};
    const colLimit = Math.min(colAttrs.length, colValues.length);
    for (let i = 0; i < colLimit; i += 1) {
      const attr = colAttrs[i];
      if (colValues[i] !== null) {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        filters[attr] = colValues[i];
      }
    }
    const rowLimit = Math.min(rowAttrs.length, rowValues.length);
    for (let i = 0; i < rowLimit; i += 1) {
      const attr = rowAttrs[i];
      if (rowValues[i] !== null) {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        filters[attr] = rowValues[i];
      }
    }
    return (e: $TSFixMe) =>
      // @ts-expect-error TS(2339): Property 'tableOptions' does not exist on type 'Re... Remove this comment to see the full error message
      this.props.tableOptions.clickCallback(e, value, filters, pivotData);
  }

  clickHeaderHandler(
    pivotData: $TSFixMe,
    values: $TSFixMe,
    attrs: $TSFixMe,
    attrIdx: $TSFixMe,
    callback: $TSFixMe,
    isSubtotal = false,
    isGrandTotal = false,
  ) {
    const filters = {};
    for (let i = 0; i <= attrIdx; i += 1) {
      const attr = attrs[i];
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      filters[attr] = values[i];
    }
    return (e: $TSFixMe) =>
      callback(
        e,
        values[attrIdx],
        filters,
        pivotData,
        isSubtotal,
        isGrandTotal,
      );
  }

  collapseAttr(rowOrCol: $TSFixMe, attrIdx: $TSFixMe, allKeys: $TSFixMe) {
    return (e: $TSFixMe) => {
      // Collapse an entire attribute.
      e.stopPropagation();
      const keyLen = attrIdx + 1;
      const collapsed = allKeys
        .filter((k: $TSFixMe) => k.length === keyLen)
        .map(flatKey);

      const updates = {};
      collapsed.forEach((k: $TSFixMe) => {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        updates[k] = true;
      });

      if (rowOrCol) {
        this.setState(state => ({
          // @ts-expect-error TS(2339): Property 'collapsedRows' does not exist on type 'R... Remove this comment to see the full error message
          collapsedRows: { ...state.collapsedRows, ...updates },
        }));
      } else {
        this.setState(state => ({
          // @ts-expect-error TS(2339): Property 'collapsedCols' does not exist on type 'R... Remove this comment to see the full error message
          collapsedCols: { ...state.collapsedCols, ...updates },
        }));
      }
    };
  }

  expandAttr(rowOrCol: $TSFixMe, attrIdx: $TSFixMe, allKeys: $TSFixMe) {
    return (e: $TSFixMe) => {
      // Expand an entire attribute. This implicitly implies expanding all of the
      // parents as well. It's a bit inefficient but ah well...
      e.stopPropagation();
      const updates = {};
      allKeys.forEach((k: $TSFixMe) => {
        for (let i = 0; i <= attrIdx; i += 1) {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          updates[flatKey(k.slice(0, i + 1))] = false;
        }
      });

      if (rowOrCol) {
        this.setState(state => ({
          // @ts-expect-error TS(2339): Property 'collapsedRows' does not exist on type 'R... Remove this comment to see the full error message
          collapsedRows: { ...state.collapsedRows, ...updates },
        }));
      } else {
        this.setState(state => ({
          // @ts-expect-error TS(2339): Property 'collapsedCols' does not exist on type 'R... Remove this comment to see the full error message
          collapsedCols: { ...state.collapsedCols, ...updates },
        }));
      }
    };
  }

  toggleRowKey(flatRowKey: $TSFixMe) {
    return (e: $TSFixMe) => {
      e.stopPropagation();
      this.setState(state => ({
        collapsedRows: {
          // @ts-expect-error TS(2339): Property 'collapsedRows' does not exist on type 'R... Remove this comment to see the full error message
          ...state.collapsedRows,
          // @ts-expect-error TS(2339): Property 'collapsedRows' does not exist on type 'R... Remove this comment to see the full error message
          [flatRowKey]: !state.collapsedRows[flatRowKey],
        },
      }));
    };
  }

  toggleColKey(flatColKey: $TSFixMe) {
    return (e: $TSFixMe) => {
      e.stopPropagation();
      this.setState(state => ({
        collapsedCols: {
          // @ts-expect-error TS(2339): Property 'collapsedCols' does not exist on type 'R... Remove this comment to see the full error message
          ...state.collapsedCols,
          // @ts-expect-error TS(2339): Property 'collapsedCols' does not exist on type 'R... Remove this comment to see the full error message
          [flatColKey]: !state.collapsedCols[flatColKey],
        },
      }));
    };
  }

  calcAttrSpans(attrArr: $TSFixMe, numAttrs: $TSFixMe) {
    // Given an array of attribute values (i.e. each element is another array with
    // the value at every level), compute the spans for every attribute value at
    // every level. The return value is a nested array of the same shape. It has
    // -1's for repeated values and the span number otherwise.

    const spans = [];
    // Index of the last new value
    const li = Array(numAttrs).map(() => 0);
    let lv = Array(numAttrs).map(() => null);
    for (let i = 0; i < attrArr.length; i += 1) {
      // Keep increasing span values as long as the last keys are the same. For
      // the rest, record spans of 1. Update the indices too.
      const cv = attrArr[i];
      const ent = [];
      let depth = 0;
      const limit = Math.min(lv.length, cv.length);
      while (depth < limit && lv[depth] === cv[depth]) {
        ent.push(-1);
        spans[li[depth]][depth] += 1;
        depth += 1;
      }
      while (depth < cv.length) {
        li[depth] = i;
        ent.push(1);
        depth += 1;
      }
      spans.push(ent);
      lv = cv;
    }
    return spans;
  }

  renderColHeaderRow(
    attrName: $TSFixMe,
    attrIdx: $TSFixMe,
    pivotSettings: $TSFixMe,
  ) {
    // Render a single row in the column header at the top of the pivot table.

    const {
      rowAttrs,
      colAttrs,
      colKeys,
      visibleColKeys,
      colAttrSpans,
      rowTotals,
      arrowExpanded,
      arrowCollapsed,
      colSubtotalDisplay,
      maxColVisible,
      pivotData,
      namesMapping,
      allowRenderHtml,
    } = pivotSettings;
    const {
      highlightHeaderCellsOnHover,
      omittedHighlightHeaderGroups = [],
      highlightedHeaderCells,
      dateFormatters,
      // @ts-expect-error TS(2339): Property 'tableOptions' does not exist on type 'Re... Remove this comment to see the full error message
    } = this.props.tableOptions;

    const spaceCell =
      attrIdx === 0 && rowAttrs.length !== 0 ? (
        <th
          key="padding"
          colSpan={rowAttrs.length}
          rowSpan={colAttrs.length}
          aria-hidden="true"
        />
      ) : null;

    const needToggle =
      colSubtotalDisplay.enabled && attrIdx !== colAttrs.length - 1;
    let arrowClickHandle = null;
    let subArrow = null;
    if (needToggle) {
      arrowClickHandle =
        attrIdx + 1 < maxColVisible
          ? this.collapseAttr(false, attrIdx, colKeys)
          : this.expandAttr(false, attrIdx, colKeys);
      subArrow = attrIdx + 1 < maxColVisible ? arrowExpanded : arrowCollapsed;
    }
    const attrNameCell = (
      <th key="label" className="pvtAxisLabel">
        {displayHeaderCell(
          needToggle,
          subArrow,
          arrowClickHandle,
          attrName,
          namesMapping,
          allowRenderHtml,
        )}
      </th>
    );

    const attrValueCells = [];
    const rowIncrSpan = rowAttrs.length !== 0 ? 1 : 0;
    // Iterate through columns. Jump over duplicate values.
    let i = 0;
    while (i < visibleColKeys.length) {
      let handleContextMenu;
      const colKey = visibleColKeys[i];
      const colSpan = attrIdx < colKey.length ? colAttrSpans[i][attrIdx] : 1;
      let colLabelClass = 'pvtColLabel';
      if (attrIdx < colKey.length) {
        if (!omittedHighlightHeaderGroups.includes(colAttrs[attrIdx])) {
          if (highlightHeaderCellsOnHover) {
            colLabelClass += ' hoverable';
          }
          handleContextMenu = (e: $TSFixMe) =>
            // @ts-expect-error TS(2339): Property 'onContextMenu' does not exist on type 'R... Remove this comment to see the full error message
            this.props.onContextMenu(e, colKey, undefined, {
              [attrName]: colKey[attrIdx],
            });
        }
        if (
          highlightedHeaderCells &&
          Array.isArray(highlightedHeaderCells[colAttrs[attrIdx]]) &&
          highlightedHeaderCells[colAttrs[attrIdx]].includes(colKey[attrIdx])
        ) {
          colLabelClass += ' active';
        }

        const rowSpan = 1 + (attrIdx === colAttrs.length - 1 ? rowIncrSpan : 0);
        const flatColKey = flatKey(colKey.slice(0, attrIdx + 1));
        const onArrowClick = needToggle ? this.toggleColKey(flatColKey) : null;

        const headerCellFormattedValue =
          dateFormatters &&
          dateFormatters[attrName] &&
          typeof dateFormatters[attrName] === 'function'
            ? dateFormatters[attrName](colKey[attrIdx])
            : colKey[attrIdx];
        attrValueCells.push(
          <th
            className={colLabelClass}
            key={`colKey-${flatColKey}`}
            colSpan={colSpan}
            rowSpan={rowSpan}
            role="columnheader button"
            onClick={this.clickHeaderHandler(
              pivotData,
              colKey,
              // @ts-expect-error TS(2339): Property 'cols' does not exist on type 'Readonly<{... Remove this comment to see the full error message
              this.props.cols,
              attrIdx,
              // @ts-expect-error TS(2339): Property 'tableOptions' does not exist on type 'Re... Remove this comment to see the full error message
              this.props.tableOptions.clickColumnHeaderCallback,
            )}
            onContextMenu={handleContextMenu}
          >
            {displayHeaderCell(
              needToggle,
              // @ts-expect-error TS(2339): Property 'collapsedCols' does not exist on type 'R... Remove this comment to see the full error message
              this.state.collapsedCols[flatColKey]
                ? arrowCollapsed
                : arrowExpanded,
              onArrowClick,
              headerCellFormattedValue,
              namesMapping,
              allowRenderHtml,
            )}
          </th>,
        );
      } else if (attrIdx === colKey.length) {
        const rowSpan = colAttrs.length - colKey.length + rowIncrSpan;
        attrValueCells.push(
          <th
            className={`${colLabelClass} pvtSubtotalLabel`}
            key={`colKeyBuffer-${flatKey(colKey)}`}
            colSpan={colSpan}
            rowSpan={rowSpan}
            role="columnheader button"
            onClick={this.clickHeaderHandler(
              pivotData,
              colKey,
              // @ts-expect-error TS(2339): Property 'cols' does not exist on type 'Readonly<{... Remove this comment to see the full error message
              this.props.cols,
              attrIdx,
              // @ts-expect-error TS(2339): Property 'tableOptions' does not exist on type 'Re... Remove this comment to see the full error message
              this.props.tableOptions.clickColumnHeaderCallback,
              true,
            )}
          >
            {t('Subtotal')}
          </th>,
        );
      }
      // The next colSpan columns will have the same value anyway...
      i += colSpan;
    }

    const totalCell =
      attrIdx === 0 && rowTotals ? (
        <th
          key="total"
          className="pvtTotalLabel"
          rowSpan={colAttrs.length + Math.min(rowAttrs.length, 1)}
          role="columnheader button"
          onClick={this.clickHeaderHandler(
            pivotData,
            [],
            // @ts-expect-error TS(2339): Property 'cols' does not exist on type 'Readonly<{... Remove this comment to see the full error message
            this.props.cols,
            attrIdx,
            // @ts-expect-error TS(2339): Property 'tableOptions' does not exist on type 'Re... Remove this comment to see the full error message
            this.props.tableOptions.clickColumnHeaderCallback,
            false,
            true,
          )}
        >
          {t('Total (%(aggregatorName)s)', {
            // @ts-expect-error TS(2339): Property 'aggregatorName' does not exist on type '... Remove this comment to see the full error message
            aggregatorName: t(this.props.aggregatorName),
          })}
        </th>
      ) : null;

    const cells = [spaceCell, attrNameCell, ...attrValueCells, totalCell];
    return <tr key={`colAttr-${attrIdx}`}>{cells}</tr>;
  }

  renderRowHeaderRow(pivotSettings: $TSFixMe) {
    // Render just the attribute names of the rows (the actual attribute values
    // will show up in the individual rows).

    const {
      rowAttrs,
      colAttrs,
      rowKeys,
      arrowCollapsed,
      arrowExpanded,
      rowSubtotalDisplay,
      maxRowVisible,
      pivotData,
      namesMapping,
      allowRenderHtml,
    } = pivotSettings;
    return (
      <tr key="rowHdr">
        {rowAttrs.map((r: $TSFixMe, i: $TSFixMe) => {
          const needLabelToggle =
            rowSubtotalDisplay.enabled && i !== rowAttrs.length - 1;
          let arrowClickHandle = null;
          let subArrow = null;
          if (needLabelToggle) {
            arrowClickHandle =
              i + 1 < maxRowVisible
                ? this.collapseAttr(true, i, rowKeys)
                : this.expandAttr(true, i, rowKeys);
            subArrow = i + 1 < maxRowVisible ? arrowExpanded : arrowCollapsed;
          }
          return (
            <th className="pvtAxisLabel" key={`rowAttr-${i}`}>
              {displayHeaderCell(
                needLabelToggle,
                subArrow,
                arrowClickHandle,
                r,
                namesMapping,
                allowRenderHtml,
              )}
            </th>
          );
        })}
        <th
          className="pvtTotalLabel"
          key="padding"
          role="columnheader button"
          onClick={this.clickHeaderHandler(
            pivotData,
            [],
            // @ts-expect-error TS(2339): Property 'rows' does not exist on type 'Readonly<{... Remove this comment to see the full error message
            this.props.rows,
            0,
            // @ts-expect-error TS(2339): Property 'tableOptions' does not exist on type 'Re... Remove this comment to see the full error message
            this.props.tableOptions.clickRowHeaderCallback,
            false,
            true,
          )}
        >
          {colAttrs.length === 0
            ? t('Total (%(aggregatorName)s)', {
                // @ts-expect-error TS(2339): Property 'aggregatorName' does not exist on type '... Remove this comment to see the full error message
                aggregatorName: t(this.props.aggregatorName),
              })
            : null}
        </th>
      </tr>
    );
  }

  renderTableRow(rowKey: $TSFixMe, rowIdx: $TSFixMe, pivotSettings: $TSFixMe) {
    // Render a single row in the pivot table.

    const {
      rowAttrs,
      colAttrs,
      rowAttrSpans,
      visibleColKeys,
      pivotData,
      rowTotals,
      rowSubtotalDisplay,
      arrowExpanded,
      arrowCollapsed,
      cellCallbacks,
      rowTotalCallbacks,
      namesMapping,
      allowRenderHtml,
    } = pivotSettings;

    const {
      highlightHeaderCellsOnHover,
      omittedHighlightHeaderGroups = [],
      highlightedHeaderCells,
      cellColorFormatters,
      dateFormatters,
      // @ts-expect-error TS(2339): Property 'tableOptions' does not exist on type 'Re... Remove this comment to see the full error message
    } = this.props.tableOptions;
    const flatRowKey = flatKey(rowKey);

    const colIncrSpan = colAttrs.length !== 0 ? 1 : 0;
    const attrValueCells = rowKey.map((r: $TSFixMe, i: $TSFixMe) => {
      let handleContextMenu;
      let valueCellClassName = 'pvtRowLabel';
      if (!omittedHighlightHeaderGroups.includes(rowAttrs[i])) {
        if (highlightHeaderCellsOnHover) {
          valueCellClassName += ' hoverable';
        }
        handleContextMenu = (e: $TSFixMe) =>
          // @ts-expect-error TS(2339): Property 'onContextMenu' does not exist on type 'R... Remove this comment to see the full error message
          this.props.onContextMenu(e, undefined, rowKey, {
            [rowAttrs[i]]: r,
          });
      }
      if (
        highlightedHeaderCells &&
        Array.isArray(highlightedHeaderCells[rowAttrs[i]]) &&
        highlightedHeaderCells[rowAttrs[i]].includes(r)
      ) {
        valueCellClassName += ' active';
      }
      const rowSpan = rowAttrSpans[rowIdx][i];
      if (rowSpan > 0) {
        const flatRowKey = flatKey(rowKey.slice(0, i + 1));
        const colSpan = 1 + (i === rowAttrs.length - 1 ? colIncrSpan : 0);
        const needRowToggle =
          rowSubtotalDisplay.enabled && i !== rowAttrs.length - 1;
        const onArrowClick = needRowToggle
          ? this.toggleRowKey(flatRowKey)
          : null;

        const headerCellFormattedValue =
          dateFormatters && dateFormatters[rowAttrs[i]]
            ? dateFormatters[rowAttrs[i]](r)
            : r;
        return (
          <th
            key={`rowKeyLabel-${i}`}
            className={valueCellClassName}
            rowSpan={rowSpan}
            colSpan={colSpan}
            role="columnheader button"
            onClick={this.clickHeaderHandler(
              pivotData,
              rowKey,
              // @ts-expect-error TS(2339): Property 'rows' does not exist on type 'Readonly<{... Remove this comment to see the full error message
              this.props.rows,
              i,
              // @ts-expect-error TS(2339): Property 'tableOptions' does not exist on type 'Re... Remove this comment to see the full error message
              this.props.tableOptions.clickRowHeaderCallback,
            )}
            onContextMenu={handleContextMenu}
          >
            {displayHeaderCell(
              needRowToggle,
              // @ts-expect-error TS(2339): Property 'collapsedRows' does not exist on type 'R... Remove this comment to see the full error message
              this.state.collapsedRows[flatRowKey]
                ? arrowCollapsed
                : arrowExpanded,
              onArrowClick,
              headerCellFormattedValue,
              namesMapping,
              allowRenderHtml,
            )}
          </th>
        );
      }
      return null;
    });

    const attrValuePaddingCell =
      rowKey.length < rowAttrs.length ? (
        <th
          className="pvtRowLabel pvtSubtotalLabel"
          key="rowKeyBuffer"
          colSpan={rowAttrs.length - rowKey.length + colIncrSpan}
          rowSpan={1}
          role="columnheader button"
          onClick={this.clickHeaderHandler(
            pivotData,
            rowKey,
            // @ts-expect-error TS(2339): Property 'rows' does not exist on type 'Readonly<{... Remove this comment to see the full error message
            this.props.rows,
            rowKey.length,
            // @ts-expect-error TS(2339): Property 'tableOptions' does not exist on type 'Re... Remove this comment to see the full error message
            this.props.tableOptions.clickRowHeaderCallback,
            true,
          )}
        >
          {t('Subtotal')}
        </th>
      ) : null;

    const rowClickHandlers = cellCallbacks[flatRowKey] || {};
    const valueCells = visibleColKeys.map((colKey: $TSFixMe) => {
      const flatColKey = flatKey(colKey);
      const agg = pivotData.getAggregator(rowKey, colKey);
      const aggValue = agg.value();

      const keys = [...rowKey, ...colKey];
      let backgroundColor: $TSFixMe;
      if (cellColorFormatters) {
        Object.values(cellColorFormatters).forEach(cellColorFormatter => {
          if (Array.isArray(cellColorFormatter)) {
            keys.forEach(key => {
              if (backgroundColor) {
                return;
              }
              cellColorFormatter
                .filter(formatter => formatter.column === key)
                .forEach(formatter => {
                  const formatterResult = formatter.getColorFromValue(aggValue);
                  if (formatterResult) {
                    backgroundColor = formatterResult;
                  }
                });
            });
          }
        });
      }

      const style = agg.isSubtotal
        ? { fontWeight: 'bold' }
        : { backgroundColor };

      return (
        <td
          role="gridcell"
          className="pvtVal"
          key={`pvtVal-${flatColKey}`}
          onClick={rowClickHandlers[flatColKey]}
          // @ts-expect-error TS(2339): Property 'onContextMenu' does not exist on type 'R... Remove this comment to see the full error message
          onContextMenu={e => this.props.onContextMenu(e, colKey, rowKey)}
          style={style}
        >
          {agg.format(aggValue)}
        </td>
      );
    });

    let totalCell = null;
    if (rowTotals) {
      const agg = pivotData.getAggregator(rowKey, []);
      const aggValue = agg.value();
      totalCell = (
        <td
          role="gridcell"
          key="total"
          className="pvtTotal"
          onClick={rowTotalCallbacks[flatRowKey]}
          // @ts-expect-error TS(2339): Property 'onContextMenu' does not exist on type 'R... Remove this comment to see the full error message
          onContextMenu={e => this.props.onContextMenu(e, undefined, rowKey)}
        >
          {agg.format(aggValue)}
        </td>
      );
    }

    const rowCells = [
      ...attrValueCells,
      attrValuePaddingCell,
      ...valueCells,
      totalCell,
    ];

    return <tr key={`keyRow-${flatRowKey}`}>{rowCells}</tr>;
  }

  renderTotalsRow(pivotSettings: $TSFixMe) {
    // Render the final totals rows that has the totals for all the columns.

    const {
      rowAttrs,
      colAttrs,
      visibleColKeys,
      rowTotals,
      pivotData,
      colTotalCallbacks,
      grandTotalCallback,
    } = pivotSettings;

    const totalLabelCell = (
      <th
        key="label"
        className="pvtTotalLabel pvtRowTotalLabel"
        colSpan={rowAttrs.length + Math.min(colAttrs.length, 1)}
        role="columnheader button"
        onClick={this.clickHeaderHandler(
          pivotData,
          [],
          // @ts-expect-error TS(2339): Property 'rows' does not exist on type 'Readonly<{... Remove this comment to see the full error message
          this.props.rows,
          0,
          // @ts-expect-error TS(2339): Property 'tableOptions' does not exist on type 'Re... Remove this comment to see the full error message
          this.props.tableOptions.clickRowHeaderCallback,
          false,
          true,
        )}
      >
        {t('Total (%(aggregatorName)s)', {
          // @ts-expect-error TS(2339): Property 'aggregatorName' does not exist on type '... Remove this comment to see the full error message
          aggregatorName: t(this.props.aggregatorName),
        })}
      </th>
    );

    const totalValueCells = visibleColKeys.map((colKey: $TSFixMe) => {
      const flatColKey = flatKey(colKey);
      const agg = pivotData.getAggregator([], colKey);
      const aggValue = agg.value();

      return (
        <td
          role="gridcell"
          className="pvtTotal pvtRowTotal"
          key={`total-${flatColKey}`}
          onClick={colTotalCallbacks[flatColKey]}
          // @ts-expect-error TS(2339): Property 'onContextMenu' does not exist on type 'R... Remove this comment to see the full error message
          onContextMenu={e => this.props.onContextMenu(e, colKey, undefined)}
          style={{ padding: '5px' }}
        >
          {agg.format(aggValue)}
        </td>
      );
    });

    let grandTotalCell = null;
    if (rowTotals) {
      const agg = pivotData.getAggregator([], []);
      const aggValue = agg.value();
      grandTotalCell = (
        <td
          role="gridcell"
          key="total"
          className="pvtGrandTotal pvtRowTotal"
          onClick={grandTotalCallback}
          // @ts-expect-error TS(2339): Property 'onContextMenu' does not exist on type 'R... Remove this comment to see the full error message
          onContextMenu={e => this.props.onContextMenu(e, undefined, undefined)}
        >
          {agg.format(aggValue)}
        </td>
      );
    }

    const totalCells = [totalLabelCell, ...totalValueCells, grandTotalCell];

    return (
      <tr key="total" className="pvtRowTotals">
        {totalCells}
      </tr>
    );
  }

  visibleKeys(
    keys: $TSFixMe,
    collapsed: $TSFixMe,
    numAttrs: $TSFixMe,
    subtotalDisplay: $TSFixMe,
  ) {
    return keys.filter(
      (
        key: $TSFixMe, // Is the key hidden by one of its parents?
      ) =>
        !key.some(
          (k: $TSFixMe, j: $TSFixMe) => collapsed[flatKey(key.slice(0, j))],
        ) &&
        // Leaf key.
        (key.length === numAttrs ||
          // Children hidden. Must show total.
          flatKey(key) in collapsed ||
          // Don't hide totals.
          !subtotalDisplay.hideOnExpand),
    );
  }

  isDashboardEditMode() {
    return document.contains(document.querySelector('.dashboard--editing'));
  }

  render() {
    if (this.cachedProps !== this.props) {
      this.cachedProps = this.props;
      this.cachedBasePivotSettings = this.getBasePivotSettings();
    }
    const {
      colAttrs,
      rowAttrs,
      rowKeys,
      colKeys,
      colTotals,
      rowSubtotalDisplay,
      colSubtotalDisplay,
      allowRenderHtml,
    } = this.cachedBasePivotSettings;

    // Need to account for exclusions to compute the effective row
    // and column keys.
    const visibleRowKeys = this.visibleKeys(
      rowKeys,
      // @ts-expect-error TS(2339): Property 'collapsedRows' does not exist on type 'R... Remove this comment to see the full error message
      this.state.collapsedRows,
      rowAttrs.length,
      rowSubtotalDisplay,
    );
    const visibleColKeys = this.visibleKeys(
      colKeys,
      // @ts-expect-error TS(2339): Property 'collapsedCols' does not exist on type 'R... Remove this comment to see the full error message
      this.state.collapsedCols,
      colAttrs.length,
      colSubtotalDisplay,
    );

    const pivotSettings = {
      visibleRowKeys,
      maxRowVisible: Math.max(...visibleRowKeys.map((k: $TSFixMe) => k.length)),
      visibleColKeys,
      maxColVisible: Math.max(...visibleColKeys.map((k: $TSFixMe) => k.length)),
      rowAttrSpans: this.calcAttrSpans(visibleRowKeys, rowAttrs.length),
      colAttrSpans: this.calcAttrSpans(visibleColKeys, colAttrs.length),
      allowRenderHtml,
      ...this.cachedBasePivotSettings,
    };

    return (
      // @ts-expect-error TS(2322): Type '{ children: Element; isDashboardEditMode: bo... Remove this comment to see the full error message
      <Styles isDashboardEditMode={this.isDashboardEditMode()}>
        <table className="pvtTable" role="grid">
          <thead>
            {colAttrs.map((c: $TSFixMe, j: $TSFixMe) =>
              this.renderColHeaderRow(c, j, pivotSettings),
            )}
            {rowAttrs.length !== 0 && this.renderRowHeaderRow(pivotSettings)}
          </thead>
          <tbody>
            {visibleRowKeys.map((r: $TSFixMe, i: $TSFixMe) =>
              this.renderTableRow(r, i, pivotSettings),
            )}
            {colTotals && this.renderTotalsRow(pivotSettings)}
          </tbody>
        </table>
      </Styles>
    );
  }
}

// @ts-expect-error TS(2339): Property 'propTypes' does not exist on type 'typeo... Remove this comment to see the full error message
TableRenderer.propTypes = {
  // @ts-expect-error TS(2339): Property 'propTypes' does not exist on type 'typeo... Remove this comment to see the full error message
  ...PivotData.propTypes,
  tableOptions: PropTypes.object,
  onContextMenu: PropTypes.func,
};
// @ts-expect-error TS(2339): Property 'defaultProps' does not exist on type 'ty... Remove this comment to see the full error message
TableRenderer.defaultProps = { ...PivotData.defaultProps, tableOptions: {} };
