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

import Icons from 'src/components/Icons';
import { StyledIcon } from 'src/views/CRUD/utils';
import Modal from 'src/components/Modal';
import withToasts from 'src/components/MessageToasts/withToasts';
import { CssEditor } from 'src/components/AsyncAceEditor';

import { TemplateObject } from './types';

interface CssTemplateModalProps {
  addDangerToast: (msg: string) => void;
  cssTemplate?: TemplateObject | null;
  onCssTemplateAdd?: (cssTemplate?: TemplateObject) => void;
  onHide: () => void;
  show: boolean;
}

const StyledCssTemplateTitle = styled.div`
  margin: ${({ theme }) => theme.gridUnit * 2}px auto
    ${({ theme }) => theme.gridUnit * 4}px auto;
`;

const StyledCssEditor = styled(CssEditor)`
  border-radius: ${({ theme }) => theme.borderRadius}px;
  border: 1px solid ${({ theme }) => theme.colors.secondary.light2};
`;

const TemplateContainer = styled.div`
  margin-bottom: ${({ theme }) => theme.gridUnit * 10}px;

  .control-label {
    margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
  }

  .required {
    margin-left: ${({ theme }) => theme.gridUnit / 2}px;
    color: ${({ theme }) => theme.colors.error.base};
  }

  input[type='text'] {
    padding: ${({ theme }) => theme.gridUnit * 1.5}px
      ${({ theme }) => theme.gridUnit * 2}px;
    border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    border-radius: ${({ theme }) => theme.gridUnit}px;
    width: 50%;
  }
`;

const CssTemplateModal: FunctionComponent<CssTemplateModalProps> = ({
  addDangerToast,
  onCssTemplateAdd,
  onHide,
  show,
  cssTemplate = null,
}) => {
  const [disableSave, setDisableSave] = useState<boolean>(true);
  const [currentCssTemplate, setCurrentCssTemplate] =
    useState<TemplateObject | null>(null);
  const [isHidden, setIsHidden] = useState<boolean>(true);
  const isEditMode = cssTemplate !== null;

  // cssTemplate fetch logic
  const {
    state: { loading, resource },
    fetchResource,
    createResource,
    updateResource,
  } = useSingleViewResource<TemplateObject>(
    'css_template',
    t('css_template'),
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
      if (currentCssTemplate?.id) {
        const update_id = currentCssTemplate.id;
        delete currentCssTemplate.id;
        delete currentCssTemplate.created_by;
        delete currentCssTemplate.changed_by;
        delete currentCssTemplate.changed_on_delta_humanized;

        updateResource(update_id, currentCssTemplate).then(response => {
          if (!response) {
            return;
          }

          if (onCssTemplateAdd) {
            onCssTemplateAdd();
          }

          hide();
        });
      }
    } else if (currentCssTemplate) {
      // Create
      createResource(currentCssTemplate).then(response => {
        if (!response) {
          return;
        }

        if (onCssTemplateAdd) {
          onCssTemplateAdd();
        }

        hide();
      });
    }
  };

  const onTemplateNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { target } = event;

    const data = {
      ...currentCssTemplate,
      template_name: currentCssTemplate ? currentCssTemplate.template_name : '',
      css: currentCssTemplate ? currentCssTemplate.css : '',
    };

    data[target.name] = target.value;
    setCurrentCssTemplate(data);
  };

  const onCssChange = (css: string) => {
    const data = {
      ...currentCssTemplate,
      template_name: currentCssTemplate ? currentCssTemplate.template_name : '',
      css,
    };
    setCurrentCssTemplate(data);
  };

  const validate = () => {
    if (
      currentCssTemplate?.template_name.length &&
      currentCssTemplate?.css?.length
    ) {
      setDisableSave(false);
    } else {
      setDisableSave(true);
    }
  };

  // Initialize
  useEffect(() => {
    if (
      isEditMode &&
      (!currentCssTemplate?.id ||
        (cssTemplate && cssTemplate?.id !== currentCssTemplate.id) ||
        (isHidden && show))
    ) {
      if (cssTemplate?.id !== null && !loading) {
        const id = cssTemplate.id || 0;

        fetchResource(id);
      }
    } else if (
      !isEditMode &&
      (!currentCssTemplate || currentCssTemplate.id || (isHidden && show))
    ) {
      setCurrentCssTemplate({
        template_name: '',
        css: '',
      });
    }
  }, [cssTemplate]);

  useEffect(() => {
    if (resource) {
      setCurrentCssTemplate(resource);
    }
  }, [resource]);

  // Validation
  useEffect(() => {
    validate();
  }, [
    currentCssTemplate ? currentCssTemplate.template_name : '',
    currentCssTemplate ? currentCssTemplate.css : '',
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
        <h4 data-test="css-template-modal-title">
          {isEditMode ? (
            <Icons.EditAlt css={StyledIcon} />
          ) : (
            <Icons.PlusLarge css={StyledIcon} />
          )}
          {isEditMode
            ? t('Edit CSS template properties')
            : t('Add CSS template')}
        </h4>
      }
    >
      <StyledCssTemplateTitle>
        <h4>{t('Basic information')}</h4>
      </StyledCssTemplateTitle>
      <TemplateContainer>
        <div className="control-label">
          {t('Name')}
          <span className="required">*</span>
        </div>
        <input
          name="template_name"
          onChange={onTemplateNameChange}
          type="text"
          value={currentCssTemplate?.template_name}
        />
      </TemplateContainer>
      <TemplateContainer>
        <div className="control-label">
          {t('css')}
          <span className="required">*</span>
        </div>
        <StyledCssEditor
          onChange={onCssChange}
          value={currentCssTemplate?.css}
          width="100%"
        />
      </TemplateContainer>
    </Modal>
  );
};

export default withToasts(CssTemplateModal);
