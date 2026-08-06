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
import type { ReactElement } from 'react';
import type { dashboard as dashboardApi } from '@apache-superset/core';
import { t } from '@apache-superset/core/translation';
import { useTheme } from '@apache-superset/core/theme';
import { Radio, Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { provider, useDashboardRevision } from 'src/core/dashboard/store';
import { resolveLayoutMode } from 'src/core/dashboard/layoutStyle';

type LayoutMode = dashboardApi.LayoutMode;

/**
 * What each mode is for, in the author's terms rather than the schema's.
 *
 * Every one of them says what happens to a block, because that is the only
 * part an author can see: whether the space a block leaves behind closes, and
 * whether a block may sit over another. The names on the buttons are short
 * enough to read at a glance; the sentence is where the difference lives.
 */
const MODES: readonly {
  readonly key: LayoutMode;
  readonly label: string;
  readonly hint: string;
  readonly icon: ReactElement;
}[] = [
  {
    key: 'grid',
    label: t('Grid'),
    hint: t('Blocks snap to columns and close up the space above them.'),
    icon: <Icons.TableOutlined iconSize="s" />,
  },
  {
    key: 'flex',
    label: t('Flex'),
    hint: t('Blocks flow along a line and wrap, sharing it by width.'),
    icon: <Icons.LayoutOutlined iconSize="s" />,
  },
  {
    key: 'free',
    label: t('Free'),
    hint: t('Blocks stay exactly where you put them, and may overlap.'),
    icon: <Icons.AppstoreOutlined iconSize="s" />,
  },
];

/**
 * How one container arranges its children.
 *
 * The control edits the container's own `layout.mode`, which is the same
 * field an AI tool call writes through `dashboard.updateLayout` — so asking
 * the assistant for a free canvas and pressing Free here are the same edit,
 * and the button reflects whichever of the two happened last.
 *
 * A mode change moves nothing. Grid and Free read the same four coordinates
 * per child, so switching between them only changes whether the container
 * compacts them; switching to Flex leaves those coordinates untouched in the
 * store, so coming back finds every block where it was left.
 */
export default function LayoutModeSwitcher({
  nodeId,
}: {
  nodeId: string;
}): ReactElement | null {
  useDashboardRevision();
  const theme = useTheme();
  const node = provider.getNode(nodeId);
  if (!node?.children) {
    return null;
  }
  const mode = resolveLayoutMode(node.layout);

  return (
    <div
      data-test="layout-mode-switcher"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.sizeUnit * 2,
      }}
    >
      <span
        id={`layout-mode-label-${nodeId}`}
        style={{
          fontSize: theme.fontSizeSM,
          color: theme.colorTextTertiary,
        }}
      >
        {t('Layout')}
      </span>
      <Radio.Group
        size="small"
        value={mode}
        aria-labelledby={`layout-mode-label-${nodeId}`}
        onChange={event =>
          provider.updateLayout(nodeId, {
            mode: event.target.value as LayoutMode,
          })
        }
      >
        {MODES.map(option => (
          <Tooltip key={option.key} title={option.hint} placement="bottom">
            <Radio.Button
              value={option.key}
              data-test={`layout-mode-${option.key}`}
              // Sized with the rest of the header rather than left at antd's
              // small step: a control that stands taller than everything
              // beside it reads as a different kind of thing.
              style={{
                height: theme.controlHeightSM,
                paddingInline: theme.sizeUnit * 2,
                fontSize: theme.fontSizeSM,
                lineHeight: `${theme.controlHeightSM - 2}px`,
              }}
            >
              {option.icon} {option.label}
            </Radio.Button>
          </Tooltip>
        ))}
      </Radio.Group>
    </div>
  );
}
