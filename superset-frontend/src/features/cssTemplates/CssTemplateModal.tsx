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
import { FunctionComponent, useState, useEffect, ChangeEvent } from 'react';
import { css, styled, t } from '@superset-ui/core';
import { useSingleViewResource } from 'src/views/CRUD/hooks';
import { ModalTitleWithIcon } from 'src/components/ModalTitleWithIcon';
import withToasts from 'src/components/MessageToasts/withToasts';
import { Input, CssEditor, Modal } from '@superset-ui/core/components';
import { Typography } from '@superset-ui/core/components/Typography';
import { OnlyKeyWithType } from 'src/utils/types';
import { TemplateObject } from './types';

interface CssTemplateModalProps {
  addDangerToast: (msg: string) => void;
  cssTemplate?: TemplateObject | null;
  onCssTemplateAdd?: (cssTemplate?: TemplateObject) => void;
  onHide: () => void;
  show: boolean;
}

type CssTemplateStringKeys = keyof Pick<
  TemplateObject,
  OnlyKeyWithType<TemplateObject, String>
>;

const StyledCssTemplateTitle = styled.div(
  ({ theme }) => css`
    margin: ${theme.sizeUnit * 2}px auto ${theme.sizeUnit * 4}px auto;
  `,
);

const StyledCssEditor = styled(CssEditor)`
  ${({ theme }) => css`
    border-radius: ${theme.borderRadius}px;
    border: 1px solid ${theme.colorPrimaryBg};
  `}
`;

const TemplateContainer = styled.div(
  ({ theme }) => css`
    margin-bottom: ${theme.sizeUnit * 10}px;

    .control-label {
      margin-bottom: ${theme.sizeUnit * 2}px;
    }

    .required {
      margin-left: ${theme.sizeUnit / 2}px;
      color: ${theme.colorErrorText};
    }

    input[type='text'] {
      padding: ${theme.sizeUnit * 1.5}px ${theme.sizeUnit * 2}px;
      border: 1px solid ${theme.colorBorder};
      border-radius: ${theme.borderRadius}px;
      width: 50%;
    }
  `,
);

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
    onHide();
    setCurrentCssTemplate(null);
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

  const onTemplateNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { target } = event;

    const data = {
      ...currentCssTemplate,
      template_name: currentCssTemplate ? currentCssTemplate.template_name : '',
      css: currentCssTemplate ? currentCssTemplate.css : '',
    };

    data[target.name as CssTemplateStringKeys] = target.value;
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
  }, [cssTemplate, show]);

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
        <ModalTitleWithIcon
          isEditMode={isEditMode}
          title={
            isEditMode
              ? t('Edit CSS template properties')
              : t('Add CSS template')
          }
          data-test="css-template-modal-title"
        />
      }
    >
      <StyledCssTemplateTitle>
        <Typography.Title level={4}>{t('Basic information')}</Typography.Title>
      </StyledCssTemplateTitle>
      <TemplateContainer>
        <div className="control-label">
          {t('Name')}
          <span className="required">*</span>
        </div>
        <Input
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
