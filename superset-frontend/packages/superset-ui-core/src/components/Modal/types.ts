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
import type { CSSProperties, ReactNode } from 'react';
import type { ModalFuncProps } from 'antd';
import type { ResizableProps } from 're-resizable';
import type { DraggableProps } from 'react-draggable';
import { ButtonStyle } from '../Button/types';

export interface ModalProps {
  className?: string;
  children: ReactNode;
  disablePrimaryButton?: boolean;
  primaryTooltipMessage?: ReactNode;
  primaryButtonLoading?: boolean;
  onHide: () => void;
  onHandledPrimaryAction?: () => void;
  primaryButtonName?: string;
  primaryButtonStyle?: ButtonStyle;
  show: boolean;
  name?: string;
  title: ReactNode;
  width?: string | number;
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
  destroyOnHidden?: boolean;
  maskClosable?: boolean;
  zIndex?: number;
  bodyStyle?: CSSProperties;
  openerRef?: React.RefObject<HTMLElement>;
}

export interface StyledModalProps {
  maxWidth?: string;
  responsive?: boolean;
  height?: string;
  hideFooter?: boolean;
  draggable?: boolean;
  resizable?: boolean;
}

export type { ModalFuncProps };

export interface FormModalProps extends ModalProps {
  initialValues?: Object;
  formSubmitHandler: (values: Object) => Promise<void>;
  onSave: () => void;
  requiredFields: string[];
}
