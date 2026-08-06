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
import { css, styled } from '@apache-superset/core/theme';
import { Form, Radio, Tooltip } from '@superset-ui/core/components';
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

/** Spaced like the number fields it sits above, so the section reads evenly. */
const ModeField = styled(Form.Item)`
  ${({ theme }) => css`
    margin-bottom: ${theme.sizeUnit * 2}px;
  `}
`;

const ModeLabel = styled.span`
  ${({ theme }) => css`
    display: inline-flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
  `}
`;

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
  const node = provider.getNode(nodeId);
  if (!node?.children) {
    return null;
  }
  const mode = resolveLayoutMode(node.layout);

  return (
    // Asked the way every other field in this section is asked — label above,
    // control beneath. Beside its control it was the one question in the
    // Arrangement section reading left to right, which made a setting that
    // belongs with the columns and the gap look like chrome sitting over them.
    <ModeField label={t('Layout')} data-test="layout-mode-switcher">
      <Radio.Group
        size="small"
        value={mode}
        // The `Form.Item` label has no control id to point at without a
        // `name`, so the group carries its own name rather than going
        // unannounced.
        aria-label={t('Layout')}
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
            >
              {/* The icon and the name are one label, spaced by the layout
                  rather than by a text node holding a space. */}
              <ModeLabel>
                {option.icon}
                {option.label}
              </ModeLabel>
            </Radio.Button>
          </Tooltip>
        ))}
      </Radio.Group>
    </ModeField>
  );
}
