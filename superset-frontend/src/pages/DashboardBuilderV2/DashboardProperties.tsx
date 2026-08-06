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
import type { ReactElement } from 'react';
import rison from 'rison';
import { SupersetClient } from '@superset-ui/core';
import { t, tn } from '@apache-superset/core/translation';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import { Collapse, Form } from '@superset-ui/core/components';
import { useJsonValidation } from '@superset-ui/core/components/AsyncAceEditor';
import type { TagType } from 'src/components';
import type Subject from 'src/types/Subject';
import type { SubjectPickerValue } from 'src/features/subjects/SubjectPicker';
import { useModalValidation } from 'src/components/Modal';
import {
  AccessSection,
  AdvancedSection,
  BasicInfoSection,
  CertificationSection,
  RefreshSection,
  StylingSection,
} from 'src/dashboard/components/PropertiesModal/sections';
import { provider, useDashboardRevision } from 'src/core/dashboard/store';

/**
 * The dashboard's own fields, as the root node stores them.
 *
 * Named once because three things have to agree on them: what is read out of
 * the root to fill the form, what is written back, and what counts as a
 * change worth committing.
 */
const TEXT_FIELDS = [
  'title',
  'slug',
  'description',
  'certifiedBy',
  'certificationDetails',
] as const;

type TextField = (typeof TEXT_FIELDS)[number];
type TextValues = Record<TextField, string>;

interface FetchedTheme {
  id: number;
  theme_name: string;
  json_data?: string;
}

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

/**
 * A section's name, at the weight the rest of this panel names things at.
 *
 * The sections below are drawn for a modal, and the wrapper they come with
 * dresses each one as a heading with a subtitle, a banded background and a
 * tick saying it validates. In a modal that is the whole screen and the
 * reader has nothing else to look at; in a rail beside the canvas it shouts
 * over the fields it introduces, and sat a heading twice the size of the
 * `Arrangement` heading directly beneath it.
 *
 * So the sections are kept and their wrapper is not: this matches `Section`
 * in the Inspector, which is what a group of fields is called everywhere else
 * in this panel. The ticks go with it — they report on a save that this page
 * cannot do, and each section still says what is wrong with it where the
 * wrong thing is.
 */
const sectionLabel = (
  theme: ReturnType<typeof useTheme>,
  title: string,
): ReactElement => (
  <span style={{ fontSize: theme.fontSizeSM, color: theme.colorTextSecondary }}>
    {title}
  </span>
);

/**
 * The panel, and the one thing `size="small"` cannot reach on its own.
 *
 * A global rule sets `padding: 4px 8px` on every `input[type="text"]` in the
 * app. antd sizes a small input by zeroing its own block padding, so that
 * rule wins on specificity and a field marked `ant-input-sm` still renders at
 * the middle height — eight pixels taller than every other input in this
 * rail. The sections below write `type="text"` explicitly, which is what puts
 * them in the global rule's way.
 *
 * Scoped to this panel rather than fixed at the global rule, which is load
 * bearing for the rest of the app and not this change's to move.
 */
const Panel = styled.div`
  ${({ theme }) => css`
    padding-top: ${theme.sizeUnit * 3}px;
    font-size: ${theme.fontSizeSM}px;

    /* Doubled deliberately. The global rule is a class plus an attribute
       selector, the same specificity this would otherwise have, and it is
       injected later — so matching it is losing to it. */
    && input[type='text'] {
      padding-block: 0;
      padding-inline: ${theme.sizeUnit * 2}px;
    }
  `}
`;

/** How many blocks are on the dashboard, at any depth. */
const countBlocks = (id: string): number =>
  (provider.getNode(id)?.children ?? []).reduce(
    (total, childId) => total + 1 + countBlocks(childId),
    0,
  );

/**
 * Everything the dashboard is, as opposed to everything on it.
 *
 * The six sections are the ones `PropertiesModal` already draws, reused whole
 * rather than reimplemented: the modal and this panel are two ways into one
 * set of fields, and a second implementation is how the two quietly stop
 * agreeing about what a dashboard has. Their wrapper is not reused — see
 * {@link sectionLabel} for why a modal's headings do not belong in a rail.
 *
 * Everything is stored on the root node's props, beside the `title` the
 * header already keeps there — the only place a dashboard-level fact is
 * visible to the assistant and reachable by the client tools. Nothing is
 * persisted, because nothing on this page is; what that means for the reader
 * is said plainly at the top of the panel rather than left to be discovered
 * at the disabled Save button.
 *
 * Text commits on blur, through one handler on the container rather than one
 * per field: every input and both editors bubble a blur, and one commit per
 * field left beats one revision tick per keystroke. Discrete controls — the
 * pickers, the colour scheme, the refresh interval, the switch — commit in
 * their own handler, because there is no typing to wait out and a dropdown
 * that closes on an uncommitted value reads as broken.
 */
