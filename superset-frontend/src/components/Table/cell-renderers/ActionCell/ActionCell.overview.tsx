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

// import { Meta, Source, Story, ArgsTable } from '@storybook/addon-docs';
import Markdown from 'markdown-to-jsx';
// import { ActionMenuItem } from 'src/components/Table/cell-renderers/index';
// import ActionCell from './index';
import React from 'react';

export default {
  title: 'Design System/Components/Table/Cell Renderers/ActionCell/Overview"',
};

export const ActionCell = () => (
  <>
    <Markdown>
      {`
# ActionCell

An ActionCell is used to display an overflow icon that opens a menu allowing the user to take actions
specific to the data in the table row that the cell is a member of.

### [Basic example](./?path=/docs/design-system-components-table-cell-renderers-actioncell--basic)
      `}
    </Markdown>
  </>
);
