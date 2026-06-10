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
import { sanitizeUrl } from '@braintree/sanitize-url';
import { AnchorHTMLAttributes } from 'react';
import { Link } from '@tanstack/react-router';
import { parseSearch } from 'src/router/searchParams';
import { isUrlExternal, parseUrl } from 'src/utils/urlUtils';

export type GenericLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'href'
> & {
  to: string;
  replace?: boolean;
};

export const GenericLink = ({
  to: rawTo,
  replace,
  children,
  ...rest
}: GenericLinkProps) => {
  // Callers may pass undefined at runtime (e.g. backend rows without a URL).
  const to = typeof rawTo === 'string' ? rawTo : '';
  if (to && isUrlExternal(to)) {
    return (
      <a data-test="external-link" href={sanitizeUrl(parseUrl(to))} {...rest}>
        {children}
      </a>
    );
  }
  const hashIndex = to.indexOf('#');
  const hash = hashIndex === -1 ? undefined : to.slice(hashIndex + 1);
  const withoutHash = hashIndex === -1 ? to : to.slice(0, hashIndex);
  const searchIndex = withoutHash.indexOf('?');
  const pathname =
    searchIndex === -1 ? withoutHash : withoutHash.slice(0, searchIndex);
  const searchStr =
    searchIndex === -1 ? '' : withoutHash.slice(searchIndex + 1);
  return (
    <Link
      data-test="internal-link"
      to={pathname}
      search={searchStr ? parseSearch(searchStr) : undefined}
      hash={hash}
      replace={replace}
      {...rest}
    >
      {children}
    </Link>
  );
};
