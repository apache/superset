// @flow

import { type ElementConfig } from 'react';
import { makeAsyncSelect } from './Async';
import { makeCreatableSelect } from './Creatable';
import manageState from './stateManager';
import Select from './Select';

const SelectCreatable = makeCreatableSelect<ElementConfig<typeof Select>>(
  Select
);
const SelectCreatableState = manageState<ElementConfig<typeof SelectCreatable>>(
  SelectCreatable
);

export default makeAsyncSelect<ElementConfig<typeof SelectCreatableState>>(
  SelectCreatableState
);
