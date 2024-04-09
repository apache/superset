// DODO was here
import shortid from 'shortid';
import { t } from '@superset-ui/core';

import {
  CHART_TYPE,
  COLUMN_TYPE,
  DIVIDER_TYPE,
  HEADER_TYPE,
  MARKDOWN_TYPE,
  ROW_TYPE,
  TABS_TYPE,
  TAB_TYPE,
  DYNAMIC_TYPE,
} from './componentTypes';

import {
  MEDIUM_HEADER,
  BACKGROUND_TRANSPARENT,
  GRID_DEFAULT_CHART_WIDTH,
  GRID_COLUMN_COUNT,
} from './constants';

const typeToDefaultMetaData = {
  [CHART_TYPE]: { width: GRID_DEFAULT_CHART_WIDTH, height: 50 },
  [COLUMN_TYPE]: {
    width: GRID_DEFAULT_CHART_WIDTH,
    background: BACKGROUND_TRANSPARENT,
  },
  [DIVIDER_TYPE]: null,
  [HEADER_TYPE]: {
    text: t('New header'),
    headerSize: MEDIUM_HEADER,
    background: BACKGROUND_TRANSPARENT,
  },
  [MARKDOWN_TYPE]: { width: GRID_DEFAULT_CHART_WIDTH, height: 50 },
  [ROW_TYPE]: { background: BACKGROUND_TRANSPARENT },
  [TABS_TYPE]: null,
  [TAB_TYPE]: {
    text: '',
    defaultText: t('Tab title'),
    placeholder: t('Tab title'),
    // DODO added
    textRU: '',
  },
  [DYNAMIC_TYPE]: {
    width: GRID_COLUMN_COUNT,
    background: BACKGROUND_TRANSPARENT,
  },
};

function uuid(type) {
  return `${type}-${shortid.generate()}`;
}

export default function entityFactory(type, meta, parents = []) {
  return {
    type,
    id: uuid(type),
    children: [],
    parents,
    meta: {
      ...typeToDefaultMetaData[type],
      ...meta,
    },
  };
}
