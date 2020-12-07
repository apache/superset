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
import { styled, logging } from '@superset-ui/core';

export type BackgroundPosition = 'top' | 'bottom';
interface ImageContainerProps {
  src: string;
  position: BackgroundPosition;
}

const ImageContainer = styled.div<ImageContainerProps>`
  background-image: url(${({ src }) => src});
  background-size: cover;
  background-position: center ${({ position }) => position};
  display: inline-block;
  height: calc(100% - 1px);
  width: calc(100% - 2px);
  margin: 1px 1px 0 1px;
`;
interface ImageLoaderProps
  extends React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  > {
  fallback: string;
  src: string;
  isLoading?: boolean;
  position: BackgroundPosition;
}

export default function ImageLoader({
  src,
  fallback,
  isLoading,
  position,
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
          logging.error(e);
          setImgSrc(fallback);
        });
    }

    return () => {
      // theres a very brief period where isLoading is false and this component is about to unmount
      // where the stale imgSrc is briefly rendered. Setting imgSrc to fallback smoothes the transition.
      setImgSrc(fallback);
    };
  }, [src, fallback]);

  return (
    <ImageContainer
      src={isLoading ? fallback : imgSrc}
      {...rest}
      position={position}
    />
  );
}
