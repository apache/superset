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
import { useEffect, useMemo } from "react";
import { t } from "@apache-superset/core/translation";
import { css, styled } from "@apache-superset/core/theme";
import { Icons } from "@superset-ui/core/components/Icons";
import ControlHeader from "src/explore/components/ControlHeader";
import HeaderGroupEditor, { getGroupSummary } from "./HeaderGroupEditor";
import { HeaderGroupConfig, HeaderGroupsControlProps } from "./types";
import {
  collectHeaderGroupColumns,
  createHeaderGroup,
  headerGroupsHaveSameColumns,
  pruneStaleHeaderGroupColumns,
  removeHeaderGroupAt,
  updateHeaderGroupAt,
} from "./utils";
import {
  AddControlLabel,
  CaretContainer,
  Label,
  OptionControlContainer,
} from "../OptionControls";

const GroupsContainer = styled.div`
  ${({ theme }) => css`
    padding: ${theme.sizeUnit}px;
    border: solid 1px ${theme.colorBorder};
    border-radius: ${theme.borderRadius}px;
  `}
`;

const GroupRow = styled(OptionControlContainer)`
  &,
  & > div {
    margin-bottom: ${({ theme }) => theme.sizeUnit}px;
    :last-child {
      margin-bottom: 0;
    }
  }
`;

const CloseButton = styled.button`
  ${({ theme }) => css`
    background: ${theme.colorBgLayout};
    color: ${theme.colorIcon};
    height: 100%;
    width: ${theme.sizeUnit * 6}px;
    border: none;
    border-right: solid 1px ${theme.colorBorder};
    padding: 0;
    outline: none;
    border-bottom-left-radius: 3px;
    border-top-left-radius: 3px;
  `}
`;

export default function HeaderGroupsControl({
  value = [],
  onChange,
  columnOptions = [],
  ...props
}: HeaderGroupsControlProps) {
  const groups = value ?? [];

  useEffect(() => {
    if (columnOptions.length === 0 || !onChange) {
      return;
    }
    const pruned = pruneStaleHeaderGroupColumns(groups, columnOptions);
    if (!headerGroupsHaveSameColumns(groups, pruned)) {
      onChange(pruned);
    }
  }, [columnOptions, groups, onChange]);

  const usedColumns = useMemo(
    () => new Set(collectHeaderGroupColumns(groups)),
    [groups],
  );

  const handleGroupChange = (path: number[], next: HeaderGroupConfig) => {
    onChange?.(updateHeaderGroupAt(groups, path, () => next));
  };

  const handleAddGroup = () => {
    onChange?.([...groups, createHeaderGroup()]);
  };

  const handleAddChild = (path: number[]) => {
    onChange?.(
      updateHeaderGroupAt(groups, path, (group) => ({
        ...group,
        children: [...(group.children ?? []), createHeaderGroup()],
      })),
    );
  };

  const handleRemove = (path: number[]) => {
    onChange?.(removeHeaderGroupAt(groups, path));
  };

  return (
    <div data-test="header-groups-control">
      <ControlHeader {...props} />
      <GroupsContainer>
        {groups.map((group, index) => (
          <GroupRow key={group.id}>
            <CloseButton
              aria-label={t("Remove group")}
              onClick={() => handleRemove([index])}
            >
              <Icons.CloseOutlined iconSize="m" />
            </CloseButton>
            <HeaderGroupEditor
              group={group}
              path={[index]}
              columnOptions={columnOptions}
              usedColumns={usedColumns}
              onChange={handleGroupChange}
              onAddChild={handleAddChild}
              onRemove={handleRemove}
            >
              <OptionControlContainer withCaret>
                <Label>{getGroupSummary(group, [index])}</Label>
                <CaretContainer>
                  <Icons.RightOutlined iconSize="m" />
                </CaretContainer>
              </OptionControlContainer>
            </HeaderGroupEditor>
          </GroupRow>
        ))}
        <AddControlLabel onClick={handleAddGroup}>
          <Icons.PlusOutlined
            iconSize="m"
            css={(theme) => ({
              margin: `auto ${theme.sizeUnit}px auto 0`,
              verticalAlign: "baseline",
            })}
          />
          {t("Add group")}
        </AddControlLabel>
      </GroupsContainer>
    </div>
  );
}
