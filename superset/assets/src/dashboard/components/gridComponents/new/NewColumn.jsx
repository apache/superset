import React from 'react';

import { COLUMN_TYPE } from '../../../util/componentTypes';
import { NEW_COLUMN_ID } from '../../../util/constants';
import DraggableNewComponent from './DraggableNewComponent';
import { t } from '../../../../locales';

export default function DraggableNewColumn() {
  return (
    <DraggableNewComponent
      id={NEW_COLUMN_ID}
      type={COLUMN_TYPE}
      label={t('Column')}
      className="fa fa-long-arrow-down"
    />
  );
}
