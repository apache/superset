// DODO was here

import { FormattingPopoverProps } from 'src/explore/components/controls/ConditionalFormattingControl';
import React, { useCallback } from 'react';
import { FormattingPopoverWrapper } from '../ConditionalFormattingControlDodoWrapper/FormattingPopoverWrapper';
import { FormattingPopoverContentNoGradient } from './FormattingPopoverContentNoGradient';

const FormattingPopoverNoGradient = (props: FormattingPopoverProps) => {
  const render = useCallback(
    params => <FormattingPopoverContentNoGradient {...params} />,
    [],
  );

  return <FormattingPopoverWrapper {...props} renderContent={render} />;
};

export { FormattingPopoverNoGradient };
