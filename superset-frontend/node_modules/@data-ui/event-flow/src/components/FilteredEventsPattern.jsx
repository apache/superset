import { PatternLines } from '@vx/pattern';
import React from 'react';

import { FILTERED_EVENTS } from '../constants';

export default function FilteredEventsPattern() {
  return (
    <PatternLines
      id={FILTERED_EVENTS}
      height={5}
      width={5}
      stroke="#484848"
      strokeWidth={1}
      orientation={['diagonal']}
    />
  );
}
