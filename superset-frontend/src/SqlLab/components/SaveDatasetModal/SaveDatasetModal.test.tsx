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
import { shallow } from 'enzyme';
import { Radio } from 'src/components/Radio';
import { AutoComplete, Input } from 'src/common/components';
import { SaveDatasetModal } from 'src/SqlLab/components/SaveDatasetModal';

describe('SaveDatasetModal', () => {
  const mockedProps = {
    visible: false,
    onOk: () => {},
    onHide: () => {},
    handleDatasetNameChange: () => {},
    handleSaveDatasetRadioBtnState: () => {},
    saveDatasetRadioBtnState: 1,
    handleOverwriteCancel: () => {},
    handleOverwriteDataset: () => {},
    handleOverwriteDatasetOption: () => {},
    defaultCreateDatasetValue: 'someDatasets',
    shouldOverwriteDataset: false,
    userDatasetOptions: [],
    disableSaveAndExploreBtn: false,
    handleSaveDatasetModalSearch: () => Promise,
    filterAutocompleteOption: () => false,
    onChangeAutoComplete: () => {},
  };
  it('renders a radio group btn', () => {
    // @ts-ignore
    const wrapper = shallow(<SaveDatasetModal {...mockedProps} />);
    expect(wrapper.find(Radio.Group)).toExist();
  });
  it('renders a autocomplete', () => {
    // @ts-ignore
    const wrapper = shallow(<SaveDatasetModal {...mockedProps} />);
    expect(wrapper.find(AutoComplete)).toExist();
  });
  it('renders an input form', () => {
    // @ts-ignore
    const wrapper = shallow(<SaveDatasetModal {...mockedProps} />);
    expect(wrapper.find(Input)).toExist();
  });
});
