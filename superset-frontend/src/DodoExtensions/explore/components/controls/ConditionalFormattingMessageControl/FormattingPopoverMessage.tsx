// DODO was here
// DODO created 45525377

import { useCallback } from 'react';
import { FormattingPopoverProps } from '../../../../../explore/components/controls/ConditionalFormattingControl';
import { FormattingPopoverWrapper } from '../ConditionalFormattingControlDodoWrapper/FormattingPopoverWrapper';
import { FormattingPopoverContentMessage } from './FormattingPopoverContentMessage';

const FormattingPopoverMessage = (props: FormattingPopoverProps) => {
  const render = useCallback(
    params => <FormattingPopoverContentMessage {...params} />,
    [],
  );

  return <FormattingPopoverWrapper {...props} renderContent={render} />;
};

export { FormattingPopoverMessage };
