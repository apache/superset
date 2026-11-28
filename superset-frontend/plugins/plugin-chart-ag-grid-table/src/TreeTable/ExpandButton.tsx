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
import { useEffect, useRef } from 'react';
import { t } from '@apache-superset/core/translation';
import { Button, Icons } from '@superset-ui/core/components';

export interface ExpandButtonProps {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  /** The grid cell that holds the button: keyboard focus on it goes to the button. */
  cell?: HTMLElement;
}

/** Toggle parent expansion without forwarding a click to the grid. */
export default function ExpandButton({
  label,
  expanded,
  onToggle,
  cell,
}: ExpandButtonProps) {
  const button = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!cell) return undefined;
    const focusButton = () => button.current?.focus();
    if (document.activeElement === cell) focusButton();
    cell.addEventListener('focus', focusButton);
    return () => cell.removeEventListener('focus', focusButton);
  }, [cell]);
  return (
    <Button
      ref={button}
      className="tree-table-expand"
      buttonSize="xsmall"
      color="default"
      variant="text"
      icon={
        expanded ? (
          <Icons.LineOutlined iconSize="s" />
        ) : (
          <Icons.PlusOutlined iconSize="s" />
        )
      }
      size="small"
      aria-label={expanded ? t('Collapse %s', label) : t('Expand %s', label)}
      aria-expanded={expanded}
      onKeyDown={event => {
        if (event.repeat && (event.key === 'Enter' || event.key === ' '))
          event.preventDefault();
      }}
      onClick={event => {
        event.stopPropagation();
        onToggle();
      }}
    />
  );
}