export default function DashboardProperties(): ReactElement {
  useDashboardRevision();
  const theme = useTheme();
  const root = provider.getRoot();
  const props = useMemo(() => root.props ?? {}, [root.props]);

  const [form] = Form.useForm();

  /** What the root currently says, in the shape the form takes. */
  const accepted = useMemo(
    () =>
      Object.fromEntries(
        TEXT_FIELDS.map(key => [key, asString(props[key])]),
      ) as TextValues,
    [props],
  );

  // The form holds a draft of the text fields, and the draft is a view of
  // what was accepted — so a rename made in the header, or by the assistant,
  // replaces it rather than being typed over.
  useEffect(() => form.setFieldsValue(accepted), [accepted, form]);

  // Both editors report every keystroke. Held here and committed with the
  // rest of the text, so an unfinished CSS rule is not a revision.
  const [customCss, setCustomCss] = useState(() => asString(props.customCss));
  const [jsonMetadata, setJsonMetadata] = useState(() =>
    asString(props.jsonMetadata),
  );
  useEffect(() => setCustomCss(asString(props.customCss)), [props.customCss]);
  useEffect(
    () => setJsonMetadata(asString(props.jsonMetadata)),
    [props.jsonMetadata],
  );

  const jsonAnnotations = useJsonValidation(jsonMetadata, {
    errorPrefix: 'Invalid JSON metadata',
  });

  const { validationStatus, validateSection } = useModalValidation({
    sections: [
      {
        key: 'basic',
        name: t('General information'),
        validator: () =>
          form.getFieldValue('title')?.trim()
            ? []
            : [t('Dashboard name is required')],
      },
      {
        key: 'advanced',
        name: t('Advanced settings'),
        validator: () =>
          jsonAnnotations.length > 0 ? [t('Invalid JSON metadata')] : [],
      },
    ],
  });

  const write = useCallback(
    (next: Record<string, unknown>) => provider.updateProps(root.id, next),
    [root.id],
  );

  /**
   * Commits every text field that changed, on the way out of any of them.
   *
   * Two are refused rather than written. An emptied name is not a rename —
   * the same rule the header title keeps, and the reason a stray
   * select-all-and-delete cannot leave the dashboard nameless. Unparseable
   * JSON metadata is not metadata; the section already shows where it broke,
   * and writing a string no reader can parse would leave the dashboard in a
   * state only this field could get it out of.
   */
  const commit = useCallback((): void => {
    validateSection('basic');
    validateSection('advanced');

    const draft = form.getFieldsValue() as Partial<TextValues>;
    const changed: Record<string, unknown> = {};

    TEXT_FIELDS.forEach(key => {
      const value = asString(draft[key]);
      if (key === 'title' && value.trim() === '') {
        form.setFieldsValue({ title: accepted.title });
        return;
      }
      if (value !== accepted[key]) {
        changed[key] = value;
      }
    });

    if (customCss !== asString(props.customCss)) {
      changed.customCss = customCss;
    }
    if (
      jsonMetadata !== asString(props.jsonMetadata) &&
      jsonAnnotations.length === 0
    ) {
      changed.jsonMetadata = jsonMetadata;
    }

    if (Object.keys(changed).length > 0) {
      write(changed);
    }
  }, [
    accepted,
    customCss,
    form,
    jsonAnnotations.length,
    jsonMetadata,
    props.customCss,
    props.jsonMetadata,
    validateSection,
    write,
  ]);

  // Offered to StylingSection, which lists them. Fetched here because the
  // panel is where they are needed and nothing else on this page knows the
  // dashboard has a theme at all. A failure leaves the list empty rather than
  // taking the panel down with it — every other field still edits.
  const [themes, setThemes] = useState<FetchedTheme[]>([]);
  useEffect(() => {
    const query = rison.encode({
      columns: ['id', 'theme_name', 'is_system', 'json_data'],
      filters: [{ col: 'is_system', opr: 'eq', value: false }],
    });
    let live = true;
    SupersetClient.get({ endpoint: `/api/v1/theme/?q=${query}` })
      .then(({ json }) => {
        if (live) setThemes(json.result ?? []);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const blocks = countBlocks(root.id);

  return (
    // One handler for every field that is typed into: each bubbles its blur
    // here, and what changed is worked out once rather than remembered per
    // field.
    <Panel data-test="dashboard-properties" onBlur={commit}>
      <h3
        data-test="dashboard-properties-name"
        style={{
          margin: 0,
          fontSize: theme.fontSize,
          fontWeight: theme.fontWeightStrong,
          color: theme.colorText,
        }}
      >
        {accepted.title || t('Untitled dashboard')}
      </h3>
      <p
        data-test="dashboard-properties-counts"
        style={{
          margin: `${theme.sizeUnit}px 0 0`,
          color: theme.colorTextSecondary,
        }}
      >
        {/* Filters are a literal nothing rather than a number that moves:
            this builder has no concept of one yet, and a count that could
            only ever read zero is still the honest answer to what is here. */}
        {`${tn('%s block', '%s blocks', blocks, blocks)}, ${tn(
          '%s filter',
          '%s filters',
          0,
          0,
        )}`}
      </p>
      <p
        data-test="dashboard-properties-caption"
        style={{
          margin: `${theme.sizeUnit * 2}px 0 ${theme.sizeUnit * 3}px`,
          color: theme.colorTextTertiary,
        }}
      >
        {t(
          'These belong to the dashboard rather than to its contents. Nothing here is saved yet — the builder holds them in memory.',
        )}
      </p>

      {/* `size="small"` reaches every control the reused sections draw: they
          are written for a modal, where a control has the room to be full
          height, and this rail spends its width on the fields themselves. */}
      <Form form={form} layout="vertical" size="small" initialValues={accepted}>
        <Collapse
          ghost
          size="small"
          expandIconPosition="start"
          defaultActiveKey={['basic']}
          items={[
            {
              key: 'basic',
              label: sectionLabel(theme, t('General information')),
              children: (
                <BasicInfoSection
                  form={form}
                  validationStatus={validationStatus}
                />
              ),
            },
            {
              key: 'access',
              label: sectionLabel(theme, t('Access & ownership')),
              children: (
                <AccessSection
                  isLoading={false}
                  tags={(props.tags as TagType[]) ?? []}
                  editors={(props.editors as Subject[]) ?? []}
                  viewers={(props.viewers as Subject[]) ?? []}
                  onChangeEditors={(editors: SubjectPickerValue[]) =>
                    write({ editors })
                  }
                  onChangeViewers={(viewers: SubjectPickerValue[]) =>
                    write({ viewers })
                  }
                  onChangeTags={tags => write({ tags })}
                  onClearTags={() => write({ tags: [] })}
                />
              ),
            },
            {
              key: 'styling',
              label: sectionLabel(theme, t('Styling')),
              children: (
                <StylingSection
                  themes={themes}
                  selectedThemeId={(props.themeId as number) ?? null}
                  colorScheme={asString(props.colorScheme)}
                  customCss={customCss}
                  hasCustomLabelsColor={false}
                  showChartTimestamps={props.showChartTimestamps === true}
                  onThemeChange={value => write({ themeId: value || null })}
                  onColorSchemeChange={colorScheme => write({ colorScheme })}
                  onCustomCssChange={setCustomCss}
                  onShowChartTimestampsChange={showChartTimestamps =>
                    write({ showChartTimestamps })
                  }
                />
              ),
            },
            {
              key: 'refresh',
              label: sectionLabel(theme, t('Refresh settings')),
              children: (
                <RefreshSection
                  refreshFrequency={(props.refreshFrequency as number) ?? 0}
                  onRefreshFrequencyChange={refreshFrequency =>
                    write({ refreshFrequency })
                  }
                />
              ),
            },
            {
              key: 'certification',
              label: sectionLabel(theme, t('Certification')),
              children: <CertificationSection isLoading={false} />,
            },
            {
              key: 'advanced',
              label: sectionLabel(theme, t('Advanced settings')),
              children: (
                <AdvancedSection
                  jsonMetadata={jsonMetadata}
                  jsonAnnotations={jsonAnnotations}
                  validationStatus={validationStatus}
                  onJsonMetadataChange={setJsonMetadata}
                />
              ),
            },
          ]}
        />
      </Form>
    </Panel>
  );
}
