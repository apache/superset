/* eslint-disable no-param-reassign */
/* eslint-disable camelcase */
/* eslint-disable no-loop-func */
import shortid from 'shortid';

import getEmptyLayout from './getEmptyLayout';

import {
  ROW_TYPE,
  COLUMN_TYPE,
  CHART_TYPE,
  MARKDOWN_TYPE,
  DASHBOARD_GRID_TYPE,
} from './componentTypes';

import { DASHBOARD_GRID_ID } from './constants';

const MAX_RECURSIVE_LEVEL = 6;
const GRID_RATIO = 4;
const ROW_HEIGHT = 8;

/**
 *
 * @param positions: single array of slices
 * @returns boundary object {top: number, bottom: number, left: number, right: number}
 */
function getBoundary(positions) {
  let top = Number.MAX_VALUE;
  let bottom = 0;
  let left = Number.MAX_VALUE;
  let right = 1;
  positions.forEach(item => {
    const { row, col, size_x, size_y } = item;
    if (row <= top) top = row;
    if (col <= left) left = col;
    if (bottom <= row + size_y) bottom = row + size_y;
    if (right <= col + size_x) right = col + size_x;
  });

  return {
    top,
    bottom,
    left,
    right,
  };
}

function generateId() {
  return shortid.generate();
}

function getRowContainer() {
  return {
    type: ROW_TYPE,
    id: `DASHBOARD_ROW_TYPE-${generateId()}`,
    children: [],
    meta: {
      background: 'BACKGROUND_TRANSPARENT',
    },
  };
}

function getColContainer() {
  return {
    type: COLUMN_TYPE,
    id: `DASHBOARD_COLUMN_TYPE-${generateId()}`,
    children: [],
    meta: {
      background: 'BACKGROUND_TRANSPARENT',
    },
  };
}

function getChartHolder(item) {
  const { size_x, size_y, slice_id, code } = item;

  const width = Math.max(1, Math.floor(size_x / GRID_RATIO));
  const height = Math.max(1, Math.round(size_y / GRID_RATIO));
  if (code !== undefined) {
    return {
      type: MARKDOWN_TYPE,
      id: `DASHBOARD_MARKDOWN_TYPE-${generateId()}`,
      children: [],
      meta: {
        width,
        height: Math.round(height * 100 / ROW_HEIGHT),
        code,
      },
    };
  }
  return {
    type: CHART_TYPE,
    id: `DASHBOARD_CHART_TYPE-${generateId()}`,
    children: [],
    meta: {
      width,
      height: Math.round(height * 100 / ROW_HEIGHT),
      chartId: parseInt(slice_id, 10),
    },
  };
}

function getChildrenMax(items, attr, layout) {
  return Math.max.apply(null, items.map(child => layout[child].meta[attr]));
}

function getChildrenSum(items, attr, layout) {
  return items.reduce(
    (preValue, child) => preValue + layout[child].meta[attr],
    0,
  );
}

function sortByRowId(item1, item2) {
  return item1.row - item2.row;
}

function sortByColId(item1, item2) {
  return item1.col - item2.col;
}

function hasOverlap(positions, xAxis = true) {
  return positions
    .slice()
    .sort(xAxis ? sortByColId : sortByRowId)
    .some((item, index, arr) => {
      if (index === arr.length - 1) {
        return false;
      }

      if (xAxis) {
        return item.col + item.size_x > arr[index + 1].col;
      }
      return item.row + item.size_y > arr[index + 1].row;
    });
}

