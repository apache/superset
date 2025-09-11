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
import {
  isValidElement,
  cloneElement,
  CSSProperties,
  ReactNode,
  useMemo,
  useRef,
  useState,
} from 'react';
import { isNil } from 'lodash';
import { ModalFuncProps } from 'antd/lib/modal';
import { styled, t } from '@superset-ui/core';
import { css } from '@emotion/react';
import { AntdModal, AntdModalProps } from 'src/components';
import Button from 'src/components/Button';
import { Resizable, ResizableProps } from 're-resizable';
import Draggable, {
  DraggableBounds,
  DraggableData,
  DraggableEvent,
  DraggableProps,
} from 'react-draggable';

export interface ModalProps {
  className?: string;
  children: ReactNode;
  disablePrimaryButton?: boolean;
  primaryTooltipMessage?: ReactNode;
  primaryButtonLoading?: boolean;
  onHide: () => void;
  onHandledPrimaryAction?: () => void;
  primaryButtonName?: string;
  primaryButtonType?: 'primary' | 'danger';
  show: boolean;
  name?: string;
  title: ReactNode;
  width?: string;
  maxWidth?: string;
  responsive?: boolean;
  hideFooter?: boolean;
  centered?: boolean;
  footer?: ReactNode;
  wrapProps?: object;
  height?: string;
  closable?: boolean;
  resizable?: boolean;
  resizableConfig?: ResizableProps;
  draggable?: boolean;
  draggableConfig?: DraggableProps;
  destroyOnClose?: boolean;
  maskClosable?: boolean;
  zIndex?: number;
  bodyStyle?: CSSProperties;
}

interface StyledModalProps {
  maxWidth?: string;
  responsive?: boolean;
  height?: string;
  hideFooter?: boolean;
  draggable?: boolean;
  resizable?: boolean;
}

const MODAL_HEADER_HEIGHT = 55;
const MODAL_MIN_CONTENT_HEIGHT = 54;
const MODAL_FOOTER_HEIGHT = 65;

const RESIZABLE_MIN_HEIGHT = MODAL_HEADER_HEIGHT + MODAL_MIN_CONTENT_HEIGHT;
const RESIZABLE_MIN_WIDTH = '380px';
const RESIZABLE_MAX_HEIGHT = '100vh';
const RESIZABLE_MAX_WIDTH = '100vw';

const BaseModal = (props: AntdModalProps) => (
  // Removes mask animation. Fixed in 4.6.0.
  // https://github.com/ant-design/ant-design/issues/27192
  <AntdModal {...props} maskTransitionName="" />
);

