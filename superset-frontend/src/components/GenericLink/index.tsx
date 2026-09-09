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
import { forwardRef, PropsWithoutRef, Ref, RefAttributes } from 'react';
import { Link, LinkProps } from 'react-router-dom';
import { isUrlExternal, parseUrl } from 'src/utils/urlUtils';

type GenericLinkProps<S> = PropsWithoutRef<LinkProps<S>> &
  RefAttributes<HTMLAnchorElement>;

const GenericLinkInner = <S,>(
  { to, component, replace, innerRef, children, ...rest }: GenericLinkProps<S>,
  ref: Ref<HTMLAnchorElement>,
) => {
  if (typeof to === 'string' && isUrlExternal(to)) {
    return (
      <a
        ref={ref}
        data-test="external-link"
        href={sanitizeUrl(parseUrl(to))}
        {...rest}
      >
        {children}
      </a>
    );
  }
  return (
    <Link
      data-test="internal-link"
      to={to}
      component={component}
      replace={replace}
      innerRef={innerRef ?? ref}
      {...rest}
    >
      {children}
    </Link>
  );
};

export const GenericLink = forwardRef(GenericLinkInner) as <S>(
  props: GenericLinkProps<S> & { ref?: Ref<HTMLAnchorElement> },
) => ReturnType<typeof GenericLinkInner>;
