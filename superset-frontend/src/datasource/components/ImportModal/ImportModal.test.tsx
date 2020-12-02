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
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import { styledMount as mount } from 'spec/helpers/theming';
import { ReactWrapper } from 'enzyme';

import ImportDatasetModal from 'src/datasource/components/ImportModal';
import Modal from 'src/common/components/Modal';

const mockStore = configureStore([thunk]);
const store = mockStore({});

const requiredProps = {
  addDangerToast: () => {},
  addSuccessToast: () => {},
  onDatasetImport: () => {},
  show: true,
  onHide: () => {},
};

describe('ImportDatasetModal', () => {
  let wrapper: ReactWrapper;

  beforeEach(() => {
    wrapper = mount(<ImportDatasetModal {...requiredProps} />, {
      context: { store },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders', () => {
    expect(wrapper.find(ImportDatasetModal)).toExist();
  });

  it('renders a Modal', () => {
    expect(wrapper.find(Modal)).toExist();
  });

  it('renders "Import Dataset" header', () => {
    expect(wrapper.find('h4').text()).toEqual('Import Dataset');
  });

  it('renders a label and a file input field', () => {
    expect(wrapper.find('input[type="file"]')).toExist();
    expect(wrapper.find('label')).toExist();
  });

  it('should attach the label to the input field', () => {
    const id = 'datasetFile';
    expect(wrapper.find('label').prop('htmlFor')).toBe(id);
    expect(wrapper.find('input').prop('id')).toBe(id);
  });

  it('should render the close, import and cancel buttons', () => {
    expect(wrapper.find('button')).toHaveLength(3);
  });

  it('should render the import button initially disabled', () => {
    expect(wrapper.find('button[children="Import"]').prop('disabled')).toBe(
      true,
    );
  });

  it('should render the import button enabled when a file is selected', () => {
    const file = new File([new ArrayBuffer(1)], 'dataset_export.zip');
    wrapper.find('input').simulate('change', { target: { files: [file] } });

    expect(wrapper.find('button[children="Import"]').prop('disabled')).toBe(
      false,
    );
  });

  it('should render password fields when needed for import', () => {
    const wrapperWithPasswords = mount(
      <ImportDatasetModal
        {...requiredProps}
        passwordFields={['datasets/examples.yaml']}
      />,
      {
        context: { store },
      },
    );
    expect(wrapperWithPasswords.find('input[type="password"]')).toExist();
  });
});
