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
import { useSingleViewResource } from 'src/views/CRUD/hooks';
import { RangePicker } from 'src/common/components/DatePicker';
import moment from 'moment';
import Icon from 'src/components/Icon';
import Modal from 'src/common/components/Modal';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import { JsonEditor } from 'src/components/AsyncAceEditor';

import { AnnotationObject } from './types';

interface AnnotationModalProps {
  addDangerToast: (msg: string) => void;
  annnotationLayerId: number;
  annotation?: AnnotationObject | null;
  onAnnotationAdd?: (annotation?: AnnotationObject) => void;
  onHide: () => void;
  show: boolean;
}

const StyledAnnotationTitle = styled.div`
  margin: ${({ theme }) => theme.gridUnit * 2}px auto
    ${({ theme }) => theme.gridUnit * 4}px auto;
`;

const StyledJsonEditor = styled(JsonEditor)`
  border-radius: ${({ theme }) => theme.borderRadius}px;
  border: 1px solid ${({ theme }) => theme.colors.secondary.light2};
`;

const StyledIcon = styled(Icon)`
  margin: auto ${({ theme }) => theme.gridUnit * 2}px auto 0;
`;

const AnnotationContainer = styled.div`
  margin-bottom: ${({ theme }) => theme.gridUnit * 5}px;

  .control-label {
    margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
  }

  .required {
    margin-left: ${({ theme }) => theme.gridUnit / 2}px;
    color: ${({ theme }) => theme.colors.error.base};
  }

  textarea {
    flex: 1 1 auto;
    height: ${({ theme }) => theme.gridUnit * 17}px;
    resize: none;
    width: 100%;
  }

  textarea,
  input[type='text'] {
    padding: ${({ theme }) => theme.gridUnit * 1.5}px
      ${({ theme }) => theme.gridUnit * 2}px;
    border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    border-radius: ${({ theme }) => theme.gridUnit}px;
  }

  input[type='text'] {
    width: 65%;
  }
`;

