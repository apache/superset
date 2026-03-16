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

import Markdown from 'markdown-to-jsx';

export default {
  title: 'Design System/Components/DropdownContainer/Overview',
};

export const Overview = () => (
  <Markdown>
    {`
# Usage

The dropdown container is used to display elements horizontally in a responsive way. If the elements don't fit in
the available width, they are displayed vertically in a dropdown. Some of the common applications in Superset are:

- Display chart filters in the CRUD views
- Horizontally display native filters in a dashboard

# Variations

The component accepts any React element which ensures a high level of variability in Superset.

To check the component in detail and its interactions, check the [DropdownContainer](/story/design-system-components-dropdowncontainer--component) page.

    `}
  </Markdown>
);
