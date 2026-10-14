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
import { useEffect, useMemo, useRef } from 'react';
import { debounce } from 'lodash-es';
import { styled } from '@apache-superset/core/theme';
import { mountUniver } from './univer/mountUniver';
import { UniverHandle } from './runtimeTypes';
import { UniverChartProps, WORKBOOK_CONTROL } from './types';
import {
  buildGrid,
  buildPivotGrid,
  buildWorkbook,
  groupRows,
  DEFAULT_LAYOUT,
  columnWidth,
  fillWidth,
  applyOutline,
  sizeHeaders,
  parseSavedState,
  serializeState,
  StretchedColumns,
  stretchColumns,
  unstretchColumns,
} from './utils/workbook';
import {
  combineGroups,
  EMPTY_OUTLINE,
  MANUAL_GROUPS,
  Outline,
  outlineDepth,
  outlineMargin,
  resolveOutline,
} from './utils/outline';

// wait for a burst of edits (typing, pasting, dragging) to finish before saving
const SAVE_DELAY_MS = 300;
// wait for the chart to stop resizing before widening the columns again
const RESIZE_DELAY_MS = 100;

const Container = styled.div<{ width: number; height: number }>`
  width: ${({ width }) => width}px;
  height: ${({ height }) => height}px;
  position: relative;
`;

export default function UniverChart(props: UniverChartProps) {
  const {
    width,
    height,
    data,
    colnames,
    coltypes,
    labels,
    editable,
    savedState,
    liveData,
    showHeaders,
    setControlValue,
    pivotRows,
    keyColumns,
    rowGrouping,
  } = props;
  const containerRef = useRef<HTMLDivElement>(null);

  // `labels` is a new object on every render, compare it by content so that
  // saving an edit doesn't rebuild the whole spreadsheet
  const labelsKey = JSON.stringify(labels);
  const { grid, layout, groups } = useMemo(() => {
    const result = pivotRows
      ? buildPivotGrid(
          data,
          colnames,
          coltypes,
          JSON.parse(labelsKey),
          pivotRows,
        )
      : {
          grid: buildGrid(data, colnames, coltypes, JSON.parse(labelsKey)),
          layout: DEFAULT_LAYOUT,
        };
    return rowGrouping && keyColumns && keyColumns > 1
      ? // a pivot has its own Total row
        groupRows(result.grid, result.layout, keyColumns, !pivotRows)
      : { ...result, groups: [] };
  }, [data, colnames, coltypes, labelsKey, pivotRows, rowGrouping, keyColumns]);

  // The saved state changes in two ways: the chart saved an edit (the sheet on
  // screen already shows it, so nothing to do), or something else changed it,
  // like "Reset spreadsheet" or loading another chart (rebuild the sheet).
  const lastSavedRef = useRef<string | null>(null);
  const latestStateRef = useRef(savedState);
  const externalRef = useRef({ state: savedState, version: 0 });
  latestStateRef.current = savedState;
  if (savedState !== externalRef.current.state) {
    externalRef.current = {
      state: savedState,
      version:
        externalRef.current.version +
        (savedState === lastSavedRef.current ? 0 : 1),
    };
  }
  const externalVersion = externalRef.current.version;

  const setControlValueRef = useRef(setControlValue);
  setControlValueRef.current = setControlValue;

  // columns are widened to fill the chart, that is not saved (see
  // unstretchColumns) so the sheet fits again at any other size
  const widthRef = useRef(width);
  widthRef.current = width;
  const handleRef = useRef<UniverHandle | null>(null);
  const stretchedRef = useRef<StretchedColumns>({});
  // collapsible groups of the sheet on screen
  const outlineRef = useRef<Outline>(EMPTY_OUTLINE);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const saved = parseSavedState(latestStateRef.current);
    // groups are tied to the query's rows when they come from the query
    const savedOutline = resolveOutline(
      saved?.outline,
      liveData || saved?.stripped ? grid : [],
      layout.headerRows,
      keyColumns,
    );
    // without manual groups, only the collapsed state of the automatic ones
    // is taken from the saved chart
    const savedRows = MANUAL_GROUPS
      ? savedOutline.rows
      : savedOutline.rows.filter(group =>
          groups.some(
            auto => auto.start === group.start && auto.end === group.end,
          ),
        );
    outlineRef.current = {
      rows: combineGroups(groups, savedRows),
      columns: MANUAL_GROUPS ? savedOutline.columns : [],
    };
    const mountedOutline = outlineRef.current;
    const headerLabels = editable || showHeaders;
    const workbookData = sizeHeaders(
      applyOutline(
        buildWorkbook(grid, saved, liveData, layout),
        mountedOutline,
        grid,
      ),
      headerLabels,
      mountedOutline,
    );
    const fitted = stretchColumns(workbookData, widthRef.current);
    stretchedRef.current = fitted.stretched;

    let handle: UniverHandle | null = null;
    const save = debounce(() => {
      if (!handle) return;
      const state = serializeState(
        unstretchColumns(handle.save(), stretchedRef.current),
        grid,
        liveData,
        layout,
        { groups: outlineRef.current, keyColumns },
      );
      if (state === lastSavedRef.current || state === latestStateRef.current) {
        return;
      }
      lastSavedRef.current = state;
      // a rebuild right after this flush must start from this state, the
      // new props haven't arrived yet
      latestStateRef.current = state;
      setControlValueRef.current?.(WORKBOOK_CONTROL, state);
    }, SAVE_DELAY_MS);

    handle = mountUniver({
      container,
      workbook: fitted.workbook,
      editable,
      onChange: editable ? save : undefined,
      // the margin for row groups grows and shrinks as groups change
      getFillWidth: () =>
        fillWidth(fitted.workbook, widthRef.current) +
        outlineMargin(outlineDepth(mountedOutline.rows)) -
        outlineMargin(outlineDepth(outlineRef.current.rows)),
      outline: mountedOutline,
      headerLabels,
      outlineSummaryAbove: groups.length > 0,
      onOutlineChange: editable
        ? outline => {
            outlineRef.current = outline;
            save();
          }
        : undefined,
    });
    handleRef.current = handle;

    return () => {
      // keep edits made just before the chart re-renders or Explore closes
      save.flush();
      handleRef.current = null;
      handle?.dispose();
    };
  }, [
    grid,
    layout,
    groups,
    keyColumns,
    editable,
    liveData,
    showHeaders,
    externalVersion,
  ]);

  useEffect(() => {
    const restretch = debounce(() => {
      const handle = handleRef.current;
      if (!handle) return;
      const current = handle.save();
      const base = unstretchColumns(current, stretchedRef.current);
      const { stretched } = stretchColumns(base, width);
      const widths: Record<number, number> = {};
      const columns = new Set([
        ...Object.keys(stretchedRef.current),
        ...Object.keys(stretched),
      ]);
      columns.forEach(key => {
        const c = Number(key);
        const target = stretched[c]?.w ?? columnWidth(base, c);
        if (target !== undefined && target !== columnWidth(current, c)) {
          widths[c] = target;
        }
      });
      // set before the widths change, so saving sees them as stretched
      stretchedRef.current = stretched;
      if (Object.keys(widths).length) handle.setColumnWidths(widths);
    }, RESIZE_DELAY_MS);
    restretch();
    return () => restretch.cancel();
  }, [width]);

  return <Container ref={containerRef} width={width} height={height} />;
}
