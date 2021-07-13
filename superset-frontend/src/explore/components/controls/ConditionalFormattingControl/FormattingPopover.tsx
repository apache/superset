import React, { useCallback, useState } from 'react';
import Popover from 'src/components/Popover';
import { FormattingPopoverContent } from './FormattingPopoverContent';
import { ConditionalFormattingConfig, FormattingPopoverProps } from './types';

export const FormattingPopover = ({
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
        <FormattingPopoverContent
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
