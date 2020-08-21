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
import React, { useEffect } from 'react';

interface ImageLoaderProps
  extends React.DetailedHTMLProps<
    React.ImgHTMLAttributes<HTMLImageElement>,
    HTMLImageElement
  > {
  fallback: string;
  src: string;
  isLoading: boolean;
}

export default function ImageLoader({
  src,
  fallback,
  alt,
  isLoading,
  ...rest
}: ImageLoaderProps) {
  const [imgSrc, setImgSrc] = React.useState<string>(fallback);

  useEffect(() => {
    if (src) {
      fetch(src)
        .then(response => response.blob())
        .then(blob => {
          if (/image/.test(blob.type)) {
            const imgURL = URL.createObjectURL(blob);
            setImgSrc(imgURL);
          }
        })
        .catch(e => {
          console.error(e); // eslint-disable-line no-console
          setImgSrc(fallback);
        });
    }

    return () => {
      // theres a very brief period where isLoading is false and this component is about to unmount
      // where the stale imgSrc is briefly rendered. Setting imgSrc to fallback smoothes the transition.
      setImgSrc(fallback);
    };
  }, [src, fallback]);

  return <img alt={alt || ''} src={isLoading ? fallback : imgSrc} {...rest} />;
}