export const StyledModal = styled(BaseModal)<StyledModalProps>`
  ${({ theme, responsive, maxWidth }) =>
    responsive &&
    css`
      max-width: ${maxWidth ?? '900px'};
      padding-left: ${theme.gridUnit * 3}px;
      padding-right: ${theme.gridUnit * 3}px;
      padding-bottom: 0;
      top: 0;
    `}

  .ant-modal-content {
    display: flex;
    flex-direction: column;
    max-height: ${({ theme }) => `calc(100vh - ${theme.gridUnit * 8}px)`};
    margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
    margin-top: ${({ theme }) => theme.gridUnit * 4}px;
  }

  .ant-modal-header {
    flex: 0 0 auto;
    background-color: ${({ theme }) => theme.colors.grayscale.light4};
    border-radius: ${({ theme }) => theme.borderRadius}px
      ${({ theme }) => theme.borderRadius}px 0 0;
    padding-left: ${({ theme }) => theme.gridUnit * 4}px;
    padding-right: ${({ theme }) => theme.gridUnit * 4}px;

    .ant-modal-title h4 {
      display: flex;
      margin: 0;
      align-items: center;
    }
  }

  .ant-modal-close-x {
    display: flex;
    align-items: center;

    .close {
      flex: 1 1 auto;
      margin-bottom: ${({ theme }) => theme.gridUnit}px;
      color: ${({ theme }) => theme.colors.secondary.dark1};
      font-size: 32px;
      font-weight: ${({ theme }) => theme.typography.weights.light};
    }
  }

  .ant-modal-body {
    flex: 0 1 auto;
    padding: ${({ theme }) => theme.gridUnit * 4}px;
    overflow: auto;
    ${({ resizable, height }) => !resizable && height && `height: ${height};`}
  }
  .ant-modal-footer {
    flex: 0 0 1;
    border-top: ${({ theme }) => theme.gridUnit / 4}px solid
      ${({ theme }) => theme.colors.grayscale.light2};
    padding: ${({ theme }) => theme.gridUnit * 4}px;

    .btn {
      font-size: 12px;
      text-transform: uppercase;
    }

    .btn + .btn {
      margin-left: ${({ theme }) => theme.gridUnit * 2}px;
    }
  }

  // styling for Tabs component
  // Aaron note 20-11-19: this seems to be exclusively here for the Edit Database modal.
  // TODO: remove this as it is a special case.
  .ant-tabs-top {
    margin-top: -${({ theme }) => theme.gridUnit * 4}px;
  }

  &.no-content-padding .ant-modal-body {
    padding: 0;
  }

  ${({ draggable, theme }) =>
    draggable &&
    `
    .ant-modal-header {
      padding: 0;
      .draggable-trigger {
          cursor: move;
          padding: ${theme.gridUnit * 4}px;
          width: 100%;
        }
    }
  `};

  ${({ resizable, hideFooter }) =>
    resizable &&
    `
    .resizable {
      pointer-events: all;

      .resizable-wrapper {
        height: 100%;
      }

      .ant-modal-content {
        height: 100%;

        .ant-modal-body {
          /* 100% - header height - footer height */
          height: ${
            hideFooter
              ? `calc(100% - ${MODAL_HEADER_HEIGHT}px);`
              : `calc(100% - ${MODAL_HEADER_HEIGHT}px - ${MODAL_FOOTER_HEIGHT}px);`
          }
        }
      }
    }
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
  primaryButtonType = 'primary',
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
  destroyOnClose,
  ...rest
}: ModalProps) => {
  const draggableRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<DraggableBounds>();
  const [dragDisabled, setDragDisabled] = useState<boolean>(true);
  let FooterComponent;
  if (isValidElement(footer)) {
    // If a footer component is provided inject a closeModal function
    // so the footer can provide a "close" button if desired
    FooterComponent = cloneElement(footer, {
      closeModal: onHide,
    } as Partial<unknown>);
  }
  const modalFooter = isNil(FooterComponent)
    ? [
        <Button key="back" onClick={onHide} cta data-test="modal-cancel-button">
          {t('Cancel')}
        </Button>,
        <Button
          key="submit"
          buttonStyle={primaryButtonType}
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
      onCancel={onHide}
      width={modalWidth}
      maxWidth={maxWidth}
      responsive={responsive}
      visible={show}
      title={<ModalTitle />}
      closeIcon={
        <span className="close" aria-hidden="true">
          ×
        </span>
      }
      footer={!hideFooter ? modalFooter : null}
      hideFooter={hideFooter}
      wrapProps={{ 'data-test': `${name || title}-modal`, ...wrapProps }}
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
      destroyOnClose={destroyOnClose}
      {...rest}
    >
      {children}
    </StyledModal>
  );
};
CustomModal.displayName = 'Modal';

// Ant Design 4 does not allow overriding Modal's buttons when
// using one of the pre-defined functions. Ant Design 5 Modal introduced
// the footer property that will allow that. Meanwhile, we're replicating
// Button style using global CSS in src/GlobalStyles.tsx.
// TODO: Replace this logic when on Ant Design 5.
const buttonProps = {
  okButtonProps: { className: 'modal-functions-ok-button' },
  cancelButtonProps: { className: 'modal-functions-cancel-button' },
};

// TODO: in another PR, rename this to CompatabilityModal
// and demote it as the default export.
// We should start using AntD component interfaces going forward.
const Modal = Object.assign(CustomModal, {
  error: (config: ModalFuncProps) =>
    AntdModal.error({ ...config, ...buttonProps }),
  warning: (config: ModalFuncProps) =>
    AntdModal.warning({ ...config, ...buttonProps }),
  confirm: (config: ModalFuncProps) =>
    AntdModal.confirm({ ...config, ...buttonProps }),
  useModal: AntdModal.useModal,
});

export default Modal;
