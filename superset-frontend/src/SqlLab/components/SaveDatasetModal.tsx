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

import React, { useState, FunctionComponent} from 'react';
import { Radio, AutoComplete, Input } from 'src/common/components';
import StyledModal from 'src/common/components/Modal';
import Button from 'src/components/Button';
import { styled } from '@superset-ui/core';

interface SaveDatasetModalProps = {
}

const Styles = styled.div`
    .smd-input {
      margin-left: 45px;
      width: 290px;
    }
    .smd-autocomplete {
      margin-left: 8px;
      width: 290px;
    }
    .smd-radio {
      display: block;
      height: 30px;
      margin: 10px 0px;
      line-height: 30px;
    }
    .smd-body {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
`;

// eslint-disable-next-line no-empty-pattern
export const SaveDatasetModal: FunctionComponent<> = ({visible, onOk, onCancel, handleDatasetNameChange, userDatasetsOwned, handleSaveDatasetRadioBtnState, saveDatasetRadioBtnState, overwriteDataSet, handleOverwriteCancel, handleOverwriteDataset, handleOverwriteDatasetOption, defaultCreateDatasetValue}) => {
  const [options, setOptions] = useState([]);

  const onSearch = (searchText) => {
    console.log(userDatasetsOwned)
    setOptions(
      !searchText ? [] : userDatasetsOwned.map(d => ({value: d.dataSetName, dataSetId: d.dataSetId})),
    );
  };

  const filterAutocompleteOption = (inputValue, option) => {
    return option.value.includes(inputValue)
  }


  return (
      <StyledModal
        show={visible}
        onHide={() => {}}
        title="Save or Overwrite Dataset"
        onCancel={onCancel}
        footer={
        <>
        {!overwriteDataSet &&
            <Button
              buttonSize="sm"
              buttonStyle="primary"
              className="m-r-5"
              onClick={onOk}
            >
              Save & Explore
            </Button>
          }
          {overwriteDataSet && <> <Button
              buttonSize="sm"
              buttonStyle="danger"
              className="m-r-5"
              onClick={() => {
                handleOverwriteCancel()
              }}
            >Cancel</Button>
            <Button
              buttonSize="sm"
              buttonStyle="primary"
              className="m-r-5"
              onClick={handleOverwriteDataset}
            >Ok</Button> </>}
        </>
      }
      >
      <Styles>
        {!overwriteDataSet && <div className="smd-body">
          <div className="smd-prompt">
            Save this query as virtual dataset to continue exploring.
          </div>
          <Radio.Group onChange={handleSaveDatasetRadioBtnState} value={saveDatasetRadioBtnState}>
            <Radio className="smd-radio" value={1}>
              Save as new
              <Input className="smd-input" defaultValue={defaultCreateDatasetValue} onChange={handleDatasetNameChange} />
            </Radio>
            <Radio className="smd-radio" value={2}>
              Overwrite existing
              <AutoComplete
                className="smd-autocomplete"
                options={options}
                onSelect={handleOverwriteDatasetOption}
                onSearch={onSearch}
                placeholder="Select or type dataset name"
                filterOption={filterAutocompleteOption}
              />
            </Radio>
          </Radio.Group>
          </div>
        }
        {overwriteDataSet &&
          <div>
            Are you sure you want to overwrite this dataset?
          </div>
        }
        </Styles>
      </StyledModal>
  );
};
