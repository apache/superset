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
import { styled } from '@apache-superset/core/theme';

export interface MemberLabel {
  name: string;
  memberId?: string;
  fullName: string;
}

/** Qualify only semantic members whose visible names collide. */
export function getSemanticMemberLabels(
  columns: { column_name: string; verbose_name?: string | null }[],
): Map<string, MemberLabel> {
  const names = columns.map(
    column => column.verbose_name || column.column_name,
  );
  const counts = new Map<string, number>();
  names.forEach(name => counts.set(name, (counts.get(name) ?? 0) + 1));
  return new Map(
    columns.map((column, index) => {
      const name = names[index];
      const memberId =
        (counts.get(name) ?? 0) > 1 ? column.column_name : undefined;
      return [
        column.column_name,
        { name, memberId, fullName: memberId ? `${name} (${memberId})` : name },
      ];
    }),
  );
}

const Label = styled.span`
  display: flex;
  flex-direction: column;
  min-width: 0;
  white-space: normal;
  line-height: 1.3;

  [data-test='semantic-member-id'] {
    overflow-wrap: anywhere;
  }
`;

export function SemanticMemberLabel({
  label,
  showName = true,
  showTitle = false,
}: {
  label: MemberLabel;
  showName?: boolean;
  showTitle?: boolean;
}) {
  return (
    <Label title={showTitle ? label.fullName : undefined}>
      {showName && <span>{label.name}</span>}
      {label.memberId && (
        <span data-test="semantic-member-id">{label.memberId}</span>
      )}
    </Label>
  );
}
