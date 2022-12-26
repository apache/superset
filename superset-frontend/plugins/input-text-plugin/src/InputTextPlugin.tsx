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
import React, { createRef } from 'react';
import { styled } from '@superset-ui/core';
import { InputTextPluginProps, InputTextPluginStylesProps } from './types';

// The following Styles component is a <div> element, which has been styled using Emotion
// For docs, visit https://emotion.sh/docs/styled

// Theming variables are provided for your use via a ThemeProvider
// imported from @superset-ui/core. For variables available, please visit
// https://github.com/apache-superset/superset-ui/blob/master/packages/superset-ui-core/src/style/index.ts
export function hexToRGB(hex: any, alpha = 255) {
  if (!hex) {
    return `rgba(0, 0, 0, ${alpha})`;
  }
  const { r, g, b, a } = hex;

  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// background-color: ${({ theme }) => theme.colors.secondary.base};
const Styles = styled.div<InputTextPluginStylesProps>`
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  border-radius: ${({ theme }) => theme.gridUnit * 2}px;
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;
  overflow: auto;

  h3 {
    /* You can use your props to control CSS! */
    margin-top: 0;
    margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
    font-size: ${({ theme, headerFontSize }) =>
      theme.typography.sizes[headerFontSize]}px;
    color: ${({ headerFontColor }) => hexToRGB(headerFontColor)};
    font-weight: ${({ theme, boldText }) =>
      theme.typography.weights[boldText ? 'bold' : 'normal']};
  }
  .input-text-item {
    font-size: ${({ theme, headerFontSize }) =>
      theme.typography.sizes[headerFontSize]}px;
    color: ${({ headerFontColor }) => hexToRGB(headerFontColor)};
    font-weight: ${({ theme, boldText }) =>
      theme.typography.weights[boldText ? 'bold' : 'normal']};
  }

  pre {
    height: ${({ theme, headerFontSize, height }) =>
      height - theme.gridUnit * 12 - theme.typography.sizes[headerFontSize]}px;
  }
`;

/**
 * ******************* WHAT YOU CAN BUILD HERE *******************
 *  In essence, a chart is given a few key ingredients to work with:
 *  * Data: provided via `props.data`
 *  * A DOM element
 *  * FormData (your controls!) provided as props by transformProps.ts
 */

export default function InputTextPlugin(props: InputTextPluginProps) {
  // height and width are the height and width of the DOM element as it exists in the dashboard.
  // There is also a `data` prop, which is, of course, your DATA 🎉
  const { data, height, width, renames } = props;

  const rootElem = createRef<HTMLDivElement>();
  // const mapName:any = {};

  if (renames && renames.length > 0) {
    // const renameMap = renames.split(",");
    // for (let index = 0; index < renameMap.length; index++) {
    //   const item = renameMap[index].split('=');
    //   mapName[item[0].trim()] = item[1];
    // }
  }

  const getInnerHtml = (dataItem: any) => {
    let str = renames;
    if (!str) return null;
    for (const key in dataItem) {
      if (renames.includes(key)) {
        str = str.replace(`{${key}}`, dataItem[key]);
      }
    }
    if (str && str.includes('br')) {
      const splitStr = str.split('br');
      return (
        <div className="input-text-item">
          {splitStr.map(item => {
            return <p>{item}</p>;
          })}
        </div>
      );
    }
    return str ? <div className="input-text-item">{str}</div> : null;
  };

  // Often, you just want to get a hold of the DOM and go nuts.
  // Here, you can do that with createRef, and the useEffect hook.
  // useEffect(() => {
  //   const root = rootElem.current as HTMLElement;
  //   console.log("Plugin element", data);
  //   setDataProp(data)
  // });

  // const getInner = (item) => {
  //   for (const key in item) {
  //     if (Object.prototype.hasOwnProperty.call(item, key)) {
  //       return (
  //         <div>
  //           <input type="text" value={key} />
  //           <span>{item[key]}</span>
  //         </div>
  //       );
  //     }
  //   }
  // };

  return (
    <Styles
      ref={rootElem}
      boldText={props.boldText}
      headerFontSize={props.headerFontSize}
      headerFontColor={props.headerFontColor}
      height={height}
      width={width}
    >
      <h3>{props.headerText}</h3>
      {data?.map((item: any) => {
        return (
          getInnerHtml(item) || (
            <>
              {Object.keys(item).map((pro: any) => {
                if (typeof item[pro] != 'object') {
                  return (
                    <div className="input-text-item">
                      <span>{pro}</span>:<span>{item[pro]}</span>
                    </div>
                  );
                } else return '';
              })}
            </>
          )
        );
      })}
      {/* <pre>${JSON.stringify(data, null, 2)}</pre> */}
    </Styles>
  );
}
