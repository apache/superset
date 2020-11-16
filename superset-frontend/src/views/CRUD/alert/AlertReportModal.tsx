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
import React, { FunctionComponent, useState, useEffect } from 'react';
import { styled, t } from '@superset-ui/core';
// import { useSingleViewResource } from 'src/views/CRUD/hooks';

import Icon from 'src/components/Icon';
import Modal from 'src/common/components/Modal';
import withToasts from 'src/messageToasts/enhancers/withToasts';

import { AlertObject } from './types';

interface AlertReportModalProps {
  addDangerToast: (msg: string) => void;
  alert?: AlertObject | null;
  isReport?: boolean;
  onAdd?: (alert?: AlertObject) => void;
  onHide: () => void;
  show: boolean;
}

const StyledIcon = styled(Icon)`
  margin: auto ${({ theme }) => theme.gridUnit * 2}px auto 0;
`;

const AlertReportModal: FunctionComponent<AlertReportModalProps> = ({
  addDangerToast,
  onAdd,
  onHide,
  show,
  alert = null,
  isReport = false,
}) => {
  const [disableSave, setDisableSave] = useState<boolean>(true);
  const [currentAlert, setCurrentAlert] = useState<AlertObject | null>();
  const [isHidden, setIsHidden] = useState<boolean>(true);
  const isEditMode = alert !== null;

  // TODO: Alert fetch logic
  /* const {
    state: { loading, resource },
    fetchResource,
    createResource,
    updateResource,
  } = useSingleViewResource<AlertObject>(
    'alert',
    t('alert'),
    addDangerToast,
  ); */

  // Functions
  const hide = () => {
    setIsHidden(true);
    onHide();
  };

  const onSave = () => {
    if (isEditMode) {
      // Edit
      if (currentAlert && currentAlert.id) {
        /* const update_id = currentAlert.id;
        delete currentAlert.id;
        delete currentAlert.created_by;

        updateResource(update_id, currentAlert).then(() => {
          if (onAdd) {
            onAdd();
          }

          hide();
        }); */
        hide();
      }
    } else if (currentAlert) {
      // Create
      /* createResource(currentAlert).then(response => {
        if (onAdd) {
          onAdd(response);
        }

        hide();
      }); */
      hide();
    }
  };

  // Handle input/textarea updates
  /*const onTextChange = (
    event:
      | React.ChangeEvent<HTMLTextAreaElement>
      | React.ChangeEvent<HTMLInputElement>,
  ) => {
    const { target } = event;
    const data = {
      ...currentAlert,
      name: currentAlert ? currentAlert.name : '',
    };

    data[target.name] = target.value;
    setCurrentAlert(data);
  };*/

  const validate = () => {
    if (currentAlert && currentAlert.name.length) {
      setDisableSave(false);
    } else {
      setDisableSave(true);
    }
  };

  // Initialize
  if (
    isEditMode &&
    (!currentAlert ||
      !currentAlert.id ||
      (alert && alert.id !== currentAlert.id) ||
      (isHidden && show))
  ) {
    if (alert && alert.id !== null /*&& !loading*/) {
      /* const id = alert.id || 0;

      fetchResource(id).then(() => {
        setCurrentAlert(resource);
      }); */
    }
  } else if (
    !isEditMode &&
    (!currentAlert || currentAlert.id || (isHidden && show))
  ) {
    // TODO: update to match expected type variables
    setCurrentAlert({
      name: '',
    });
  }

  // Validation
  useEffect(() => {
    validate();
  }, [currentAlert ? currentAlert.name : '']);

  // Show/hide
  if (isHidden && show) {
    setIsHidden(false);
  }

  return (
    <Modal
      disablePrimaryButton={disableSave}
      onHandledPrimaryAction={onSave}
      onHide={hide}
      primaryButtonName={isEditMode ? t('Save') : t('Add')}
      show={show}
      width="100%"
      title={
        <h4 data-test="alert-modal-title">
          {isEditMode ? (
            <StyledIcon name="edit-alt" />
          ) : (
            <StyledIcon name="plus-large" />
          )}
          {isEditMode
            ? t(`Edit ${isReport ? 'Report' : 'Alert'}`)
            : t(`Add ${isReport ? 'Report' : 'Alert'}`)}
        </h4>
      }
    >
      <div>Content Here</div>
    </Modal>
  );
};

export default withToasts(AlertReportModal);
