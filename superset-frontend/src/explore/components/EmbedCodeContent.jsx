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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { css, styled, t } from '@superset-ui/core';
import { Input, TextArea } from 'src/components/Input';
import CopyToClipboard from 'src/components/CopyToClipboard';
import { URL_PARAMS } from 'src/constants';
import { getChartPermalink } from 'src/utils/urlUtils';
import { CopyButton } from './DataTableControl';

const CopyButtonEmbedCode = styled(CopyButton)`
  && {
    margin: 0 0 ${({ theme }) => theme.gridUnit}px;
  }
`;

const EmbedCodeContent = ({ formData, addDangerToast }) => {
  const [height, setHeight] = useState('400');
  const [width, setWidth] = useState('600');
  const [url, setUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleInputChange = useCallback(e => {
    const { value, name } = e.currentTarget;
    if (name === 'width') {
      setWidth(value);
    }
    if (name === 'height') {
      setHeight(value);
    }
  }, []);

  const updateUrl = useCallback(() => {
    setUrl('');
    getChartPermalink(formData)
      .then(url => {
        setUrl(url);
        setErrorMessage('');
      })
      .catch(() => {
        setErrorMessage(t('Error'));
        addDangerToast(t('Sorry, something went wrong. Try again later.'));
      });
  }, [addDangerToast, formData]);

  useEffect(() => {
    updateUrl();
  }, []);

  const html = useMemo(() => {
    if (!url) return '';
    const srcLink = `${url}?${URL_PARAMS.standalone.name}=1&height=${height}`;
    return (
      '<iframe\n' +
      `  width="${width}"\n` +
      `  height="${height}"\n` +
      '  seamless\n' +
      '  frameBorder="0"\n' +
      '  scrolling="no"\n' +
      `  src="${srcLink}"\n` +
      '>\n' +
      '</iframe>'
    );
  }, [height, url, width]);

  const text = errorMessage || html || t('Generating link, please wait..');
  return (
    <div id="embed-code-popover" data-test="embed-code-popover">
      <div
        css={css`
          display: flex;
          flex-direction: column;
        `}
      >
        <CopyToClipboard
          shouldShowText={false}
          text={html}
          copyNode={
            <CopyButtonEmbedCode buttonSize="xsmall">
              <i className="fa fa-clipboard" />
            </CopyButtonEmbedCode>
          }
        />
        <TextArea
          data-test="embed-code-textarea"
          name="embedCode"
          disabled={!html}
          value={text}
          rows="4"
          readOnly
          css={theme => css`
            resize: vertical;
            padding: ${theme.gridUnit * 2}px;
            font-size: ${theme.typography.sizes.s}px;
            border-radius: 4px;
            background-color: ${theme.colors.secondary.light5};
          `}
        />
      </div>
      <div
        css={theme => css`
          display: flex;
          margin-top: ${theme.gridUnit * 4}px;
          & > div {
            margin-right: ${theme.gridUnit * 2}px;
          }
          & > div:last-of-type {
            margin-right: 0;
            margin-left: ${theme.gridUnit * 2}px;
          }
        `}
      >
        <div>
          <label htmlFor="embed-height">{t('Chart height')}</label>
          <Input
            type="text"
            defaultValue={height}
            name="height"
            onChange={handleInputChange}
          />
        </div>
        <div>
          <label htmlFor="embed-width">{t('Chart width')}</label>
          <Input
            type="text"
            defaultValue={width}
            name="width"
            onChange={handleInputChange}
            id="embed-width"
          />
        </div>
      </div>
    </div>
  );
};

export default EmbedCodeContent;