const AnnotationModal: FunctionComponent<AnnotationModalProps> = ({
  addDangerToast,
  annnotationLayerId,
  annotation = null,
  onAnnotationAdd,
  onHide,
  show,
}) => {
  const [disableSave, setDisableSave] = useState<boolean>(true);
  const [
    currentAnnotation,
    setCurrentAnnotation,
  ] = useState<AnnotationObject | null>(null);
  const [isHidden, setIsHidden] = useState<boolean>(true);
  const isEditMode = annotation !== null;

  // annotation fetch logic
  const {
    state: { loading, resource },
    fetchResource,
    createResource,
    updateResource,
  } = useSingleViewResource<AnnotationObject>(
    `annotation_layer/${annnotationLayerId}/annotation`,
    t('annotation'),
    addDangerToast,
  );

  // Functions
  const hide = () => {
    setIsHidden(true);
    onHide();
  };

  const onSave = () => {
    if (isEditMode) {
      // Edit
      if (currentAnnotation && currentAnnotation.id) {
        const update_id = currentAnnotation.id;
        delete currentAnnotation.id;
        delete currentAnnotation.created_by;
        delete currentAnnotation.changed_by;
        delete currentAnnotation.changed_on_delta_humanized;
        delete currentAnnotation.layer;
        updateResource(update_id, currentAnnotation).then(() => {
          if (onAnnotationAdd) {
            onAnnotationAdd();
          }

          hide();
        });
      }
    } else if (currentAnnotation) {
      // Create
      createResource(currentAnnotation).then(() => {
        if (onAnnotationAdd) {
          onAnnotationAdd();
        }

        hide();
      });
    }
  };

  const onAnnotationTextChange = (
    event:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const { target } = event;

    const data = {
      ...currentAnnotation,
      end_dttm: currentAnnotation ? currentAnnotation.end_dttm : '',
      short_descr: currentAnnotation ? currentAnnotation.short_descr : '',
      start_dttm: currentAnnotation ? currentAnnotation.start_dttm : '',
    };

    data[target.name] = target.value;
    setCurrentAnnotation(data);
  };

  const onJsonChange = (json: string) => {
    const data = {
      ...currentAnnotation,
      end_dttm: currentAnnotation ? currentAnnotation.end_dttm : '',
      json_metadata: json,
      short_descr: currentAnnotation ? currentAnnotation.short_descr : '',
      start_dttm: currentAnnotation ? currentAnnotation.start_dttm : '',
    };
    setCurrentAnnotation(data);
  };

  const onDateChange = (value: any, dateString: Array<string>) => {
    const data = {
      ...currentAnnotation,
      end_dttm:
        currentAnnotation && dateString[1].length
          ? moment(dateString[1]).format('YYYY-MM-DD HH:mm')
          : '',
      short_descr: currentAnnotation ? currentAnnotation.short_descr : '',
      start_dttm:
        currentAnnotation && dateString[0].length
          ? moment(dateString[0]).format('YYYY-MM-DD HH:mm')
          : '',
    };
    setCurrentAnnotation(data);
  };

  const validate = () => {
    if (
      currentAnnotation &&
      currentAnnotation.short_descr.length &&
      currentAnnotation.start_dttm.length &&
      currentAnnotation.end_dttm.length
    ) {
      setDisableSave(false);
    } else {
      setDisableSave(true);
    }
  };

  // Initialize
  if (
    isEditMode &&
    (!currentAnnotation ||
      !currentAnnotation.id ||
      (annotation && annotation.id !== currentAnnotation.id) ||
      (isHidden && show))
  ) {
    if (annotation && annotation.id !== null && !loading) {
      const id = annotation.id || 0;

      fetchResource(id).then(() => {
        setCurrentAnnotation(resource);
      });
    }
  } else if (
    !isEditMode &&
    (!currentAnnotation || currentAnnotation.id || (isHidden && show))
  ) {
    setCurrentAnnotation({
      short_descr: '',
      start_dttm: '',
      end_dttm: '',
      json_metadata: '',
      long_descr: '',
    });
  }

  // Validation
  useEffect(() => {
    validate();
  }, [
    currentAnnotation ? currentAnnotation.short_descr : '',
    currentAnnotation ? currentAnnotation.start_dttm : '',
    currentAnnotation ? currentAnnotation.end_dttm : '',
  ]);

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
      width="55%"
      title={
        <h4 data-test="annotaion-modal-title">
          {isEditMode ? (
            <StyledIcon name="edit-alt" />
          ) : (
            <StyledIcon name="plus-large" />
          )}
          {isEditMode ? t('Edit Annotation') : t('Add Annotation')}
        </h4>
      }
    >
      <StyledAnnotationTitle>
        <h4>{t('Basic Information')}</h4>
      </StyledAnnotationTitle>
      <AnnotationContainer>
        <div className="control-label">
          {t('annotation name')}
          <span className="required">*</span>
        </div>
        <input
          name="short_descr"
          onChange={onAnnotationTextChange}
          type="text"
          value={currentAnnotation?.short_descr}
        />
      </AnnotationContainer>
      <AnnotationContainer>
        <div className="control-label">
          {t('date')}
          <span className="required">*</span>
        </div>
        <RangePicker
          format="YYYY-MM-DD hh:mm a"
          onChange={onDateChange}
          showTime={{ format: 'hh:mm a' }}
          use12Hours
          value={
            currentAnnotation &&
            (currentAnnotation?.start_dttm.length ||
              currentAnnotation?.end_dttm.length)
              ? [
                  moment(currentAnnotation.start_dttm),
                  moment(currentAnnotation.end_dttm),
                ]
              : null
          }
        />
      </AnnotationContainer>
      <StyledAnnotationTitle>
        <h4>{t('Additional Information')}</h4>
      </StyledAnnotationTitle>
      <AnnotationContainer>
        <div className="control-label">{t('description')}</div>
        <textarea
          name="long_descr"
          value={currentAnnotation ? currentAnnotation.long_descr : ''}
          placeholder={t('Description (this can be seen in the list)')}
          onChange={onAnnotationTextChange}
        />
      </AnnotationContainer>
      <AnnotationContainer>
        <div className="control-label">{t('json metadata')}</div>
        <StyledJsonEditor
          onChange={onJsonChange}
          value={
            currentAnnotation && currentAnnotation.json_metadata
              ? currentAnnotation.json_metadata
              : ''
          }
          width="100%"
          height="120px"
        />
      </AnnotationContainer>
    </Modal>
  );
};

export default withToasts(AnnotationModal);
