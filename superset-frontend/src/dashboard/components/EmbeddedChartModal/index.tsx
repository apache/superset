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
import { useCallback, useEffect, useState } from 'react';
import { logging, makeApi, SupersetApiError, t } from '@superset-ui/core';
import { styled, css, Alert } from '@apache-superset/core/ui';
import {
  Button,
  FormItem,
  InfoTooltip,
  Input,
  Modal,
  Loading,
  Form,
  Space,
} from '@superset-ui/core/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { Typography } from '@superset-ui/core/components/Typography';
import { ModalTitleWithIcon } from 'src/components/ModalTitleWithIcon';

type Props = {
  chartId: number;
  formData: Record<string, unknown>;
  show: boolean;
  onHide: () => void;
};

type EmbeddedChart = {
  uuid: string;
  allowed_domains: string[];
  chart_id: number;
  changed_on: string;
};

type EmbeddedApiPayload = { allowed_domains: string[] };

const stringToList = (stringyList: string): string[] =>
  stringyList.split(/(?:\s|,)+/).filter(x => x);

const ButtonRow = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
`;

export const ChartEmbedControls = ({ chartId, onHide }: Props) => {
  const { addInfoToast, addDangerToast } = useToasts();
  const [ready, setReady] = useState(true);
  const [loading, setLoading] = useState(false);
  const [embedded, setEmbedded] = useState<EmbeddedChart | null>(null);
  const [allowedDomains, setAllowedDomains] = useState<string>('');
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);

  const endpoint = `/api/v1/chart/${chartId}/embedded`;
  const isDirty =
    !embedded ||
    stringToList(allowedDomains).join() !== embedded.allowed_domains.join();

  const enableEmbedded = useCallback(() => {
    setLoading(true);
    makeApi<EmbeddedApiPayload, { result: EmbeddedChart }>({
      method: 'POST',
      endpoint,
    })({
      allowed_domains: stringToList(allowedDomains),
    })
      .then(
        ({ result }) => {
          setEmbedded(result);
          setAllowedDomains(result.allowed_domains.join(', '));
          addInfoToast(t('Changes saved.'));
        },
        err => {
          logging.error(err);
          addDangerToast(
            t('Sorry, something went wrong. The changes could not be saved.'),
          );
        },
      )
      .finally(() => {
        setLoading(false);
      });
  }, [endpoint, allowedDomains, addInfoToast, addDangerToast]);

  const disableEmbedded = useCallback(() => {
    setShowDeactivateConfirm(true);
  }, []);

  const confirmDeactivate = useCallback(() => {
    setLoading(true);
    makeApi<object>({ method: 'DELETE', endpoint })({})
      .then(
        () => {
          setEmbedded(null);
          setAllowedDomains('');
          setShowDeactivateConfirm(false);
          addInfoToast(t('Embedding deactivated.'));
          onHide();
        },
        err => {
          logging.error(err);
          addDangerToast(
            t(
              'Sorry, something went wrong. Embedding could not be deactivated.',
            ),
          );
        },
      )
      .finally(() => {
        setLoading(false);
      });
  }, [endpoint, addInfoToast, addDangerToast, onHide]);

  useEffect(() => {
    setReady(false);
    makeApi<object, { result: EmbeddedChart }>({
      method: 'GET',
      endpoint,
    })({})
      .catch(err => {
        if ((err as SupersetApiError).status === 404) {
          return { result: null };
        }
        addDangerToast(t('Sorry, something went wrong. Please try again.'));
        throw err;
      })
      .then(({ result }) => {
        setReady(true);
        setEmbedded(result);
        setAllowedDomains(result ? result.allowed_domains.join(', ') : '');
      });
  }, [chartId, addDangerToast, endpoint]);

  if (!ready) {
    return <Loading />;
  }

  return (
    <>
      {embedded ? (
        <p>
          {t(
            'This chart is ready to embed. In your application, pass the following id to the SDK:',
          )}
          <br />
          <code>{embedded.uuid}</code>
        </p>
      ) : (
        <p>
          {t(
            'Configure this chart to embed it into an external web application.',
          )}
        </p>
      )}
      <p>
        {t('For further instructions, consult the')}{' '}
        <Typography.Link
          href="https://www.npmjs.com/package/@superset-ui/embedded-sdk"
          target="_blank"
          rel="noreferrer"
        >
          {t('Superset Embedded SDK documentation.')}
        </Typography.Link>
      </p>
      <h3>{t('Settings')}</h3>
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
            placeholder="superset.example.com"
            onChange={event => setAllowedDomains(event.target.value)}
          />
        </FormItem>
      </Form>
      {showDeactivateConfirm ? (
        <Alert
          closable={false}
          type="warning"
          message={t('Disable embedding?')}
          description={t('This will remove your current embed configuration.')}
          css={{
            textAlign: 'left',
            marginTop: '16px',
          }}
          action={
            <Space>
              <Button
                key="cancel"
                buttonStyle="secondary"
                onClick={() => setShowDeactivateConfirm(false)}
              >
                {t('Cancel')}
              </Button>
              <Button
                key="deactivate"
                buttonStyle="danger"
                onClick={confirmDeactivate}
                loading={loading}
              >
                {t('Deactivate')}
              </Button>
            </Space>
          }
        />
      ) : (
        <ButtonRow
          css={theme => css`
            margin-top: ${theme.margin}px;
          `}
        >
          {embedded ? (
            <>
              <Button
                onClick={disableEmbedded}
                buttonStyle="secondary"
                loading={loading}
              >
                {t('Deactivate')}
              </Button>
              <Button
                onClick={enableEmbedded}
                buttonStyle="primary"
                disabled={!isDirty}
                loading={loading}
              >
                {t('Save changes')}
              </Button>
            </>
          ) : (
            <Button
              onClick={enableEmbedded}
              buttonStyle="primary"
              loading={loading}
            >
              {t('Enable embedding')}
            </Button>
          )}
        </ButtonRow>
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
    >
      <ChartEmbedControls {...props} />
    </Modal>
  );
};

export default EmbeddedChartModal;
