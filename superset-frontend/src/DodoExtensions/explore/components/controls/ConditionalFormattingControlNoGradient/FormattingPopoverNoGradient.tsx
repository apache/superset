// DODO was here
// DODO created 45525377

import { FormattingPopoverProps } from 'src/explore/components/controls/ConditionalFormattingControl';
import { useCallback } from 'react';
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
