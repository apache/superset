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
import { isValidElement, cloneElement, useMemo, useRef, useState } from 'react';
import { isNil } from 'lodash';
import { css, styled, t, useTheme } from '@superset-ui/core';
import { Modal as AntdModal, ModalProps as AntdModalProps } from 'antd';
import { Resizable } from 're-resizable';
import Draggable, {
  DraggableBounds,
  DraggableData,
  DraggableEvent,
} from 'react-draggable';
import { Icons } from '../Icons';
import { Button } from '../Button';
import type { ModalProps, StyledModalProps } from './types';

const MODAL_HEADER_HEIGHT = 55;
const MODAL_MIN_CONTENT_HEIGHT = 54;
const MODAL_FOOTER_HEIGHT = 65;

const RESIZABLE_MIN_HEIGHT = MODAL_HEADER_HEIGHT + MODAL_MIN_CONTENT_HEIGHT;
const RESIZABLE_MIN_WIDTH = '380px';
const RESIZABLE_MAX_HEIGHT = '100vh';
const RESIZABLE_MAX_WIDTH = '100vw';

export const BaseModal = (props: AntdModalProps) => (
  // Removes mask animation. Fixed in 4.6.0.
  // https://github.com/ant-design/ant-design/issues/27192
  <AntdModal {...props} maskTransitionName="" />
);

export const StyledModal = styled(BaseModal)<StyledModalProps>`
  ${({
    theme,
    responsive,
    maxWidth,
    resizable,
    height,
    draggable,
    hideFooter,
  }) => css`
    ${responsive &&
    css`
      max-width: ${maxWidth ?? '900px'};
      padding-left: ${theme.sizeUnit * 3}px;
      padding-right: ${theme.sizeUnit * 3}px;
      padding-bottom: 0;
      top: 0;
    `}

    .ant-modal-content {
      background-color: ${theme.colorBgContainer};
      display: flex;
      flex-direction: column;
      max-height: calc(100vh - ${theme.sizeUnit * 8}px);
      margin-bottom: ${theme.sizeUnit * 4}px;
      margin-top: ${theme.sizeUnit * 4}px;
      padding: 0;
    }

    .ant-modal-header {
      flex: 0 0 auto;
      border-radius: ${theme.borderRadius}px ${theme.borderRadius}px 0 0;
      padding: ${theme.sizeUnit * 4}px ${theme.sizeUnit * 4}px;

      .ant-modal-title {
        font-weight: ${theme.fontWeightStrong};
      }

      .ant-modal-title h4 {
        display: flex;
        margin: 0;
        align-items: center;
      }
    }

    .ant-modal-close {
      width: ${theme.sizeUnit * 14}px;
      height: ${theme.sizeUnit * 14}px;
      padding: ${theme.sizeUnit * 6}px ${theme.sizeUnit * 4}px
        ${theme.sizeUnit * 4}px;
      top: 0;
      right: 0;
      display: flex;
      justify-content: center;
    }

    .ant-modal-close:hover {
      background: transparent;
    }

    .ant-modal-close-x {
      display: flex;
      align-items: center;
      [data-test='close-modal-btn'] {
        justify-content: center;
      }
      .close {
        flex: 1 1 auto;
        margin-bottom: ${theme.sizeUnit}px;
        color: ${theme.colorPrimaryText};
        font-weight: ${theme.fontWeightLight};
      }
    }

    .ant-modal-body {
      flex: 0 1 auto;
      padding: ${theme.sizeUnit * 4}px ${theme.sizeUnit * 6}px;

      overflow: auto;
      ${!resizable && height && `height: ${height};`}
    }

    .ant-modal-footer {
      flex: 0 0 1;
      border-top: ${theme.sizeUnit / 4}px solid ${theme.colorSplit};
      padding: ${theme.sizeUnit * 4}px;
      margin-top: 0;

      .btn {
        font-size: 12px;
      }

      .btn + .btn {
        margin-left: ${theme.sizeUnit * 2}px;
      }
    }

    &.no-content-padding .ant-modal-body {
      padding: 0;
    }

    ${draggable &&
    css`
      .ant-modal-header {
        padding: 0;

        .draggable-trigger {
          cursor: move;
          padding: ${theme.sizeUnit * 4}px;
          width: 100%;
        }
      }
    `}

    ${resizable &&
    css`
      .resizable {
        pointer-events: all;

        .resizable-wrapper {
          height: 100%;
        }

        .ant-modal-content {
          height: 100%;

          .ant-modal-body {
            height: ${hideFooter
              ? `calc(100% - ${MODAL_HEADER_HEIGHT}px)`
              : `calc(100% - ${MODAL_HEADER_HEIGHT}px - ${MODAL_FOOTER_HEIGHT}px)`};
          }
        }
      }
    `}
  `}
`;

