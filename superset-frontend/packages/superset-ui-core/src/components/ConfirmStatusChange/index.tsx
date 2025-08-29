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
import { useState } from 'react';

import { DeleteModal } from '../DeleteModal';
import type { ConfirmStatusChangeProps } from './types';

export function ConfirmStatusChange({
  title,
  description,
  onConfirm,
  children,
}: ConfirmStatusChangeProps) {
  const [open, setOpen] = useState(false);
  const [currentCallbackArgs, setCurrentCallbackArgs] = useState<any[]>([]);

  const showConfirm = (...callbackArgs: any[]) => {
    // check if any args are DOM events, if so, handle them
    callbackArgs.forEach(arg => {
      if (!arg) {
        return;
      }
      if (typeof arg.preventDefault === 'function') {
        arg.preventDefault();
      }
      if (typeof arg.stopPropagation === 'function') {
        arg.stopPropagation();
      }
    });
    setOpen(true);
    setCurrentCallbackArgs(callbackArgs);
  };

  const hide = () => {
    setOpen(false);
    setCurrentCallbackArgs([]);
  };

  const confirm = () => {
    onConfirm(...currentCallbackArgs);
    hide();
  };

  return (
    <>
      {children?.(showConfirm)}
      <DeleteModal
        description={description}
        onConfirm={confirm}
        onHide={hide}
        open={open}
        name="please confirm"
        title={title}
      />
    </>
  );
}

export type { ConfirmStatusChangeProps };
