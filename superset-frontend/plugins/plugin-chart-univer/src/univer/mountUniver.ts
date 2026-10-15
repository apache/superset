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

/**
 * Everything that touches Univer lives here. The chart only sees the small
 * handle returned by mountUniver.
 */
import {
  CommandType,
  createUniver,
  ICommandService,
  ICommandInfo,
  IWorkbookData,
  LocaleType,
  mergeLocales,
} from '@univerjs/presets';
import {
  ContextMenuGroup,
  ContextMenuPosition,
  FWorkbook,
  IMenuManagerService,
  MenuItemType,
  UniverSheetsCorePreset,
} from '@univerjs/preset-sheets-core';
import { Observable } from 'rxjs';
import UniverPresetSheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US';
import '@univerjs/preset-sheets-core/lib/index.css';
import type { MountUniver, WorkbookData } from '../runtimeTypes';
import { mountOutline } from './outline';

export const mountUniver: MountUniver = ({
  container,
  workbook: workbookData,
  editable,
  onChange,
  getFillWidth,
  outline,
  onOutlineChange,
  headerLabels = true,
  outlineSummaryAbove,
}) => {
  // Univer's own element, so that it leaves alone the group buttons placed
  // next to it in `container` (see outline.ts)
  const host = document.createElement('div');
  // its own stacking context, below the buttons
  host.style.cssText = 'width:100%;height:100%;position:relative;z-index:0;';
  container.appendChild(host);
  const { univer, univerAPI } = createUniver({
    locale: LocaleType.EN_US,
    locales: {
      [LocaleType.EN_US]: mergeLocales(UniverPresetSheetsCoreEnUS),
    },
    presets: [
      UniverSheetsCorePreset({
        container: host,
        header: editable,
        toolbar: editable,
        formulaBar: editable,
        footer: editable ? undefined : false,
        contextMenu: editable,
        // the editor needs focus handling for typing into cells, but a
        // read-only dashboard chart shouldn't take focus from the page
        disableAutoFocus: editable ? undefined : true,
      }),
    ],
  });
  // the chart's WorkbookData only describes the fields it uses
  const workbook: FWorkbook = univerAPI.createWorkbook(
    workbookData as Partial<IWorkbookData>,
  );
  if (!editable) workbook.setEditable(false);

  // "Fill the window" in the column header menu, after "Fit for data": widens
  // the selected columns to take up the empty space right of the last column
  const freeWidth = () => {
    const sheet = workbook.getActiveSheet();
    const columns = sheet.getSheet();
    let used = 0;
    for (let c = 0; c < sheet.getMaxColumns(); c += 1) {
      if (columns.getColVisible(c)) used += sheet.getColumnWidth(c);
    }
    return Math.floor((getFillWidth?.() ?? 0) - used);
  };
  if (editable && getFillWidth) {
    // the facade's createMenu can't hide an item, so use the services directly
    // eslint-disable-next-line no-underscore-dangle
    const injector = univer.__getInjector();
    const commandId = 'superset.command.fill-window-col-width';
    injector.get(ICommandService).registerCommand({
      id: commandId,
      type: CommandType.COMMAND,
      handler: () => {
        const sheet = workbook.getActiveSheet();
        const range = workbook.getActiveRange()?.getRange();
        const free = freeWidth();
        if (!range || free < 1) return false;
        const count = range.endColumn - range.startColumn + 1;
        const extra = Math.floor(free / count);
        for (let c = range.startColumn; c <= range.endColumn; c += 1) {
          sheet.setColumnWidths(c, 1, sheet.getColumnWidth(c) + extra);
        }
        return true;
      },
    });
    injector.get(IMenuManagerService).mergeMenu({
      [ContextMenuPosition.COL_HEADER]: {
        [ContextMenuGroup.LAYOUT]: {
          [commandId]: {
            // "Fit for data" is 4, "Freeze" 5
            order: 4.5,
            menuItemFactory: () => ({
              id: commandId,
              type: MenuItemType.BUTTON,
              icon: 'AutoWidthDoubleIcon',
              title: 'Fill the window',
              // checked each time the menu opens
              hidden$: new Observable<boolean>(subscriber => {
                subscriber.next(freeWidth() < 1);
              }),
            }),
          },
        },
      },
    });
  }

  const listener =
    editable && onChange
      ? workbook.onCommandExecuted((command: ICommandInfo) => {
          // mutations are what changes the document; formula mutations only
          // carry recalculated values and would otherwise fire on every load
          if (
            command.type === CommandType.MUTATION &&
            !command.id.startsWith('formula.')
          ) {
            onChange();
          }
        })
      : null;

  const outlineView = mountOutline({
    univer,
    univerAPI,
    workbook,
    container,
    outline: outline ?? { rows: [], columns: [] },
    editable,
    headerLabels,
    summaryAbove: outlineSummaryAbove,
    onChange: onOutlineChange,
  });

  return {
    save: () => workbook.save() as unknown as WorkbookData,
    setColumnWidths: widths => {
      const sheet = workbook.getSheets()[0];
      const columns = Object.keys(widths).map(Number);
      if (!sheet || !columns.length) return;
      // a mutation rather than a command, so the change isn't on the undo
      // stack and isn't blocked when the sheet is read-only
      univerAPI.syncExecuteCommand('sheet.mutation.set-worksheet-col-width', {
        unitId: workbook.getId(),
        subUnitId: sheet.getSheetId(),
        ranges: [
          {
            startRow: 0,
            endRow: 0,
            startColumn: Math.min(...columns),
            endColumn: Math.max(...columns),
          },
        ],
        colWidth: widths,
      });
    },
    dispose: () => {
      listener?.dispose();
      outlineView.dispose();
      univer.dispose();
      host.remove();
    },
  };
};
