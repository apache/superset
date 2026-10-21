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
import { SupersetClient } from '@superset-ui/core';
import rison from 'rison';
import {
  SUBJECT_DETAIL_PROP,
  SUBJECT_OPTION_FILTER_PROPS,
  SUBJECT_TEXT_LABEL_PROP,
  SubjectSelectLabel,
} from 'src/features/subjects/SubjectSelectLabel';
import { getUserDisplayLabel } from 'src/features/users/utils';
import { FormValues } from './types';

type UserRecord = { id: number; email?: string } & Parameters<
  typeof getUserDisplayLabel
>[0];

/**
 * Option props AsyncSelect's client-side re-filter should match against for
 * user options: the display name, the email and the username. These mirror
 * the columns the server-side `user_all_text` filter searches, so a user the
 * server matched is never hidden by the picker.
 */
export const USER_OPTION_FILTER_PROPS = [
  ...SUBJECT_OPTION_FILTER_PROPS,
  'username',
];

/**
 * Build a select option for a user picker.
 *
 * The option shows the email under the display name, like the subject-based
 * owner pickers do, so that a server-side match on email is visible to the
 * person searching. Plain-text copies of both lines, plus the username, are
 * attached under the `USER_OPTION_FILTER_PROPS` keys so AsyncSelect's
 * client-side re-filter can match them (a React label is otherwise filtered
 * as an empty string), and the display name under `title` so ListView can
 * serialize the chosen option's label into the URL. The username is not
 * rendered, so a username match surfaces the user without explaining why.
 */
export const toUserSelectOption = (user: UserRecord) => {
  const textLabel = getUserDisplayLabel(user);
  return {
    value: user.id,
    label: SubjectSelectLabel({ label: textLabel, secondaryLabel: user.email }),
    title: textLabel,
    [SUBJECT_TEXT_LABEL_PROP]: textLabel,
    [SUBJECT_DETAIL_PROP]: user.email,
    username: user.username,
  };
};

export const createGroup = async (values: FormValues) => {
  await SupersetClient.post({
    endpoint: '/api/v1/security/groups/',
    jsonPayload: { ...values, users: values.users.map(user => user.value) },
  });
};

export const updateGroup = async (groupId: number, values: FormValues) => {
  await SupersetClient.put({
    endpoint: `/api/v1/security/groups/${groupId}`,
    jsonPayload: { ...values, users: values.users.map(user => user.value) },
  });
};

export const deleteGroup = async (groupId: number) =>
  SupersetClient.delete({
    endpoint: `/api/v1/security/groups/${groupId}`,
  });

export const fetchUserOptions = async (
  filterValue: string,
  page: number,
  pageSize: number,
  addDangerToast: (msg: string) => void,
) => {
  // The ListView filter path passes the raw input, so trim here to keep both
  // callers from sending a whitespace-only search.
  const searchTerm = filterValue.trim();
  const query = rison.encode({
    filters: searchTerm
      ? [{ col: 'username', opr: 'user_all_text', value: searchTerm }]
      : [],
    page,
    page_size: pageSize,
    order_column: 'username',
    order_direction: 'asc',
  });

  try {
    const response = await SupersetClient.get({
      endpoint: `/api/v1/security/users/?q=${query}`,
    });

    const results: UserRecord[] = response.json?.result || [];

    return {
      data: results.map(toUserSelectOption),
      totalCount: response.json?.count ?? 0,
    };
  } catch (error) {
    addDangerToast(t('There was an error while fetching users'));
    return { data: [], totalCount: 0 };
  }
};
