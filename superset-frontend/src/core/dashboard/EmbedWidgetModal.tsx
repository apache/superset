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
import { useState, type ReactElement } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { Button, Flex, Modal, Typography } from '@superset-ui/core/components';
import { describeFetchError } from '@apache-superset/widgets/chartData';
import { isExtensionWidgetType } from '@apache-superset/widgets/embed/extensionLoader';
import type { SavedWidget } from '@apache-superset/core/widgets';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { useDashboardStore } from './store';
import { widgetLabel } from './widgetLabel';

/** Where the saved widget's uuid is kept on the node, so re-embedding updates it. */
export const EMBED_WIDGET_ID_PROP = 'embedWidgetId';

function datasetIdOf(props: Record<string, unknown>): number | undefined {
  const binding = props.dataBinding as { datasetId?: number } | undefined;
  return binding?.datasetId ?? (props.datasetId as number | undefined);
}

export default function EmbedWidgetModal({
  nodeId,
  show,
  onHide,
}: {
  nodeId: string;
  show: boolean;
  onHide: () => void;
}): ReactElement | null {
  const store = useDashboardStore();
  const { addDangerToast, addSuccessToast } = useToasts();
  const node = store.getNode(nodeId);
  const [saving, setSaving] = useState(false);

  if (!node) return null;

  const { [EMBED_WIDGET_ID_PROP]: storedId, ...props } = node.props ?? {};
  const widgetId = typeof storedId === 'string' ? storedId : undefined;
  const datasetId = datasetIdOf(props);

  const save = async () => {
    setSaving(true);
    try {
      const title = widgetLabel(node.type, props) || undefined;
      const { json } = widgetId
        ? await SupersetClient.put({
            endpoint: `/api/v1/widget/${widgetId}`,
            jsonPayload: { props, title },
          })
        : await SupersetClient.post({
            endpoint: '/api/v1/widget/',
            jsonPayload: { widget_type: node.type, props, title },
          });
      const saved = json.result as SavedWidget;
      store.updateProps(nodeId, { [EMBED_WIDGET_ID_PROP]: saved.uuid });
      addSuccessToast(t('Widget saved for embedding'));
    } catch (error) {
      addDangerToast(await describeFetchError(error));
    } finally {
      setSaving(false);
    }
  };

  const savedSnippet = widgetId
    ? `<Widget id="${widgetId}" />\n\n` +
      `// guest token\n{ resources: [{ type: "widget", id: "${widgetId}" }], rls: [] }`
    : '';
  const inlineSnippet = `<Widget\n  type="${node.type}"\n  props={${JSON.stringify(props, null, 2)}}\n/>${
    datasetId !== undefined
      ? `\n\n// guest token\n{ resources: [], datasets: [${datasetId}], rls: [] }`
      : ''
  }`;

  return (
    <Modal
      show={show}
      onHide={onHide}
      title={t('Embed widget')}
      name={t('Embed widget')}
      footer={
        <Flex justify="flex-end" gap="small">
          <Button buttonStyle="secondary" onClick={onHide}>
            {t('Close')}
          </Button>
          <Button buttonStyle="primary" loading={saving} onClick={save}>
            {widgetId ? t('Update saved widget') : t('Save widget')}
          </Button>
        </Flex>
      }
    >
      <Flex vertical gap="middle">
        <Typography.Text>
          {t(
            'Render this widget in any React app with @apache-superset/widgets, inside a SupersetProvider.',
          )}
        </Typography.Text>
        {isExtensionWidgetType(node.type) && (
          <Typography.Text type="secondary">
            {t(
              'This widget comes from an extension. The host page loads that extension from Superset as it renders; with guest tokens the deployment also needs EMBEDDED_EXTENSION_ASSETS_PUBLIC.',
            )}
          </Typography.Text>
        )}
        <Typography.Text strong>{t('By saved id')}</Typography.Text>
        {widgetId ? (
          <Typography.Paragraph copyable={{ text: savedSnippet }}>
            <pre data-test="embed-widget-saved-snippet">{savedSnippet}</pre>
          </Typography.Paragraph>
        ) : (
          <Typography.Text type="secondary">
            {t(
              'Save the widget to get an id. The server then runs the saved definition and the host cannot change it.',
            )}
          </Typography.Text>
        )}
        <Typography.Text strong>{t('Inline')}</Typography.Text>
        <Typography.Paragraph copyable={{ text: inlineSnippet }}>
          <pre data-test="embed-widget-inline-snippet">{inlineSnippet}</pre>
        </Typography.Paragraph>
      </Flex>
    </Modal>
  );
}