const defaultResizableConfig = (hideFooter: boolean | undefined) => ({
  maxHeight: RESIZABLE_MAX_HEIGHT,
  maxWidth: RESIZABLE_MAX_WIDTH,
  minHeight: hideFooter
    ? RESIZABLE_MIN_HEIGHT
    : RESIZABLE_MIN_HEIGHT + MODAL_FOOTER_HEIGHT,
  minWidth: RESIZABLE_MIN_WIDTH,
  enable: {
    bottom: true,
    bottomLeft: false,
    bottomRight: true,
    left: false,
    top: false,
    topLeft: false,
    topRight: false,
    right: true,
  },
});

const CustomModal = ({
  children,
  disablePrimaryButton = false,
  primaryTooltipMessage,
  primaryButtonLoading = false,
  onHide,
  onHandledPrimaryAction,
  primaryButtonName = t('OK'),
  primaryButtonStyle = 'primary',
  show,
  name,
  title,
  width,
  maxWidth,
  responsive = false,
  centered,
  footer,
  hideFooter,
  wrapProps,
  draggable = false,
  resizable = false,
  resizableConfig = defaultResizableConfig(hideFooter),
  draggableConfig,
  destroyOnHidden,
  openerRef,
  ...rest
}: ModalProps) => {
  const draggableRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<DraggableBounds>();
  const [dragDisabled, setDragDisabled] = useState<boolean>(true);
  const theme = useTheme();

  const handleOnHide = () => {
    openerRef?.current?.focus();
    onHide();
  };

  let FooterComponent;

  // This safely avoids injecting "closeModal" into native elements like <div> or <span>
  if (isValidElement(footer) && typeof footer.type === 'function')
    // If a footer component is provided inject a closeModal function
    // so the footer can provide a "close" button if desired
    FooterComponent = cloneElement(footer, {
      closeModal: handleOnHide,
    } as Partial<unknown>);
  else FooterComponent = footer;

  const modalFooter = isNil(FooterComponent)
    ? [
        <Button
          key="back"
          cta
          data-test="modal-cancel-button"
          buttonStyle="secondary"
          onClick={handleOnHide}
        >
          {t('Cancel')}
        </Button>,
        <Button
          key="submit"
          buttonStyle={primaryButtonStyle}
          disabled={disablePrimaryButton}
          tooltip={primaryTooltipMessage}
          loading={primaryButtonLoading}
          onClick={onHandledPrimaryAction}
          cta
          data-test="modal-confirm-button"
        >
          {primaryButtonName}
        </Button>,
      ]
    : FooterComponent;

  const modalWidth = width || (responsive ? '100vw' : '600px');
  const shouldShowMask = !(resizable || draggable);

  const onDragStart = (_: DraggableEvent, uiData: DraggableData) => {
    const { clientWidth, clientHeight } = window?.document?.documentElement;
    const targetRect = draggableRef?.current?.getBoundingClientRect();

    if (targetRect) {
      setBounds({
        left: -targetRect?.left + uiData?.x,
        right: clientWidth - (targetRect?.right - uiData?.x),
        top: -targetRect?.top + uiData?.y,
        bottom: clientHeight - (targetRect?.bottom - uiData?.y),
      });
    }
  };

  const getResizableConfig = useMemo(() => {
    if (Object.keys(resizableConfig).length === 0) {
      return defaultResizableConfig(hideFooter);
    }
    return resizableConfig;
  }, [hideFooter, resizableConfig]);

  const ModalTitle = () =>
    draggable ? (
      <div
        className="draggable-trigger"
        onMouseOver={() => dragDisabled && setDragDisabled(false)}
        onMouseOut={() => !dragDisabled && setDragDisabled(true)}
      >
        {title}
      </div>
    ) : (
      <>{title}</>
    );

  return (
    <StyledModal
      centered={!!centered}
      onOk={onHandledPrimaryAction}
      onCancel={handleOnHide}
      width={modalWidth}
      maxWidth={maxWidth}
      responsive={responsive}
      open={show}
      title={<ModalTitle />}
      closeIcon={
        <Icons.CloseOutlined
          iconColor={theme.colorText}
          iconSize="l"
          data-test="close-modal-btn"
          className="close"
          aria-hidden="true"
        />
      }
      footer={!hideFooter ? modalFooter : null}
      hideFooter={hideFooter}
      wrapProps={{ 'data-test': `${name || 'antd'}-modal`, ...wrapProps }}
      modalRender={modal =>
        resizable || draggable ? (
          <Draggable
            disabled={!draggable || dragDisabled}
            bounds={bounds}
            onStart={(event, uiData) => onDragStart(event, uiData)}
            {...draggableConfig}
          >
            {resizable ? (
              <Resizable className="resizable" {...getResizableConfig}>
                <div className="resizable-wrapper" ref={draggableRef}>
                  {modal}
                </div>
              </Resizable>
            ) : (
              <div ref={draggableRef}>{modal}</div>
            )}
          </Draggable>
        ) : (
          modal
        )
      }
      mask={shouldShowMask}
      draggable={draggable}
      resizable={resizable}
      destroyOnHidden={destroyOnHidden}
      {...rest}
    >
      {children}
    </StyledModal>
  );
};
CustomModal.displayName = 'Modal';

