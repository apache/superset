// DODO was here

import React, { useCallback, useState } from 'react';
import Popover from 'src/components/Popover';
import { ConditionalFormattingConfig } from 'src/explore/components/controls/ConditionalFormattingControl';
import { FormattingPopoverWrapperProps } from './types';

// DODO changed
export const FormattingPopoverWrapper = ({
  title,
  columns,
  onChange,
  config,
  children,
  renderContent,
  ...props
}: FormattingPopoverWrapperProps) => {
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
        renderContent({ onChange: handleSave, config, columns })
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
