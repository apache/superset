import React from 'react';
import { t } from '@superset-ui/core';

import { IKI_DATASET_DOWNLOAD_TYPE } from '../../../../util/componentTypes';
import { NEW_IKI_DATASET_DOWNLOAD_ID } from '../../../../util/constants';
import DraggableNewComponent from '../DraggableNewComponent';

export default function DraggableNewDivider() {
  return (
    <DraggableNewComponent
      id={NEW_IKI_DATASET_DOWNLOAD_ID}
      type={IKI_DATASET_DOWNLOAD_TYPE}
      label={t('Dataset Download')}
      description={t('Downlaod a Dataset with a single click')}
      className="fa fa-bars fa-rotate-90"
    />
  );
}
