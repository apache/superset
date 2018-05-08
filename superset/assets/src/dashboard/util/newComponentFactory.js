import shortid from 'shortid';

import {
  CHART_TYPE,
  COLUMN_TYPE,
  DIVIDER_TYPE,
  HEADER_TYPE,
  MARKDOWN_TYPE,
  ROW_TYPE,
  TABS_TYPE,
  TAB_TYPE,
} from './componentTypes';

import { MEDIUM_HEADER, BACKGROUND_TRANSPARENT } from './constants';

const typeToDefaultMetaData = {
  [CHART_TYPE]: { width: 3, height: 30 },
  [COLUMN_TYPE]: { width: 3, background: BACKGROUND_TRANSPARENT },
  [DIVIDER_TYPE]: null,
  [HEADER_TYPE]: {
    text: 'New header',
    headerSize: MEDIUM_HEADER,
    background: BACKGROUND_TRANSPARENT,
  },
  [MARKDOWN_TYPE]: { width: 3, height: 30 },
  [ROW_TYPE]: { background: BACKGROUND_TRANSPARENT },
  [TABS_TYPE]: null,
  [TAB_TYPE]: { text: 'New Tab' },
};

function uuid(type) {
  return `${type}-${shortid.generate()}`;
}

export default function entityFactory(type, meta) {
  return {
    type,
    id: uuid(type),
    children: [],
    meta: {
      ...typeToDefaultMetaData[type],
      ...meta,
    },
  };
}
