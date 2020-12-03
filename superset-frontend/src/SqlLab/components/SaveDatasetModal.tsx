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

import React, { useState, FunctionComponent } from 'react';
import { Radio, AutoComplete, Input } from 'src/common/components';
import StyledModal from 'src/common/components/Modal';
import Button from 'src/components/Button';
import { styled } from '@superset-ui/core';
import { RadioChangeEvent } from 'antd/lib/radio';

interface SaveDatasetModalProps {
  visible: boolean;
  onOk: () => void;
  onHide: () => void;
  handleDatasetNameChange: (e: React.FormEvent<HTMLInputElement>) => void;
  userDatasetsOwned: Array<Record<string, any>>;
  handleSaveDatasetRadioBtnState: (e: RadioChangeEvent) => void;
  saveDatasetRadioBtnState: number;
  shouldOverwriteDataset: boolean;
  handleOverwriteCancel: () => void;
  handleOverwriteDataset: () => void;
  handleOverwriteDatasetOption: (
    data: string,
    option: Record<string, any>,
  ) => void;
  defaultCreateDatasetValue: string;
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
`;

// eslint-disable-next-line no-empty-pattern
export const SaveDatasetModal: FunctionComponent<SaveDatasetModalProps> = ({
  visible,
  onOk,
  onHide,
  handleDatasetNameChange,
  userDatasetsOwned,
  handleSaveDatasetRadioBtnState,
  saveDatasetRadioBtnState,
  shouldOverwriteDataset,
  handleOverwriteCancel,
  handleOverwriteDataset,
  handleOverwriteDatasetOption,
  defaultCreateDatasetValue,
}) => {
  const [options, setOptions] = useState<
    {
      value: string;
      datasetId: number;
    }[]
  >([]);

  const onSearch = (searchText: string) => {
    setOptions(
      !searchText
        ? []
        : userDatasetsOwned.map(d => ({
            value: d.datasetName,
            datasetId: d.datasetId,
          })),
    );
  };

  const filterAutocompleteOption = (
    inputValue: string,
    option: { value: string; datasetId: number },
  ) => {
    // We need to add "es7" to tsconfig for this to error to go way
    // https://stackoverflow.com/questions/51811239/ts2339-property-includes-does-not-exist-on-type-string/51811417
    return option.value.includes(inputValue);
  };

  return (
    <StyledModal
      show={visible}
      title="Save or Overwrite Dataset"
      onHide={onHide}
      footer={
        <>
          {!shouldOverwriteDataset && (
            <Button
              buttonSize="sm"
              buttonStyle="primary"
              className="m-r-5"
              onClick={onOk}
            >
              Save &amp; Explore
            </Button>
          )}
          {shouldOverwriteDataset && (
            <>
              <Button
                buttonSize="sm"
                buttonStyle="danger"
                className="m-r-5"
                onClick={handleOverwriteCancel}
              >
                Cancel
              </Button>
              <Button
                buttonSize="sm"
                buttonStyle="primary"
                className="m-r-5"
                onClick={handleOverwriteDataset}
              >
                Ok
              </Button>
            </>
          )}
        </>
      }
    >
      <Styles>
        {!shouldOverwriteDataset && (
          <div className="smd-body">
            <div className="smd-prompt">
              Save this query as virtual dataset to continue exploring.
            </div>
            <Radio.Group
              onChange={handleSaveDatasetRadioBtnState}
              value={saveDatasetRadioBtnState}
            >
              <Radio className="smd-radio" value={1}>
                Save as new
                <Input
                  className="smd-input"
                  defaultValue={defaultCreateDatasetValue}
                  onChange={handleDatasetNameChange}
                />
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
        )}
        {shouldOverwriteDataset && (
          <div>Are you sure you want to overwrite this dataset?</div>
        )}
      </Styles>
    </StyledModal>
  );
};
