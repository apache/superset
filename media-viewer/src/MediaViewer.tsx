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
import React, {createRef, useState} from 'react';
import { styled } from '@superset-ui/core';
import { MediaViewerProps, MediaViewerStylesProps } from './types';
import { Image } from 'antd';

const Styles = styled.div<MediaViewerStylesProps>`
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  border-radius: ${({ theme }) => theme.gridUnit * 2}px;
  height: 100%;
  width: 100%;
`;

const contentStyle: React.CSSProperties = {
  height: '100%',
  width: '100%',
};

export default function MediaViewer(props: MediaViewerProps) {
  const [visible, setVisible] = useState(false);

  const [images, setImages] = useState(
    [
      'https://www.manualise.com/wp-content/uploads/2017/05/Technisch_Tekening_Kap.jpg',
      'https://2.bp.blogspot.com/-LIP0gu8erlE/U6WVhfNUyEI/AAAAAAAAAJU/S-7APRNQreg/s1600/afstandsbediening-bovenkant1.jpg',
      'https://www.techniekwebshop.nl/images/catalog/product/cache/1/image/1000x/9df78eab33525d08d6e5fb8d27136e95/g/r/grp72878_/reservoir-d2.jpg',
    ]
  );
  const rootElem = createRef<HTMLDivElement>();

  return (
    <Styles
      ref={rootElem}
    >
      <Image.PreviewGroup preview={{ visible, onVisibleChange: vis => setVisible(vis) }}>
        {images.map(src => (
          <Image style={ src !== images[0] ? { display: 'none' } : { display: 'block', objectFit: 'contain', ...contentStyle }}
                 key={src} src={src} />
        ))}
      </Image.PreviewGroup>
    </Styles>
  );
}
