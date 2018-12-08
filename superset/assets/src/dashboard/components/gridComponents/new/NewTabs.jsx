import React from 'react';
import { t } from '@superset-ui/translation';

import { TABS_TYPE } from '../../../util/componentTypes';
import { NEW_TABS_ID } from '../../../util/constants';
import DraggableNewComponent from './DraggableNewComponent';

export default function DraggableNewTabs() {
  return (
    <DraggableNewComponent
      id={NEW_TABS_ID}
      type={TABS_TYPE}
      label={t('Tabs')}
      className="fa fa-window-restore"
    />
  );
}
