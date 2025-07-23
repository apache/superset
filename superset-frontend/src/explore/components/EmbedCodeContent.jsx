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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { css, t } from '@superset-ui/core';
import { Input, Space, Typography } from '@superset-ui/core/components';
import { CopyToClipboard } from 'src/components';
import { URL_PARAMS } from 'src/constants';
import { getChartPermalink } from 'src/utils/urlUtils';
import { Icons } from '@superset-ui/core/components/Icons';

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
            <span role="button" aria-label="Copy to clipboard">
              <Icons.CopyOutlined />
            </span>
          }
        />
        <Input.TextArea
          data-test="embed-code-textarea"
          name="embedCode"
          disabled={!html}
          value={text}
          rows="4"
          readOnly
          css={theme => css`
            resize: vertical;
            margin-top: ${theme.sizeUnit * 2}px;
            padding: ${theme.sizeUnit * 2}px;
            font-size: ${theme.fontSizeSM}px;
            border-radius: 4px;
            background-color: ${theme.colorBgElevated};
          `}
        />
      </div>
      <Space
        direction="horizzontal"
        css={theme => css`
          margin-top: ${theme.margin}px;
        `}
      >
        <div>
          <Typography.Text type="secondary">
            {t('Chart height')}
          </Typography.Text>
          <Input
            type="number"
            defaultValue={height}
            name="height"
            onChange={handleInputChange}
          />
        </div>
        <div>
          <Typography.Text type="secondary">{t('Chart width')}</Typography.Text>
          <Input
            type="number"
            defaultValue={width}
            name="width"
            onChange={handleInputChange}
            id="embed-width"
          />
        </div>
      </Space>
    </div>
  );
};

export default EmbedCodeContent;
