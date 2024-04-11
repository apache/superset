// DODO was here

/**
 * DODO copy origin component and:
 *  - change component name and imports according current file path
 *
 */

import React, { useCallback, useState } from 'react';
import Popover from 'src/components/Popover';
import {
  ConditionalFormattingConfig,
  FormattingPopoverProps,
} from 'src/explore/components/controls/ConditionalFormattingControl';
import { FormattingPopoverContentDodo } from './FormattingPopoverContentDodo';

// DODO changed
export const FormattingPopoverDodo = ({
  title,
  columns,
  onChange,
  config,
  children,
  ...props
}: FormattingPopoverProps) => {
  const [visible, setVisible] = useState(false);

  const handleSave = useCallback(
    (newConfig: ConditionalFormattingConfig) => {
      setVisible(false);
      onChange(newConfig);
    },
    [onChange],
  );

  return (
    <Popover
      title={title}
      content={
        // DODO changed
        <FormattingPopoverContentDodo
          onChange={handleSave}
          config={config}
          columns={columns}
        />
      }
      visible={visible}
      onVisibleChange={setVisible}
      trigger={['click']}
      overlayStyle={{ width: '450px' }}
      {...props}
    >
      {children}
    </Popover>
  );
};
