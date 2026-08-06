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
import { Button } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { provider } from 'src/core/dashboard/store';
import Inert from './InertControl';

/**
 * What acts on the canvas as a whole, in the canvas's own corner.
 *
 * These two are not chrome about the dashboard — not what it is called, who
 * owns it, or whether it is published. They act on the blocks in front of you,
 * and both are reached for while looking at them, which is why they sit here
 * rather than on the bar above.
 *
 * **Arrange** is a route, not a control. How a container lays out its
 * children is a property of that container and is asked with the rest of them
 * — the columns, the gap, the row height it works alongside. That is the
 * right home for it and also further from hand than something permanently on
 * screen, so this is the way back to it. A second copy of the switcher would
 * be a second thing to keep agreeing with the first; selecting the root is
 * all this does, and the editor panel brings Properties forward on a
 * selection it did not make itself. It stays live on a page where almost
 * nothing is, because selecting a node this page already holds in memory
 * needs no dashboard row.
 *
 * **Refresh** is the opposite: named, and honest that it cannot work. There
 * is no row behind this page and no query to re-run, so it says so rather
 * than doing nothing quietly.
 */
export default function CanvasControls(): ReactElement {
  const theme = useTheme();

  return (
    <div
      data-test="canvas-controls"
      // In the canvas's own padding, and sized to fit inside it: at the next
      // step up these are taller than the inset and clip the frame the root
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
        // Two icons of the same size and colour sitting a hair apart read as
        // one control with two halves. The space is what separates arranging
        // the canvas from reloading it.
        gap: theme.sizeUnit * 3,
      }}
    >
      <Button
        buttonSize="xsmall"
        buttonStyle="link"
        aria-label={t('Arrange dashboard')}
        data-test="canvas-arrange"
        tooltip={t('Arrange dashboard — choose how the canvas lays blocks out')}
        placement="bottom"
        onClick={() => provider.setSelection(provider.getRoot().id)}
      >
        <Icons.LayoutOutlined iconSize="s" />
      </Button>
      <Inert
        label={t('Refresh dashboard')}
        test="canvas-refresh"
        buttonStyle="link"
        // Zeroed because it is not this row's to set. A disabled control is
        // wrapped in a span so its tooltip survives, and Superset's button
        // styles give a wrapped button a left margin meant for a row of them
        // — so this one sat further from its neighbour than the neighbour sat
        // from anything, and the pair's spacing stopped being the `gap` above.
        style={{ marginLeft: 0 }}
      >
        <Icons.ReloadOutlined iconSize="s" />
      </Inert>
    </div>
  );
}
