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
import { Alert } from '@apache-superset/core/components';
import { Button, Modal, Typography } from '@superset-ui/core/components';
import type { PublishPartOutcome, PublishReview } from './useDraftActions';

const noop = () => {};

/** How a part's publish went, beside its title, once it went anywhere. */
function PartStatus({
  outcome,
  ended,
}: {
  outcome?: PublishPartOutcome;
  /** Whether the publish ended, so a part without an outcome never went. */
  ended: boolean;
}) {
  if (outcome?.state === 'published') {
    return <Typography.Text type="success">{t('Published')}</Typography.Text>;
  }
  if (outcome?.state === 'failed') {
    return (
      <Typography.Text type="danger">
        {t('Not published: %s', outcome.message)}
      </Typography.Text>
    );
  }
  return ended ? (
    <Typography.Text type="secondary">{t('Not published')}</Typography.Text>
  ) : null;
}

/**
 * What publishing a draft also publishes, for the person to read before
 * anything is: each part's title, and what it says of itself. Once they
 * confirmed, how each part went. A publish that stopped after some parts went
 * out stays open to say which, that the canvas didn't, and how to go on; a
 * publish whose parts have notices stays open to show them.
 */
export default function PublishConfirmation({
  review,
  busy,
}: {
  review?: PublishReview;
  /** True while the parts and the canvas are being published. */
  busy: boolean;
}) {
  const end = review?.end;
  const stopped = end?.state === 'stopped' ? end : undefined;
  const close = review?.cancel ?? noop;

  let title = t('Publish this canvas?');
  let intro = t(
    'Everyone who can view this canvas will see your changes. Publishing it also publishes:',
  );
  if (stopped) {
    title = t("The canvas wasn't published");
    intro = t('Publishing stopped partway. What went out stays published:');
  } else if (end) {
    title = t('Canvas published');
    intro = t(
      'Everyone who can view this canvas sees your changes. Published with it:',
    );
  }

  let footer;
  if (stopped?.retry) {
    footer = (
      <>
        <Button buttonStyle="secondary" onClick={close} disabled={busy} cta>
          {t('Close')}
        </Button>
        <Button
          buttonStyle="primary"
          onClick={review?.confirm}
          loading={busy}
          cta
        >
          {t('Publish again')}
        </Button>
      </>
    );
  } else if (end) {
    footer = (
      <Button buttonStyle="primary" onClick={close} cta>
        {stopped ? t('Close') : t('OK')}
      </Button>
    );
  }

  return (
    <Modal
      show={review !== undefined}
      name="canvas-publish-confirmation"
      title={title}
      onHide={close}
      onHandledPrimaryAction={review?.confirm}
      primaryButtonName={t('Publish')}
      primaryButtonLoading={busy}
      closable={!busy}
      footer={footer}
    >
      <Typography.Paragraph>{intro}</Typography.Paragraph>
      {review?.parts.map((part, index) => {
        const outcome = review.outcomes[index];
        return (
          // Parts may share a title, as two placements of one widget would.
          // eslint-disable-next-line react/no-array-index-key
          <section key={index} data-test="canvas-publish-part">
            <Typography.Text strong>{part.title}</Typography.Text>{' '}
            <PartStatus outcome={outcome} ended={end !== undefined} />
            {!end && (
              <ul>
                {part.lines.map(line => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
            {outcome?.state === 'published' &&
              outcome.notices.map(notice => (
                <Alert key={notice} type="warning" closable={false}>
                  {notice}
                </Alert>
              ))}
          </section>
        );
      })}
      {stopped && (
        <>
          <Typography.Paragraph strong>{stopped.reason}</Typography.Paragraph>
          {stopped.retry && (
            <Typography.Paragraph>
              {t(
                "Publish again to publish the rest, then the canvas: what went out isn't published twice.",
              )}
            </Typography.Paragraph>
          )}
        </>
      )}
    </Modal>
  );
}
