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
 * This is a Superset-specific wrapper around the generic CopyToClipboard
 * component from @superset-ui/core. It integrates with Superset's toast
 * notification system to show success/error messages.
 *
 * For the generic component without toast integration, import directly from:
 * import { CopyToClipboard } from '@superset-ui/core/components';
 */
import { t } from '@apache-superset/core';
import {
  CopyToClipboard as BaseCopyToClipboard,
  type CopyToClipboardProps as BaseCopyToClipboardProps,
} from '@superset-ui/core/components';
import withToasts, { type ToastProps } from '../MessageToasts/withToasts';

export interface CopyToClipboardProps extends Omit<
  BaseCopyToClipboardProps,
  'onSuccess' | 'onError'
> {
  /** Custom success message (defaults to "Copied to clipboard!") */
  successMessage?: string;
  /** Custom error message (defaults to browser not supporting copying message) */
  errorMessage?: string;
}

type CopyToClipboardWithToastsProps = CopyToClipboardProps & ToastProps;

function CopyToClipboardWithToasts({
  addSuccessToast,
  addDangerToast,
  successMessage,
  errorMessage,
  ...props
}: CopyToClipboardWithToastsProps) {
  return (
    <BaseCopyToClipboard
      {...props}
      onSuccess={() =>
        addSuccessToast(successMessage || t('Copied to clipboard!'))
      }
      onError={() =>
        addDangerToast(
          errorMessage ||
            t(
              'Sorry, your browser does not support copying. Use Ctrl / Cmd + C!',
            ),
        )
      }
    />
  );
}

export const CopyToClipboard = withToasts(CopyToClipboardWithToasts);
