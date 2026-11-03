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
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';

const Strip = styled.output<{ proposed: boolean }>`
  ${({ theme, proposed }) => `
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    flex: 0 0 auto;
    padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
    border-left: ${theme.sizeUnit / 2}px solid
      ${proposed ? theme.colorWarning : theme.colorBorder};
    background-color: ${proposed ? theme.colorWarningBg : theme.colorBgLayout};
    color: ${theme.colorText};
    font-size: ${theme.fontSizeSM}px;
    font-weight: ${proposed ? theme.fontWeightStrong : theme.fontWeightNormal};
  `}
`;

export interface ChartVersionNoticeProps {
  /** True while the proposal is on screen, false while the live chart is. */
  proposed: boolean;
}

/**
 * Which version of this chart is on screen, said in both states.
 *
 * Only the proposal used to be labelled. That left the live chart as the
 * silent default: a reviewer who never found the switch saw the old chart
 * with nothing on the page contradicting them, and approving is not gated
 * on having looked. The costly mistake is the quiet one, so the quiet
 * state is the one that most needed a label.
 *
 * Both states render the same element at the same height, so flipping the
 * switch no longer moves the chart under the reader's eye.
 *
 * Deliberately not an ``Alert``: this is a persistent statement of which
 * version is being drawn, not an event, and two stacked alert-coloured
 * bars read as one block of banner chrome rather than as a mode.
 */
export default function ChartVersionNotice({
  proposed,
}: ChartVersionNoticeProps) {
  return (
    // `output` carries an implicit role of `status`, so the flip is
    // announced. The switch is the only other cue a screen reader gets, and
    // its `aria-checked` says the control moved rather than what is now on
    // screen.
    <Strip proposed={proposed} data-test="chart-version-notice">
      {proposed
        ? t('Proposed version · not live until approved')
        : t('Live version · what viewers see now')}
    </Strip>
  );
}
