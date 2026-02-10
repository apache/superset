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
import {
  ChangeEvent,
  FC,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { LatestQueryFormData } from '@superset-ui/core';
import { css, t } from '@apache-superset/core/ui';
import { makeApi } from '@superset-ui/core';
import { Input, Space, Typography } from '@superset-ui/core/components';
import { CopyToClipboard } from 'src/components';

export interface EmbedCodeContentProps {
  formData?: LatestQueryFormData;
  addDangerToast?: (msg: string) => void;
}

const EmbedCodeContent: FC<EmbedCodeContentProps> = ({
  formData,
  addDangerToast,
}) => {
  const [height, setHeight] = useState('400');
  const [width, setWidth] = useState('600');
  const [embedData, setEmbedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const { value, name } = e.currentTarget;
    if (name === 'width') {
      setWidth(value);
    }
    if (name === 'height') {
      setHeight(value);
    }
  }, []);

  const generateEmbedCode = useCallback(async () => {
    if (!formData) return;

    setLoading(true);
    setErrorMessage('');

    try {
      const createEmbeddedChart = makeApi({
        method: 'POST',
        endpoint: '/api/v1/embedded_chart/',
      });

      const response = await createEmbeddedChart({
        form_data: formData,
        allowed_domains: [],
        ttl_minutes: 60,
      });

      setEmbedData(response);
    } catch (err) {
      setErrorMessage(t('Error generating embed code'));
      addDangerToast(t('Sorry, something went wrong. Try again later.'));
    } finally {
      setLoading(false);
    }
  }, [addDangerToast, formData]);

  useEffect(() => {
    generateEmbedCode();
  }, []);

  const html = useMemo(() => {
    if (!embedData?.iframe_url || !embedData?.guest_token) return '';

    const origin = new URL(embedData.iframe_url).origin;

    return `<!-- Superset Embedded Chart -->
<iframe
  id="superset-chart"
  src="${embedData.iframe_url}"
  width="${width}"
  height="${height}"
  frameborder="0"
  data-guest-token="${embedData.guest_token}"
  sandbox="allow-scripts allow-same-origin allow-popups"
></iframe>
<script>
  document.getElementById('superset-chart').onload = function() {
    this.contentWindow.postMessage(
      { type: '__embedded_comms__', guestToken: '${embedData.guest_token}' },
      '${origin}'
    );
  };
</script>`;
  }, [height, width, embedData]);

  const text = loading
    ? t('Generating embed code...')
    : errorMessage || html || t('No embed data available');

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
              📋
            </span>
          }
        />
        <Input.TextArea
          data-test="embed-code-textarea"
          name="embedCode"
          disabled={!html}
          value={text}
          rows={10}
          readOnly
          css={theme => css`
            resize: vertical;
            margin-top: ${theme.sizeUnit * 2}px;
            padding: ${theme.sizeUnit * 2}px;
            font-size: ${theme.fontSizeSM}px;
            border-radius: 4px;
            background-color: ${theme.colorBgElevated};
            font-family: monospace;
          `}
        />
      </div>
      <Space
        direction="horizontal"
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
      {embedData?.expires_at && (
        <Typography.Text
          type="secondary"
          css={theme => css`
            display: block;
            margin-top: ${theme.margin}px;
            font-size: ${theme.fontSizeSM}px;
          `}
        >
          {t('Token expires')}:{' '}
          {new Date(embedData.expires_at).toLocaleString()}
        </Typography.Text>
      )}
    </div>
  );
};

export default EmbedCodeContent;
