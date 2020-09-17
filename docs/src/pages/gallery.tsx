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
import { css } from '@emotion/core';
import { Card, List } from 'antd';
import { GithubOutlined } from '@ant-design/icons';
import SEO from '../components/seo';
import Layout from '../components/layout';
import { pmc } from '../resources/data';
import Gallery from 'react-grid-gallery';

const IMG_URL_BASE = 'https://raw.githubusercontent.com/apache/incubator-superset/master/superset-frontend/images/screenshots/';

const IMAGES = [
{
  src: IMG_URL_BASE + 'bank_dash.png',
  thumbnail: IMG_URL_BASE + 'bank_dash.png',
  caption: 'Dashboard',
},
{
  src: '/images/explorer.png',
},
{
  src: IMG_URL_BASE + 'sqllab.png',
  thumbnail: IMG_URL_BASE + 'sqllab.png',
},
{
  src: IMG_URL_BASE + 'deckgl_dash.png',
  thumbnail: IMG_URL_BASE + 'deckgl_dash.png',
},
{
  src: IMG_URL_BASE + 'visualizations.png',
  thumbnail: IMG_URL_BASE + 'visualizations.png',
},
{
  src: '/images/gallery/deck_scatter.png',
},
];

const enhancedImages = IMAGES.map(img => {
  img.thumbnail = img.thumbnail || img.src;
  return img;
});
const galleryStyle = css`
  padding-top: 100px;
  margin-bottom: 25px;
  //width: 1200px;
  //margin: 0 auto;
  text-align: center;
  .ReactGridGallery img {
    border: 1px solid #AAA;
    //box-shadow: 0px 0px 2px 10px black;
  }
`;

const GalleryPage = () => (
  <Layout>
      <div css={galleryStyle}>
        <Gallery
          images={[...enhancedImages, ...enhancedImages]}
          margin={10}
          rowHeight={250}
          enableImageSelection={false}
        />
      </div>
  </Layout>
);

export default GalleryPage;
