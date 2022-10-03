/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import React from 'react';
import EmptyImage from 'src/assets/images/empty.svg';
import ChartImage from 'src/assets/images/chart.svg';
import FilterImage from 'src/assets/images/filter.svg';
import { EmptyStateBig, EmptyStateMedium, EmptyStateSmall } from '.';

export default {
  title: 'Empty state',
  component: EmptyStateMedium,
};

export const SmallEmptyState = () => (
  <EmptyStateSmall
    image={<FilterImage />}
    title="Small empty state"
    description="This is an example of a small empty state"
  />
);

export const MediumEmptyState = () => (
  <EmptyStateMedium
    image={<ChartImage />}
    title="Medium empty state"
    description="This is an example of a medium empty state"
  />
);

export const MediumEmptyStateWithButton = () => (
  <EmptyStateMedium
    image={<EmptyImage />}
    title="Medium empty state"
    description="This is an example of a medium empty state with a button"
    buttonAction={() => {}}
    buttonText="Click!"
  />
);

export const BigEmptyState = () => (
  <EmptyStateBig
    image={<EmptyImage />}
    title="Big empty state"
    description="This is an example of a big empty state"
  />
);

export const BigEmptyStateWithButton = () => (
  <EmptyStateBig
    image={<ChartImage />}
    title="Big empty state"
    description="This is an example of a big empty state with a button"
    buttonText="Click!"
    buttonAction={() => {}}
  />
);
