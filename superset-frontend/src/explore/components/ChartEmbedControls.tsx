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
import React, { useCallback, useEffect, useState } from 'react';
import { makeApi, styled, SupersetApiError, t } from '@superset-ui/core';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';
import { Chart, EmbeddedChart } from '../../dashboard/types';
import { Input } from '../../components/Input';
import { FormItem } from '../../components/Form';
import Button from '../../components/Button';
import { useToasts } from '../../components/MessageToasts/withToasts';
import Modal from '../../components/Modal';
import Loading from '../../components/Loading';

// TODO is it possible to reuse code from Dashboard's embed?
const ButtonRow = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
`;

const stringToList = (stringyList: string): string[] =>
  stringyList.split(/(?:\s|,)+/).filter(x => x);

type EmbeddedApiPayload = { allowed_domains: string[] };

type Props = {
  chart: Chart;
};

const ChartEmbedControls = ({ chart }: Props) => {
  const { addInfoToast, addDangerToast } = useToasts();
  const [ready, setReady] = useState(true); // whether we have initialized yet
  const [loading, setLoading] = useState(false); // whether we are currently doing an async thing
  const [embedded, setEmbedded] = useState<EmbeddedChart | null>(null); // the embedded dashboard config
  const [allowedDomains, setAllowedDomains] = useState<string>('');

  const endpoint = `/api/v1/chart/${chart.id}/embedded`;

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
          console.error(err);
          addDangerToast(
            t(
              t('Sorry, something went wrong. The changes could not be saved.'),
            ),
          );
        },
      )
      .finally(() => {
        setLoading(false);
      });
  }, [endpoint, allowedDomains]);

  const disableEmbedded = useCallback(() => {
    Modal.confirm({
      title: t('Disable embedding?'),
      content: t('This will remove your current embed configuration.'),
      okType: 'danger',
      onOk: () => {
        setLoading(true);
        makeApi<{}>({ method: 'DELETE', endpoint })({})
          .then(
            () => {
              setEmbedded(null);
              setAllowedDomains('');
              addInfoToast(t('Embedding deactivated.'));
              // TODO onHide();
            },
            err => {
              console.error(err);
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
      },
    });
  }, [endpoint]);

  useEffect(() => {
    setReady(false);
    makeApi<{}, { result: EmbeddedChart }>({
      method: 'GET',
      endpoint,
    })({})
      .catch(err => {
        if ((err as SupersetApiError).status === 404) {
          // 404 just means the dashboard isn't currently embedded
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
  }, [chart]);

  if (!ready) {
    return <Loading />;
  }

  const isDirty =
    !embedded ||
    stringToList(allowedDomains).join() !== embedded.allowed_domains.join();

  return (
    <>
      {embedded ? (
        <p>
          {t(
            'This dashboard is ready to embed. In your application, pass the following id to the SDK:',
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
      <h3>{t('Settings')}</h3>
      <FormItem>
        <label htmlFor="allowed-domains">
          {t('Allowed Domains (comma separated)')}{' '}
          <InfoTooltipWithTrigger
            tooltip={t(
              'A list of domain names that can embed this dashboard. Leaving this field empty will allow embedding from any domain.',
            )}
          />
        </label>
        <Input
          name="allowed-domains"
          id="allowed-domains"
          value={allowedDomains}
          placeholder="superset.example.com"
          onChange={event => setAllowedDomains(event.target.value)}
        />
      </FormItem>
      <ButtonRow>
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
    </>
  );
};

export default ChartEmbedControls;
