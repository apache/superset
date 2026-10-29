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

import React from 'react';
import { ThemedComponent } from '@docusaurus/theme-common';
import useBaseUrl from '@docusaurus/useBaseUrl';

interface DatabaseLogoProps extends Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  'src'
> {
  logo: string;
  logoDark?: string;
  alt: string;
}

export default function DatabaseLogo({
  logo,
  logoDark,
  alt,
  className,
  style,
  ...props
}: DatabaseLogoProps): React.JSX.Element {
  const light = useBaseUrl(`/img/databases/${logo}`);
  const dark = useBaseUrl(`/img/databases/${logoDark || logo}`);

  return (
    <ThemedComponent className={className}>
      {({ theme, className: themedClassName }) => (
        <img
          {...props}
          src={theme === 'dark' ? dark : light}
          alt={alt}
          className={themedClassName}
          style={{
            ...(theme === 'dark' && !logoDark
              ? { backgroundColor: '#fff', borderRadius: 4, padding: 4 }
              : {}),
            ...style,
          }}
        />
      )}
    </ThemedComponent>
  );
}
