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
import { getCategoricalSchemeRegistry } from '@superset-ui/core';
import {
  Avatar,
  AvatarGroup,
  Tooltip,
  type AvatarProps,
} from '@superset-ui/core/components';
import { styled } from '@apache-superset/core/theme';
import type { CSSProperties } from 'react';
import { ensureAppRoot } from 'src/utils/navigationUtils';
import Subject, { SubjectType } from 'src/types/Subject';

const colorList = getCategoricalSchemeRegistry().get()?.colors ?? [];
const AVATAR_SIZE: AvatarProps['size'] = 'small';
const SUBJECT_TYPE_ORDER: Record<SubjectType, number> = {
  [SubjectType.User]: 0,
  [SubjectType.Group]: 1,
  [SubjectType.Role]: 2,
};

// https://en.wikipedia.org/wiki/Linear_congruential_generator
function stringAsciiPRNG(value: string, m: number) {
  const charCodes = [...value].map(letter => letter.charCodeAt(0));
  const len = charCodes.length;
  const a = (len % (m - 1)) + 1;
  const c = charCodes.reduce((current, next) => current + next) % m;
  let random = charCodes[0] % m;
  for (let i = 0; i < len; i += 1) {
    random = (a * random + c) % m;
  }
  return random;
}

function getRandomColor(sampleValue: string, colors: string[]) {
  if (!sampleValue) return 'transparent';
  return colors[stringAsciiPRNG(sampleValue, colors.length)];
}

function getInitials(label: string): string {
  const words = label.trim().split(/\s+/);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toLocaleUpperCase();
  }
  return label.slice(0, 2).toLocaleUpperCase();
}

const RoleAvatar = styled(Avatar)`
  clip-path: polygon(
    29.3% 0%,
    70.7% 0%,
    100% 29.3%,
    100% 70.7%,
    70.7% 100%,
    29.3% 100%,
    0% 70.7%,
    0% 29.3%
  );
  border-radius: 0;
`;

function getAvatarShape(type?: SubjectType): 'circle' | 'square' | undefined {
  if (type === SubjectType.Group) return 'square';
  return undefined;
}

function sortSubjectsForPile(subjects: Subject[]): Subject[] {
  return [...subjects].sort((subjectA, subjectB) => {
    const typeOrder =
      SUBJECT_TYPE_ORDER[subjectA.type] - SUBJECT_TYPE_ORDER[subjectB.type];
    if (typeOrder !== 0) return typeOrder;

    const labelOrder = (subjectA.label ?? '').localeCompare(
      subjectB.label ?? '',
    );
    if (labelOrder !== 0) return labelOrder;

    return subjectA.id - subjectB.id;
  });
}

export function SubjectPile({
  subjects,
  maxCount = 4,
}: {
  subjects: Subject[];
  maxCount?: number;
}) {
  const sortedSubjects = sortSubjectsForPile(subjects);

  return (
    <AvatarGroup max={{ count: maxCount }} size={AVATAR_SIZE}>
      {sortedSubjects.map((subject, index) => {
        const displayName = subject.label ?? '';
        const uniqueKey = `${subject.id}-${displayName}`;
        const color = getRandomColor(uniqueKey, colorList);
        const avatarUrl = subject.img ? ensureAppRoot(subject.img) : undefined;
        const initials = getInitials(displayName);
        const avatarStyle: CSSProperties = {
          backgroundColor: color,
          borderColor: color,
          position: 'relative',
          zIndex: sortedSubjects.length - index,
        };

        const AvatarComponent =
          subject.type === SubjectType.Role ? RoleAvatar : Avatar;

        return (
          <Tooltip key={uniqueKey} title={displayName} placement="top">
            <AvatarComponent
              key={uniqueKey}
              shape={getAvatarShape(subject.type)}
              size={AVATAR_SIZE}
              style={avatarStyle}
              src={avatarUrl}
            >
              {initials}
            </AvatarComponent>
          </Tooltip>
        );
      })}
    </AvatarGroup>
  );
}
