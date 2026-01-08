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
import { useCallback, useState } from 'react';
import { makeApi, t } from '@superset-ui/core';
import { styled, css } from '@apache-superset/core/ui';
import {
  Button,
  FormItem,
  InfoTooltip,
  Input,
  Modal,
  Form,
} from '@superset-ui/core/components';
import copyTextToClipboard from 'src/utils/copy';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { ModalTitleWithIcon } from 'src/components/ModalTitleWithIcon';

type Props = {
  formData: Record<string, unknown>;
  show: boolean;
  onHide: () => void;
};

type EmbedResponse = {
  iframe_url: string;
  guest_token: string;
  permalink_key: string;
  expires_at: string;
};

const stringToList = (stringyList: string): string[] =>
  stringyList.split(/(?:\s|,)+/).filter(x => x);

const ButtonRow = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  gap: 8px;
`;

const CodeBlock = styled.pre`
  ${({ theme }) => css`
    background: ${theme.colors.grayscale.light4};
    border: 1px solid ${theme.colors.grayscale.light2};
    border-radius: 4px;
    padding: 12px;
    font-size: 12px;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 200px;
  `}
`;

const Section = styled.div`
  margin-bottom: 16px;
`;

export const EmbeddedChartControls = ({ formData, onHide }: Props) => {
  const { addInfoToast, addDangerToast } = useToasts();
  const [loading, setLoading] = useState(false);
  const [embedData, setEmbedData] = useState<EmbedResponse | null>(null);
  const [allowedDomains, setAllowedDomains] = useState<string>('');
  const [ttlMinutes, setTtlMinutes] = useState<number>(60);

  const generateEmbed = useCallback(async () => {
    setLoading(true);
    try {
      const response = await makeApi<
        { form_data: Record<string, unknown>; allowed_domains: string[]; ttl_minutes: number },
        EmbedResponse
      >({
        method: 'POST',
        endpoint: '/api/v1/embedded_chart/',
      })({
        form_data: formData,
        allowed_domains: stringToList(allowedDomains),
        ttl_minutes: ttlMinutes,
      });

      setEmbedData(response);
      addInfoToast(t('Embed code generated successfully'));
    } catch (err) {
      console.error(err);
      addDangerToast(t('Failed to generate embed code. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [formData, allowedDomains, ttlMinutes, addInfoToast, addDangerToast]);

  const getIframeHtml = () => {
    if (!embedData) return '';
    return `<iframe
  src="${embedData.iframe_url}"
  width="100%"
  height="400"
  frameborder="0"
  sandbox="allow-scripts allow-same-origin allow-popups"
></iframe>
<script>
  (function() {
    var iframe = document.currentScript.previousElementSibling;
    var GUEST_TOKEN = '${embedData.guest_token}';
    var SUPERSET_URL = '${embedData.iframe_url.split('/embedded')[0]}';
    iframe.addEventListener('load', function() {
      var channel = new MessageChannel();
      iframe.contentWindow.postMessage({
        type: '__embedded_comms__',
        handshake: 'port transfer'
      }, SUPERSET_URL, [channel.port2]);
      setTimeout(function() {
        channel.port1.postMessage({
          switchboardAction: 'emit',
          method: 'guestToken',
          args: { guestToken: GUEST_TOKEN }
        });
      }, 100);
    });
  })();
</script>`;
  };

  return (
    <>
      <p>
        {t(
          'Generate an embed code to display this chart in external applications. The embed includes a guest token for secure access.',
        )}
      </p>

      <Form layout="vertical">
        <FormItem
          name="allowed-domains"
          label={
            <span>
              {t('Allowed Domains (comma separated)')}{' '}
              <InfoTooltip
                placement="top"
                tooltip={t(
                  'A list of domain names that can embed this chart. Leaving this field empty will allow embedding from any domain.',
                )}
              />
            </span>
          }
        >
          <Input
            id="allowed-domains"
            value={allowedDomains}
            placeholder="example.com, app.example.com"
            onChange={event => setAllowedDomains(event.target.value)}
          />
        </FormItem>

        <FormItem
          name="ttl-minutes"
          label={
            <span>
              {t('Expiration (minutes)')}{' '}
              <InfoTooltip
                placement="top"
                tooltip={t(
                  'How long the embed code will be valid. After expiration, a new code must be generated.',
                )}
              />
            </span>
          }
        >
          <Input
            id="ttl-minutes"
            type="number"
            min={1}
            max={10080}
            value={ttlMinutes}
            onChange={event => setTtlMinutes(Number(event.target.value))}
          />
        </FormItem>
      </Form>

      {!embedData ? (
        <ButtonRow>
          <Button onClick={onHide} buttonStyle="secondary">
            {t('Cancel')}
          </Button>
          <Button onClick={generateEmbed} buttonStyle="primary" loading={loading}>
            {t('Generate Embed Code')}
          </Button>
        </ButtonRow>
      ) : (
        <>
          <Section>
            <h4>{t('Embed Code')}</h4>
            <CodeBlock>{getIframeHtml()}</CodeBlock>
            <ButtonRow
              css={css`
                margin-top: 8px;
              `}
            >
              <Button
                buttonStyle="secondary"
                onClick={() => {
                  copyTextToClipboard(() => Promise.resolve(getIframeHtml()))
                    .then(() => addInfoToast(t('Copied to clipboard')))
                    .catch(() => addDangerToast(t('Failed to copy to clipboard')));
                }}
              >
                {t('Copy Code')}
              </Button>
            </ButtonRow>
          </Section>

          <Section>
            <h4>{t('Details')}</h4>
            <p>
              <strong>{t('Permalink Key')}:</strong> {embedData.permalink_key}
            </p>
            <p>
              <strong>{t('Expires')}:</strong>{' '}
              {new Date(embedData.expires_at).toLocaleString()}
            </p>
          </Section>

          <ButtonRow>
            <Button
              onClick={() => setEmbedData(null)}
              buttonStyle="secondary"
            >
              {t('Generate New Code')}
            </Button>
            <Button onClick={onHide} buttonStyle="primary">
              {t('Done')}
            </Button>
          </ButtonRow>
        </>
      )}
    </>
  );
};

const EmbeddedChartModal = (props: Props) => {
  const { show, onHide } = props;

  return (
    <Modal
      name={t('Embed Chart')}
      show={show}
      onHide={onHide}
      hideFooter
      title={<ModalTitleWithIcon title={t('Embed Chart')} />}
      width={600}
    >
      <EmbeddedChartControls {...props} />
    </Modal>
  );
};

export default EmbeddedChartModal;
