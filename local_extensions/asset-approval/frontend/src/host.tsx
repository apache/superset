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

/**
 * @fileoverview What these screens used to get from Superset directly.
 *
 * As host screens they imported `@superset-ui/core/components` and
 * `src/components/MessageToasts/withToasts`. Neither is reachable from an
 * extension: Module Federation shares a module by its exact request, so a
 * subpath of a shared package is not shared, and nothing under `src/` is
 * exported at all.
 *
 * So the components are rebuilt on antd, which the extension bundles. They
 * are deliberately thin -- same prop names as Superset's, so the screens
 * themselves did not have to be rewritten around a different API -- and they
 * are the honest measure of what moving a screen out of the host costs
 * today.
 */

import React, { ReactNode, useMemo } from 'react';
import { theme as coreTheme, translation } from '@apache-superset/core';
import {
  Button as AntButton,
  Input as AntInput,
  Modal as AntModal,
  Select as AntSelect,
  Spin,
  Switch as AntSwitch,
  Tag as AntTag,
  message,
} from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { Alert as AntAlert } from 'antd';

export const { t } = translation;

/**
 * Superset's plural translation.
 *
 * `@apache-superset/core/translation` exposes `t` but not `tn`, so the
 * plural form is resolved here rather than by the host's catalogue -- which
 * is wrong for any language whose plural rule is not English's.
 */
export const tn = (
  singular: string,
  plural: string,
  count: number,
  ...args: unknown[]
) =>
  (args.length ? args : [count]).reduce<string>(
    (text, arg) => text.replace('%s', String(arg)),
    count === 1 ? singular : plural,
  );
export const { styled } = coreTheme;

/** Superset's Button API over antd's. */
export function Button({
  buttonStyle,
  buttonSize,
  children,
  ...rest
}: {
  buttonStyle?: 'primary' | 'secondary' | 'danger' | 'tertiary' | 'link';
  buttonSize?: 'small' | 'default' | 'large' | 'xsmall';
  children?: ReactNode;
  [prop: string]: unknown;
}) {
  const type =
    buttonStyle === 'primary'
      ? 'primary'
      : buttonStyle === 'link'
        ? 'link'
        : 'default';
  const size = buttonSize === 'small' || buttonSize === 'xsmall' ? 'small' : 'middle';
  return (
    <AntButton
      type={type}
      size={size}
      danger={buttonStyle === 'danger'}
      {...(rest as object)}
    >
      {children}
    </AntButton>
  );
}

/**
 * Superset's Modal API over antd's.
 *
 * `show`/`onHide`/`onHandledPrimaryAction` rather than antd's
 * `open`/`onCancel`/`onOk`, so the screens keep the call they already had.
 */
export function Modal({
  show,
  title,
  onHide,
  onHandledPrimaryAction,
  primaryButtonName,
  disablePrimaryButton,
  children,
  ...rest
}: {
  show?: boolean;
  title?: ReactNode;
  onHide?: () => void;
  onHandledPrimaryAction?: () => void;
  primaryButtonName?: string;
  disablePrimaryButton?: boolean;
  children?: ReactNode;
  [prop: string]: unknown;
}) {
  return (
    <AntModal
      open={show}
      title={title}
      onCancel={onHide}
      onOk={onHandledPrimaryAction}
      okText={primaryButtonName}
      okButtonProps={{ disabled: disablePrimaryButton }}
      destroyOnHidden
      {...(rest as object)}
    >
      {children}
    </AntModal>
  );
}

/** antd's Select, minus the `ariaLabel` Superset's wrapper adds. */
export function Select({
  ariaLabel,
  ...rest
}: {
  ariaLabel?: string;
  // Declared so a handler's parameter is `unknown` rather than an implicit
  // `any`; the call sites narrow it themselves.
  onChange?: (value: unknown) => void;
  [prop: string]: unknown;
}) {
  return (
    <AntSelect
      aria-label={ariaLabel}
      style={{ width: '100%' }}
      {...(rest as object)}
    />
  );
}

export const Input = AntInput;
export const Alert = AntAlert;
export const Switch = AntSwitch;
export const Tag = AntTag;

export function Loading({ position }: { position?: string }) {
  return (
    <div
      data-test="loading"
      style={{ padding: position === 'inline' ? 8 : 32, textAlign: 'center' }}
    >
      <Spin />
    </div>
  );
}

/** Only the icons these screens use. */
export const Icons = {
  CloseOutlined: ({ iconSize }: { iconSize?: string }) => (
    <CloseOutlined style={{ fontSize: iconSize === 'l' ? 18 : 14 }} />
  ),
};

/**
 * Stands in for `useToasts`.
 *
 * The host's toasts are a Redux-connected component tree, and `react-redux`
 * is not shared with extensions -- importing it would give this bundle a
 * second store that the host never populates. antd's message is a separate
 * notification surface: it works and it is in the right corner, but it is
 * not the host's, so a toast raised here does not appear alongside one
 * raised by Superset itself.
 */
export function useToasts() {
  return useMemo(
    () => ({
      addSuccessToast: (text: string) => message.success(text),
      addDangerToast: (text: string) => message.error(text),
      addWarningToast: (text: string) => message.warning(text),
      addInfoToast: (text: string) => message.info(text),
    }),
    [],
  );
}
