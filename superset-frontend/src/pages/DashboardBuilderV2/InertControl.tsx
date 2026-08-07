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
import type { ReactElement, ReactNode } from 'react';
import { t } from '@apache-superset/core/translation';
import { Button, type ButtonProps } from '@superset-ui/core/components';

const NOT_AVAILABLE = t('Not available yet');

/**
 * This prototype's controls, at two of the shared Button's own sizes.
 *
 * Nothing here is drawn at full size: the bars and rails are chrome around the
 * work rather than the work itself, and every pixel they take is one the
 * canvas does not get. But the two kinds of control on them are not read the
 * same way. A word is read, and one squeezed to the smallest step there is is
 * read slowly; an icon is recognised by its shape, and loses nothing there.
 *
 * Said in `buttonSize`, which is the prop the shared `Button` actually reads.
 * `size` is antd's, and the wrapper writes its own height over whatever antd
 * does with it — so every control here asked for `size="small"`, got the full
 * 32px default, and was then pushed back down by a hand-written height,
 * padding and font size at each site. Those helpers were a copy of this scale
 * maintained beside it, free to drift from it and answering to no theme
 * override; `buttonSize` is the scale itself.
 */

/**
 * An affordance that is present, named and honest about not working.
 *
 * Most of this prototype's chrome is one. The builder keeps its tree in
 * memory and has no dashboard row behind it: nothing can be saved,
 * favourited, published or refreshed, and there is no history to step
 * through. Drawing them disabled says which parts of the product this page is
 * still missing; drawing them live and inert would teach something false
 * about all of them.
 *
 * `Button` renders a disabled control inside a span so its tooltip survives —
 * a bare disabled button swallows the pointer events a tooltip listens for,
 * and the explanation would never reach the one control that needs it. That
 * is the whole reason this is a component rather than a prop spread at each
 * site, and it is why a second home for it did not get a second copy.
 */
export default function Inert({
  label,
  test,
  buttonStyle,
  /** Whether this one is read as a word rather than recognised as a shape. */
  reads,
  style,
  children,
}: {
  label: string;
  test: string;
  buttonStyle?: ButtonProps['buttonStyle'];
  reads?: boolean;
  style?: ButtonProps['style'];
  children: ReactNode;
}): ReactElement {
  return (
    <Button
      buttonSize={reads ? 'small' : 'xsmall'}
      buttonStyle={buttonStyle}
      disabled
      aria-label={label}
      data-test={test}
      tooltip={`${label} — ${NOT_AVAILABLE}`}
      placement="bottom"
      style={style}
    >
      {children}
    </Button>
  );
}
