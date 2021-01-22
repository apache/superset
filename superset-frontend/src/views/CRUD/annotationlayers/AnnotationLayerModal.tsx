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

import Icon from 'src/components/Icon';
import Modal from 'src/common/components/Modal';
import withToasts from 'src/messageToasts/enhancers/withToasts';

import { AnnotationLayerObject } from './types';

interface AnnotationLayerModalProps {
  addDangerToast: (msg: string) => void;
  layer?: AnnotationLayerObject | null;
  onLayerAdd?: (layer?: AnnotationLayerObject) => void;
  onHide: () => void;
  show: boolean;
}

const StyledAnnotationLayerTitle = styled.div`
  margin: ${({ theme }) => theme.gridUnit * 2}px auto
    ${({ theme }) => theme.gridUnit * 4}px auto;
`;

const StyledIcon = styled(Icon)`
  margin: auto ${({ theme }) => theme.gridUnit * 2}px auto 0;
`;

const LayerContainer = styled.div`
  margin-bottom: ${({ theme }) => theme.gridUnit * 10}px;

  .control-label {
    margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
  }

  .required {
    margin-left: ${({ theme }) => theme.gridUnit / 2}px;
    color: ${({ theme }) => theme.colors.error.base};
  }

  textarea,
  input[type='text'] {
    padding: ${({ theme }) => theme.gridUnit * 1.5}px
      ${({ theme }) => theme.gridUnit * 2}px;
    border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    border-radius: ${({ theme }) => theme.gridUnit}px;
    width: 50%;
  }

  input,
  textarea {
    flex: 1 1 auto;
  }

  textarea {
    width: 100%;
    height: 160px;
    resize: none;
  }

  input::placeholder,
  textarea::placeholder {
    color: ${({ theme }) => theme.colors.grayscale.light1};
  }
`;

const AnnotationLayerModal: FunctionComponent<AnnotationLayerModalProps> = ({
  addDangerToast,
  onLayerAdd,
  onHide,
  show,
  layer = null,
}) => {
  const [disableSave, setDisableSave] = useState<boolean>(true);
  const [
    currentLayer,
    setCurrentLayer,
  ] = useState<AnnotationLayerObject | null>();
  const [isHidden, setIsHidden] = useState<boolean>(true);
  const isEditMode = layer !== null;

  // annotation layer fetch logic
  const {
    state: { loading, resource },
    fetchResource,
    createResource,
    updateResource,
  } = useSingleViewResource<AnnotationLayerObject>(
    'annotation_layer',
    t('annotation_layer'),
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
      if (currentLayer && currentLayer.id) {
        const update_id = currentLayer.id;
        delete currentLayer.id;
        delete currentLayer.created_by;
        updateResource(update_id, currentLayer).then(() => {
          hide();
        });
      }
    } else if (currentLayer) {
      // Create
      createResource(currentLayer).then(response => {
        if (onLayerAdd) {
          onLayerAdd(response);
        }

        hide();
      });
    }
  };

  const onTextChange = (
    event:
      | React.ChangeEvent<HTMLTextAreaElement>
      | React.ChangeEvent<HTMLInputElement>,
  ) => {
    const { target } = event;
    const data = {
      ...currentLayer,
      name: currentLayer ? currentLayer.name : '',
      descr: currentLayer ? currentLayer.descr : '',
    };

    data[target.name] = target.value;
    setCurrentLayer(data);
  };

  const validate = () => {
    if (currentLayer && currentLayer.name.length) {
      setDisableSave(false);
    } else {
      setDisableSave(true);
    }
  };

  // Initialize
  if (
    isEditMode &&
    (!currentLayer ||
      !currentLayer.id ||
      (layer && layer.id !== currentLayer.id) ||
      (isHidden && show))
  ) {
    if (layer && layer.id !== null && !loading) {
      const id = layer.id || 0;

      fetchResource(id).then(() => {
        setCurrentLayer(resource);
      });
    }
  } else if (
    !isEditMode &&
    (!currentLayer || currentLayer.id || (isHidden && show))
  ) {
    setCurrentLayer({
      name: '',
      descr: '',
    });
  }

  // Validation
  useEffect(() => {
    validate();
  }, [
    currentLayer ? currentLayer.name : '',
    currentLayer ? currentLayer.descr : '',
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
        <h4 data-test="annotation-layer-modal-title">
          {isEditMode ? (
            <StyledIcon name="edit-alt" />
          ) : (
            <StyledIcon name="plus-large" />
          )}
          {isEditMode
            ? t('Edit annotation layer properties')
            : t('Add annotation layer')}
        </h4>
      }
    >
      <StyledAnnotationLayerTitle>
        <h4>{t('Basic information')}</h4>
      </StyledAnnotationLayerTitle>
      <LayerContainer>
        <div className="control-label">
          {t('Annotation layer name')}
          <span className="required">*</span>
        </div>
        <input
          name="name"
          onChange={onTextChange}
          type="text"
          value={currentLayer?.name}
        />
      </LayerContainer>
      <LayerContainer>
        <div className="control-label">{t('description')}</div>
        <textarea
          name="descr"
          value={currentLayer?.descr}
          placeholder={t('Description (this can be seen in the list)')}
          onChange={onTextChange}
        />
      </LayerContainer>
    </Modal>
  );
};

export default withToasts(AnnotationLayerModal);