// Theme-aware confirmation modal that applies current Superset theme
const themedConfirm = (props: Parameters<typeof AntdModal.confirm>[0]) => {
  // Get current theme from CSS custom properties or fallback to defaults
  const getCurrentTheme = () => {
    const style = getComputedStyle(document.documentElement);
    const isDark = document.body.classList.contains('theme-dark');

    return {
      colorBgContainer:
        style.getPropertyValue('--theme-color-bg-container') ||
        (isDark ? '#141414' : '#ffffff'),
      colorText:
        style.getPropertyValue('--theme-color-text') ||
        (isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.85)'),
      colorSplit:
        style.getPropertyValue('--theme-color-split') ||
        (isDark ? '#434343' : '#d9d9d9'),
    };
  };

  const theme = getCurrentTheme();
  const confirmId = `superset-confirm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Inject themed styles using specific selectors (no !important)
  const injectConfirmStyles = () => {
    const styleId = `${confirmId}-styles`;
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .${confirmId}.ant-modal-root .ant-modal-content {
        background-color: ${theme.colorBgContainer};
        color: ${theme.colorText};
      }
      .${confirmId}.ant-modal-root .ant-modal-header {
        background-color: ${theme.colorBgContainer};
        border-bottom-color: ${theme.colorSplit};
      }
      .${confirmId}.ant-modal-root .ant-modal-title {
        color: ${theme.colorText};
      }
      .${confirmId}.ant-modal-root .ant-modal-body {
        color: ${theme.colorText};
      }
      .${confirmId}.ant-modal-root .ant-modal-footer {
        background-color: ${theme.colorBgContainer};
        border-top-color: ${theme.colorSplit};
      }
      .${confirmId}.ant-modal-root .ant-modal-footer .ant-btn {
        border-color: ${theme.colorSplit};
      }
    `;
    document.head.appendChild(style);

    // Clean up styles when no longer needed
    setTimeout(() => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        existingStyle.remove();
      }
    }, 5000);
  };

  injectConfirmStyles();

  return AntdModal.confirm({
    ...props,
    rootClassName: `${confirmId} ${props?.rootClassName || ''}`,
  });
};

export const Modal = Object.assign(CustomModal, {
  error: AntdModal.error,
  warning: AntdModal.warning,
  confirm: themedConfirm,
  useModal: AntdModal.useModal,
});
