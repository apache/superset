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
import React, { useEffect, createRef } from 'react';
import { styled } from '@superset-ui/core';
import {
  SupersetPluginSummaryPanelProps,
  SupersetPluginSummaryPanelStylesProps,
} from './types';

// The following Styles component is a <div> element, which has been styled using Emotion
// For docs, visit https://emotion.sh/docs/styled

// Theming variables are provided for your use via a ThemeProvider
// imported from @superset-ui/core. For variables available, please visit
// https://github.com/apache-superset/superset-ui/blob/master/packages/superset-ui-core/src/style/index.ts

/**
 * ******************* WHAT YOU CAN BUILD HERE *******************
 *  In essence, a chart is given a few key ingredients to work with:
 *  * Data: provided via `props.data`
 *  * A DOM element
 *  * FormData (your controls!) provided as props by transformProps.ts
 */

const Divider = styled.div`
  padding: 16px 0px;
`;

const Button = styled.button`
  all: unset;
  font-size: 12px;
  background-color: white;
  border: none;
  cursor: pointer;
`;

const Panel = styled.div<SupersetPluginSummaryPanelStylesProps>`
  padding: 12px 16px;
`;

const SummaryPanelHeader = styled.div`
  display: flex;
  align-items: center;
`;

const SummaryPanelTextHeader = styled.div`
  color: var(--mint-cfc-sys-color-On-surface-text-subtle, #667085);
  font-size: 12px;
  font-weight: 450;
`;

const SummaryPanelTag = styled.div`
  border-radius: var(--mint-cfc-sys-corner-radius-2xl, 24px);
  background: var(--Pink-50, #fdf2fa);
  font-size: 8px;
  color: #dd2590;
  margin-left: var(--mint-cfc-sys-spacing-S1, 4px);
  padding: var(--mint-cfc-sys-spacing-S1, 4px);
`;

const SummaryPanelAmountRow = styled.div`
  display: flex;
  padding: var(--mint-cfc-sys-spacing-S6, 16px)
    var(--mint-cfc-sys-spacing-S0, 0px);
  flex-direction: column;
  align-items: flex-start;
  gap: var(--mint-cfc-sys-spacing-S3, 8px);
  flex: 1 0 0;
`;

const SummaryPanelLabel = styled.div`
  color: var(--mint-cfc-sys-color-On-surface-text-base, #1d2939);
  font-family: Inter;
  font-size: 24px;
  font-style: normal;
  font-weight: 550;
  line-height: 30px;
  letter-spacing: -0.48px;
`;

const SummaryPanelSubText = styled.div`
  color: var(--mint-cfc-sys-color-On-surface-text-base, #1d2939);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 450;
  line-height: 16px;
  letter-spacing: 0.12px;
`;

const FlexRow = styled.div`
  display: flex;
`;

const Summary = styled.div`
  min-width: 180px;
`;

// const mockData = [
//   {
//     headerText: 'Total Revenue',
//     mainText: '$ 1,000,000',
//     subText: 'Last 30 days',
//   },
//   {
//     headerText: 'Total Revenue',
//     mainText: '$ 1,000,000',
//     subText: 'Last 30 days',
//   },
// ];
export default function SupersetPluginSummaryPanel(
  props: SupersetPluginSummaryPanelProps,
) {
  // height and width are the height and width of the DOM element as it exists in the dashboard.
  // There is also a `data` prop, which is, of course, your DATA 🎉
  const { data, height, width, showButton, actionUrl } = props;

  const rootElem = createRef<HTMLDivElement>();

  // Often, you just want to access the DOM and do whatever you want.
  // Here, you can do that with createRef, and the useEffect hook.
  useEffect(() => {
    const root = rootElem.current as HTMLElement;
    console.log('Plugin element', root);
  });

  const onBtnClick = () => {
    window.parent.postMessage({
      action: 'client_side_redirect',
      data: {
        url: actionUrl,
      },
    });
  };

  return (
    <Panel
      ref={rootElem}
      boldText={props.boldText}
      headerFontSize={props.headerFontSize}
      height={height}
      width={width}
    >
      <FlexRow>
        {data.map((item, index) => {
          return (
            <Summary>
              <SummaryPanelHeader>
                <SummaryPanelTextHeader>
                  {item.headerText}
                </SummaryPanelTextHeader>
                {props.tagText && (
                  <SummaryPanelTag>{props.tagText}</SummaryPanelTag>
                )}
              </SummaryPanelHeader>
              <SummaryPanelAmountRow key={`item-${index}`}>
                <SummaryPanelLabel>{item.mainText}</SummaryPanelLabel>
                <SummaryPanelSubText>{item.subText}</SummaryPanelSubText>
              </SummaryPanelAmountRow>
            </Summary>
          );
        })}
      </FlexRow>
      {showButton && (
        <Divider>
          <Button onClick={onBtnClick}>View More &nbsp;&rarr;</Button>
        </Divider>
      )}
    </Panel>
  );
}
