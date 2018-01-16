import {
  CHART_TYPE,
  COLUMN_TYPE,
  DIVIDER_TYPE,
  HEADER_TYPE,
  MARKDOWN_TYPE,
  ROW_TYPE,
  SPACER_TYPE,
  TABS_TYPE,
  TAB_TYPE,
} from './componentTypes';

import {
  MEDIUM_HEADER,
  ROW_TRANSPARENT,
} from './constants';

const typeToDefaultMetaData = {
  [CHART_TYPE]: { width: 3, height: 15 },
  [COLUMN_TYPE]: { width: 3 },
  [DIVIDER_TYPE]: null,
  [HEADER_TYPE]: { text: 'New header', headerSize: MEDIUM_HEADER, rowStyle: ROW_TRANSPARENT },
  [MARKDOWN_TYPE]: { width: 3, height: 15 },
  [ROW_TYPE]: { rowStyle: ROW_TRANSPARENT },
  [SPACER_TYPE]: {},
  [TABS_TYPE]: null,
  [TAB_TYPE]: { text: 'New Tab' },
};

// @TODO this should be replaced by a more robust algorithm
function uuid(type) {
  return `${type}-${Math.random().toString(16)}`;
}

export default function entityFactory(type) {
  return {
    version: 'v0',
    type,
    id: uuid(type),
    children: [],
    meta: {
      ...typeToDefaultMetaData[type],
    },
  };
}
