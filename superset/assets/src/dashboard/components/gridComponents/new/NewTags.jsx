import React from 'react';

import { TAGS_TYPE } from '../../../util/componentTypes';
import { NEW_TAGS_ID } from '../../../util/constants';
import DraggableNewComponent from './DraggableNewComponent';

export default function DraggableNewTags() {
  return (
    <DraggableNewComponent
      id={NEW_TAGS_ID}
      type={TAGS_TYPE}
      label="Tagged content"
      className="fa fa-tags"
    />
  );
}
