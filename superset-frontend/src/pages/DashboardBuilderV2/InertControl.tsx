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
import { useTheme } from '@apache-superset/core/theme';
import { Button, type ButtonProps } from '@superset-ui/core/components';

const NOT_AVAILABLE = t('Not available yet');

/**
 * This prototype's controls, at two sizes.
 *
 * Nothing here is drawn at full size: these bars are chrome around the work
 * rather than the work itself, and every pixel they take is one the canvas
 * does not get. But the two kinds of control on them are not read the same
 * way. A word is read, and one squeezed to the smallest step the theme has is
 * read slowly; an icon is recognised by its shape, and loses nothing there.
 *
 * Both are driven off the theme's own control scale rather than literals, so
 * they track the size the rest of the app is built on instead of drifting.
 */
export const named = (theme: ReturnType<typeof useTheme>) => ({
  height: theme.controlHeightSM,
  paddingInline: theme.sizeUnit * 2.5,
  fontSize: theme.fontSize,
  lineHeight: 1,
});

export const compact = (theme: ReturnType<typeof useTheme>) => ({
  height: theme.controlHeightXS,
  paddingInline: theme.sizeUnit * 1.5,
  fontSize: theme.fontSizeSM,
  lineHeight: 1,
});

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
  const theme = useTheme();
  return (
    <Button
      size="small"
      buttonStyle={buttonStyle}
      disabled
      aria-label={label}
      data-test={test}
      tooltip={`${label} — ${NOT_AVAILABLE}`}
      placement="bottom"
      style={{ ...(reads ? named(theme) : compact(theme)), ...style }}
    >
      {children}
    </Button>
  );
}
