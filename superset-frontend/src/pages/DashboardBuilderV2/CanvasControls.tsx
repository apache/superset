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
import { t } from '@apache-superset/core/translation';
import { useTheme } from '@apache-superset/core/theme';
import { Icons } from '@superset-ui/core/components/Icons';
import Inert from './InertControl';

/**
 * What acts on the canvas as a whole, in the canvas's own corner.
 *
 * Not chrome about the dashboard — not what it is called, who owns it, or
 * whether it is published. It acts on the blocks in front of you, and is
 * reached for while looking at them, which is why it sits here rather than
 * on the bar above.
 *
 * **Refresh** is named, and honest that it cannot work. There is no row
 * behind this page and no query to re-run, so it says so rather than doing
 * nothing quietly.
 */
export default function CanvasControls(): ReactElement {
  const theme = useTheme();

  return (
    <div
      data-test="canvas-controls"
      // In the canvas's own padding, and sized to fit inside it: at the next
      // step up this is taller than the inset and clips the frame the root
      // draws, which reads as a collision rather than as a corner.
      //
      // Raised because the root is positioned too, and a positioned sibling
      // earlier in the tree is painted under it — the same tree-order rule
      // that decides which of two overlapping blocks wins.
      style={{
        position: 'absolute',
        top: theme.sizeUnit,
        left: theme.sizeUnit,
        zIndex: 1,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Inert
        label={t('Refresh dashboard')}
        test="canvas-refresh"
        buttonStyle="link"
        // Zeroed because it is not this row's to set. A disabled control is
        // wrapped in a span so its tooltip survives, and Superset's button
        // styles give a wrapped button a left margin meant for a row of them
        // — so this one sat further from its neighbour than the neighbour sat
        // from anything, and this row has no neighbour any more.
        style={{ marginLeft: 0 }}
      >
        <Icons.ReloadOutlined iconSize="s" />
      </Inert>
    </div>
  );
}
