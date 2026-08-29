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
import { type ReactNode } from "react";
import { t } from "@apache-superset/core/translation";
import { css, styled } from "@apache-superset/core/theme";
import { Button, Input, Popover, Select } from "@superset-ui/core/components";
import { Radio } from "@superset-ui/core/components/Radio";
import { Icons } from "@superset-ui/core/components/Icons";
import {
  HeaderGroupColumnOption,
  HeaderGroupConfig,
  HeaderGroupLabelAlign,
  MAX_HEADER_GROUP_DEPTH,
} from "./types";

export type HeaderGroupEditorProps = {
  group: HeaderGroupConfig;
  path: number[];
  columnOptions: HeaderGroupColumnOption[];
  usedColumns: Set<string>;
  onChange: (path: number[], next: HeaderGroupConfig) => void;
  onAddChild: (path: number[]) => void;
  onRemove: (path: number[]) => void;
  children?: ReactNode;
};

const FormStack = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 3}px;
    min-width: ${theme.sizeUnit * 70}px;
  `}
`;

const FieldRow = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit}px;
  `}
`;

const FieldLabel = styled.span`
  ${({ theme }) => css`
    color: ${theme.colorTextSecondary};
    font-size: ${theme.fontSizeSM}px;
  `}
`;

const NestedCard = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 2}px;
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.borderRadius}px;
  `}
`;

const NestedHeader = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: ${theme.fontWeightStrong};
  `}
`;

const LABEL_ALIGN_OPTIONS: { label: string; value: HeaderGroupLabelAlign }[] = [
  { label: t("Left"), value: "left" },
  { label: t("Center"), value: "center" },
  { label: t("Right"), value: "right" },
];

export function getGroupTitle(path: number[]): string {
  const numberedPath = path.map((index) => index + 1).join(".");
  return path.length === 1
    ? t("Group %s", numberedPath)
    : t("Subgroup %s", numberedPath);
}

export function getGroupSummary(
  group: HeaderGroupConfig,
  path: number[],
): string {
  const title = getGroupTitle(path);
  return group.label ? `${title}: ${group.label}` : title;
}

function HeaderGroupForm({
  group,
  path,
  columnOptions,
  usedColumns,
  onChange,
  onAddChild,
  onRemove,
  showRemove = false,
}: HeaderGroupEditorProps & { showRemove?: boolean }) {
  const availableOptions = columnOptions.filter(
    (option) =>
      (group.columns ?? []).includes(option.value) ||
      !usedColumns.has(option.value),
  );
  const canAddChild = path.length < MAX_HEADER_GROUP_DEPTH;

  return (
    <FormStack data-test="header-group-editor">
      {showRemove && (
        <NestedHeader>
          <span>{getGroupTitle(path)}</span>
          <Button
            buttonStyle="link"
            buttonSize="small"
            aria-label={t("Remove group")}
            onClick={() => onRemove(path)}
            icon={<Icons.DeleteOutlined iconSize="s" />}
          />
        </NestedHeader>
      )}
      <FieldRow>
        <FieldLabel>{t("Name")}</FieldLabel>
        <Input
          aria-label={t("Group name")}
          value={group.label}
          placeholder={t("Enter group name")}
          onChange={(event) =>
            onChange(path, { ...group, label: event.target.value })
          }
        />
      </FieldRow>
      <FieldRow>
        <FieldLabel>{t("Columns")}</FieldLabel>
        <Select
          ariaLabel={t("Group columns")}
          mode="multiple"
          allowClear
          showSearch
          value={group.columns ?? []}
          options={availableOptions}
          placeholder={t("Select columns")}
          onChange={(columns) =>
            onChange(path, {
              ...group,
              columns: Array.isArray(columns) ? columns : [],
            })
          }
        />
      </FieldRow>
      <FieldRow>
        <FieldLabel>{t("Label position")}</FieldLabel>
        <Radio.Group
          size="small"
          optionType="button"
          value={group.labelAlign ?? "center"}
          onChange={(event) =>
            onChange(path, {
              ...group,
              labelAlign: event.target.value as HeaderGroupLabelAlign,
            })
          }
        >
          {LABEL_ALIGN_OPTIONS.map((option) => (
            <Radio.Button key={option.value} value={option.value}>
              {option.label}
            </Radio.Button>
          ))}
        </Radio.Group>
      </FieldRow>
      {(group.children ?? []).length > 0 && (
        <FieldRow>
          {(group.children ?? []).map((child, index) => (
            <NestedCard key={child.id}>
              <HeaderGroupForm
                group={child}
                path={[...path, index]}
                columnOptions={columnOptions}
                usedColumns={usedColumns}
                onChange={onChange}
                onAddChild={onAddChild}
                onRemove={onRemove}
                showRemove
              />
            </NestedCard>
          ))}
        </FieldRow>
      )}
      {canAddChild && (
        <Button
          buttonStyle="dashed"
          buttonSize="small"
          icon={<Icons.PlusOutlined iconSize="s" />}
          onClick={() => onAddChild(path)}
        >
          {t("Add subgroup")}
        </Button>
      )}
    </FormStack>
  );
}

export default function HeaderGroupEditor({
  children,
  ...formProps
}: HeaderGroupEditorProps) {
  return (
    <Popover
      title={getGroupTitle(formProps.path)}
      trigger={["click"]}
      destroyOnHidden
      overlayStyle={{ maxWidth: 420 }}
      content={<HeaderGroupForm {...formProps} />}
    >
      {children}
    </Popover>
  );
}
