import React from 'react';

import { ROW_TYPE } from '../../../util/componentTypes';
import { NEW_ROW_ID } from '../../../util/constants';
import DraggableNewComponent from './DraggableNewComponent';
import { t } from '../../../../locales';

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
