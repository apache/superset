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
import { render, screen } from 'spec/helpers/testing-library';
import SaveDatasetActionButton from 'src/SqlLab/components/SaveDatasetActionButton';

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('SaveDatasetActionButton', () => {
  test('renders a split save button', async () => {
    const onSaveAsExplore = jest.fn();
    render(
      <SaveDatasetActionButton
        setShowSave={() => true}
        onSaveAsExplore={onSaveAsExplore}
      />,
    );

    const saveBtn = screen.getByRole('button', { name: 'Save' });
    const saveDatasetBtn = screen.getByRole('button', {
      name: /save dataset/i,
    });

    expect(
      await screen.findByRole('button', { name: 'Save' }),
    ).toBeInTheDocument();
    expect(saveBtn).toBeVisible();
    expect(saveDatasetBtn).toBeVisible();
  });
});
