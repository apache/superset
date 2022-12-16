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

import { defaultQueryEditor } from 'src/SqlLab/fixtures';
import { newQueryTabName } from './newQueryTabName';

const emptyEditor = {
  ...defaultQueryEditor,
  title: '',
  schema: '',
  autorun: false,
  sql: '',
  remoteId: null,
};

describe('newQueryTabName', () => {
  it("should return default title if queryEditor's length is 0", () => {
    const defaultTitle = 'default title';
    const title = newQueryTabName([], defaultTitle);
    expect(title).toEqual(defaultTitle);
  });
  it('should return next available number if there are unsaved editors', () => {
    const untitledQueryText = 'Untitled Query';
    const unsavedEditors = [
      { ...emptyEditor, name: `${untitledQueryText} 1` },
      { ...emptyEditor, name: `${untitledQueryText} 2` },
    ];

    const nextTitle = newQueryTabName(unsavedEditors);
    expect(nextTitle).toEqual(`${untitledQueryText} 3`);
  });
});