function doConvert(positions, level, parent, root) {
  if (positions.length === 0) {
    return;
  }

  if (positions.length === 1 || level >= MAX_RECURSIVE_LEVEL) {
    // special treatment for single chart dash, always wrap chart inside a row
    if (parent.type === DASHBOARD_GRID_TYPE) {
      const rowContainer = getRowContainer();
      root[rowContainer.id] = rowContainer;
      parent.children.push(rowContainer.id);
      parent = rowContainer;
    }

    const chartHolder = getChartHolder(positions[0]);
    root[chartHolder.id] = chartHolder;
    parent.children.push(chartHolder.id);
    return;
  }

  let currentItems = positions.slice();
  const { top, bottom, left, right } = getBoundary(positions);
  // find row dividers
  const layers = [];
  let currentRow = top + 1;
  while (currentItems.length && currentRow <= bottom) {
    const upper = [];
    const lower = [];

    const isRowDivider = currentItems.every(item => {
      const { row, size_y } = item;
      if (row + size_y <= currentRow) {
        lower.push(item);
        return true;
      } else if (row >= currentRow) {
        upper.push(item);
        return true;
      }
      return false;
    });

    if (isRowDivider) {
      currentItems = upper.slice();
      layers.push(lower);
    }
    currentRow += 1;
  }

  layers.forEach(layer => {
    if (layer.length === 0) {
      return;
    }

    if (layer.length === 1 && parent.type === COLUMN_TYPE) {
      const chartHolder = getChartHolder(layer[0]);
      root[chartHolder.id] = chartHolder;
      parent.children.push(chartHolder.id);
      return;
    }

    // create a new row
    const rowContainer = getRowContainer();
    root[rowContainer.id] = rowContainer;
    parent.children.push(rowContainer.id);

    currentItems = layer.slice();
    if (!hasOverlap(currentItems)) {
      currentItems.sort(sortByColId).forEach(item => {
        const chartHolder = getChartHolder(item);
        root[chartHolder.id] = chartHolder;
        rowContainer.children.push(chartHolder.id);
      });
    } else {
      // find col dividers for each layer
      let currentCol = left + 1;
      while (currentItems.length && currentCol <= right) {
        const upper = [];
        const lower = [];

        const isColDivider = currentItems.every(item => {
          const { col, size_x } = item;
          if (col + size_x <= currentCol) {
            lower.push(item);
            return true;
          } else if (col >= currentCol) {
            upper.push(item);
            return true;
          }
          return false;
        });

        if (isColDivider) {
          if (lower.length === 1) {
            const chartHolder = getChartHolder(lower[0]);
            root[chartHolder.id] = chartHolder;
            rowContainer.children.push(chartHolder.id);
          } else {
            // create a new column
            const colContainer = getColContainer();
            root[colContainer.id] = colContainer;
            rowContainer.children.push(colContainer.id);

            if (!hasOverlap(lower, false)) {
              lower.sort(sortByRowId).forEach(item => {
                const chartHolder = getChartHolder(item);
                root[chartHolder.id] = chartHolder;
                colContainer.children.push(chartHolder.id);
              });
            } else {
              doConvert(lower, level + 2, colContainer, root);
            }

            // add col meta
            colContainer.meta.width = getChildrenMax(
              colContainer.children,
              'width',
              root,
            );
          }

          currentItems = upper.slice();
        }
        currentCol += 1;
      }
    }

    rowContainer.meta.width = getChildrenSum(
      rowContainer.children,
      'width',
      root,
    );
  });
}

export function convertToLayout(positions) {
  const root = getEmptyLayout();

  doConvert(positions, 0, root[DASHBOARD_GRID_ID], root);

  // remove row's width/height and col's height
  Object.values(root).forEach(item => {
    if (ROW_TYPE === item.type) {
      const meta = item.meta;
      delete meta.width;
    }
  });

  // console.log(JSON.stringify(root));
  return root;
}

export default function(dashboard) {
  const positions = [];

  // position data clean up. some dashboard didn't have position_json
  let { position_json } = dashboard;
  const positionDict = {};
  if (Array.isArray(position_json)) {
    position_json.forEach(position => {
      positionDict[position.slice_id] = position;
    });
  } else {
    position_json = [];
  }

  const lastRowId = Math.max(
    0,
    Math.max.apply(null, position_json.map(pos => pos.row + pos.size_y)),
  );
  let newSliceCounter = 0;
  dashboard.slices.forEach(({ slice_id, form_data }) => {
    let position = positionDict[slice_id];
    if (!position) {
      // append new slices to dashboard bottom, 3 slices per row
      position = {
        col: (newSliceCounter % 3) * 16 + 1,
        row: lastRowId + Math.floor(newSliceCounter / 3) * 16,
        size_x: 16,
        size_y: 16,
        slice_id,
      };
      newSliceCounter += 1;
    }
    if (form_data && ['markup', 'separator'].indexOf(form_data.viz_type) > -1) {
      position = {
        ...position,
        code: form_data.code,
      };
    }
    positions.push(position);
  });

  return convertToLayout(positions);
}
