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
import { useEffect, useRef, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import {
  Button,
  Dropdown,
  Flex,
  Icons,
  Space,
} from '@superset-ui/core/components';
import { TreeLevel } from './types';

/** The depths Expand all can open: each level with children or detail fields. */
export function expandAllLevels(levels: TreeLevel[]): number[] {
  return levels.flatMap((level, index) =>
    levels[index + 1] || level.detail_fields.length ? [index + 1] : [],
  );
}

export interface ExpandAllControlProps {
  levels: TreeLevel[];
  allOpen: boolean;
  onChange: (level: number) => void;
  onCollapseAll: () => void;
}

export default function ExpandAllControl({
  levels,
  allOpen,
  onChange,
  onCollapseAll,
}: ExpandAllControlProps) {
  const openable = expandAllLevels(levels);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLElement>(null);
  const label = allOpen ? t('Collapse all') : t('Expand all');
  const toggle = () =>
    allOpen ? onCollapseAll() : onChange(openable[openable.length - 1]);
  const returnFocus = useRef(false);
  const closeMenu = () => {
    returnFocus.current = true;
    setMenuOpen(false);
  };
  useEffect(() => {
    if (menuOpen || !returnFocus.current) return undefined;
    const timer = setTimeout(() => {
      menuButton.current?.focus();
      returnFocus.current = false;
    });
    return () => clearTimeout(timer);
  }, [menuOpen]);
  if (!openable.length) return null;
  return (
    <Flex justify="flex-end" align="center" className="tree-table-toolbar">
      {openable.length === 1 ? (
        <Button buttonStyle="tertiary" buttonSize="small" onClick={toggle}>
          {label}
        </Button>
      ) : (
        <Space.Compact>
          <Button buttonStyle="tertiary" buttonSize="small" onClick={toggle}>
            {label}
          </Button>
          <Dropdown
            trigger={['click']}
            open={menuOpen}
            autoFocus
            destroyOnHidden
            popupRender={menu => (menuOpen ? menu : <></>)}
            onOpenChange={setMenuOpen}
            menu={{
              items: openable.map(level => ({
                key: String(level),
                label: t(
                  'Expand to %s',
                  levels[level - 1].name_plural || levels[level - 1].name,
                ),
              })),
              onClick: ({ key }) => {
                onChange(Number(key));
                closeMenu();
              },
              onKeyDown: event => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  closeMenu();
                }
              },
            }}
          >
            <Button
              ref={menuButton}
              buttonStyle="tertiary"
              buttonSize="small"
              icon={<Icons.DownOutlined iconSize="s" />}
              aria-label={t('Expand all to level')}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onKeyDown={event => {
                if (
                  event.key === 'Enter' ||
                  event.key === ' ' ||
                  event.key === 'ArrowDown'
                ) {
                  event.preventDefault();
                  setMenuOpen(true);
                }
              }}
            />
          </Dropdown>
        </Space.Compact>
      )}
    </Flex>
  );
}
