import React from 'react';
import { t } from '@superset-ui/translation';

import { ROW_TYPE } from '../../../util/componentTypes';
import { NEW_ROW_ID } from '../../../util/constants';
import DraggableNewComponent from './DraggableNewComponent';

export default function DraggableNewRow() {
  return (
    <DraggableNewComponent
      id={NEW_ROW_ID}
      type={ROW_TYPE}
      label={t('Row')}
      className="fa fa-long-arrow-right"
    />
  );
}
