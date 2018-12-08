import React from 'react';

import { MARKDOWN_TYPE } from '../../../util/componentTypes';
import { NEW_MARKDOWN_ID } from '../../../util/constants';
import DraggableNewComponent from './DraggableNewComponent';

export default function DraggableNewDivider() {
  return (
    <DraggableNewComponent
      id={NEW_MARKDOWN_ID}
      type={MARKDOWN_TYPE}
      label="Markdown"
      className="fa fa-code"
    />
  );
}
