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
import { useCallback, useEffect } from 'react';
import { HeaderProps } from '../Header/types';

type UndoRedoKeyListenersProps = {
  onUndo: HeaderProps['onUndo'];
  onRedo: HeaderProps['onRedo'];
};

function UndoRedoKeyListeners({ onUndo, onRedo }: UndoRedoKeyListenersProps) {
  const handleKeydown = useCallback(
    (event: KeyboardEvent) => {
      const controlOrCommand = event.ctrlKey || event.metaKey;
      if (controlOrCommand) {
        const isZChar = event.key === 'z' || event.keyCode === 90;
        const isYChar = event.key === 'y' || event.keyCode === 89;
        const isEditingMarkdown = document?.querySelector(
          '.dashboard-markdown--editing',
        );
        const isEditingTitle = document?.querySelector(
          '.editable-title--editing',
        );

        if (!isEditingMarkdown && !isEditingTitle && (isZChar || isYChar)) {
          event.preventDefault();
          const func = isZChar ? onUndo : onRedo;
          func();
        }
      }
    },
    [onUndo, onRedo],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [handleKeydown]);

  return null;
}

export default UndoRedoKeyListeners;
