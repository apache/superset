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
import { act } from 'react-dom/test-utils';
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import { styledMount as mount } from 'spec/helpers/theming';
import { ReactWrapper } from 'enzyme';
import fetchMock from 'fetch-mock';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import { Upload } from 'src/common/components';
import Button from 'src/components/Button';
import { ImportResourceName } from 'src/views/CRUD/types';
import ImportModelsModal from 'src/components/ImportModal';
import Modal from 'src/components/Modal';

const mockStore = configureStore([thunk]);
const store = mockStore({});

const DATABASE_IMPORT_URL = 'glob:*/api/v1/database/import/';
fetchMock.config.overwriteRoutes = true;
fetchMock.post(DATABASE_IMPORT_URL, { result: 'OK' });

const requiredProps = {
  resourceName: 'database' as ImportResourceName,
  resourceLabel: 'database',
  passwordsNeededMessage: 'Passwords are needed',
  confirmOverwriteMessage: 'Database exists',
  addDangerToast: () => {},
  addSuccessToast: () => {},
  onModelImport: () => {},
  show: true,
  onHide: () => {},
};

describe('ImportModelsModal', () => {
  let wrapper: ReactWrapper;

  beforeEach(() => {
    wrapper = mount(<ImportModelsModal {...requiredProps} />, {
      context: { store },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders', () => {
    expect(wrapper.find(ImportModelsModal)).toExist();
  });

  it('renders a Modal', () => {
    expect(wrapper.find(Modal)).toExist();
  });

  it('renders "Import database" header', () => {
    expect(wrapper.find('h4').text()).toEqual('Import database');
  });

  it('renders a file input field', () => {
    expect(wrapper.find('input[type="file"]')).toExist();
  });

  it('should render the close, file, import and cancel buttons', () => {
    expect(wrapper.find('button')).toHaveLength(4);
  });

  it('should render the import button initially disabled', () => {
    expect(wrapper.find(Button).at(2).prop('disabled')).toBe(true);
  });

  it('should render the import button enabled when a file is selected', () => {
    const file = new File([new ArrayBuffer(1)], 'model_export.zip');
    act(() => {
      const handler = wrapper.find(Upload).prop('onChange');
      if (handler) {
        handler({
          fileList: [],
          file: {
            name: 'model_export.zip',
            originFileObj: file,
            uid: '-1',
            size: 0,
            type: 'zip',
          },
        });
      }
    });
    wrapper.update();
    expect(wrapper.find(Button).at(2).prop('disabled')).toBe(false);
  });

  it('should POST with request header `Accept: application/json`', async () => {
    const file = new File([new ArrayBuffer(1)], 'model_export.zip');
    act(() => {
      const handler = wrapper.find(Upload).prop('onChange');
      if (handler) {
        handler({
          fileList: [],
          file: {
            name: 'model_export.zip',
            originFileObj: file,
            uid: '-1',
            size: 0,
            type: 'zip',
          },
        });
      }
    });
    wrapper.update();

    wrapper.find(Button).at(2).simulate('click');
    await waitForComponentToPaint(wrapper);
    expect(fetchMock.calls(DATABASE_IMPORT_URL)[0][1]?.headers).toStrictEqual({
      Accept: 'application/json',
      'X-CSRFToken': '1234',
    });
  });

  it('should render password fields when needed for import', () => {
    const wrapperWithPasswords = mount(
      <ImportModelsModal
        {...requiredProps}
        passwordFields={['databases/examples.yaml']}
      />,
      {
        context: { store },
      },
    );
    expect(wrapperWithPasswords.find('input[type="password"]')).toExist();
  });
});
