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
import { Modal, Typography } from '@superset-ui/core/components';
import type { PublishReview } from './useDraftActions';

const noop = () => {};

/**
 * What publishing a draft also publishes, for the person to read before
 * anything is: each part's title, and what it says of itself.
 */
export default function PublishConfirmation({
  review,
  busy,
}: {
  review?: PublishReview;
  /** True while the parts and the canvas are being published. */
  busy: boolean;
}) {
  return (
    <Modal
      show={review !== undefined}
      name="canvas-publish-confirmation"
      title={t('Publish this canvas?')}
      onHide={review?.cancel ?? noop}
      onHandledPrimaryAction={review?.confirm}
      primaryButtonName={t('Publish')}
      primaryButtonLoading={busy}
      closable={!busy}
    >
      <Typography.Paragraph>
        {t(
          'Everyone who can view this canvas will see your changes. Publishing it also publishes:',
        )}
      </Typography.Paragraph>
      {review?.parts.map((part, index) => (
        // Parts may share a title, as two placements of one widget would.
        // eslint-disable-next-line react/no-array-index-key
        <section key={index} data-test="canvas-publish-part">
          <Typography.Text strong>{part.title}</Typography.Text>
          <ul>
            {part.lines.map(line => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ))}
    </Modal>
  );
}
