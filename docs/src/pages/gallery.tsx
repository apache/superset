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
import { useStaticQuery, graphql } from 'gatsby';
import { GithubOutlined } from '@ant-design/icons';
import SEO from '../components/seo';
import Layout from '../components/layout';
import { pmc } from '../resources/data';
import Gallery from 'react-grid-gallery';

const galleryStyle = css`
  padding-top: 100px;
  margin-bottom: 25px;
  padding-left: 50px;
  padding-right: 50px;
  text-align: center;
  .ReactGridGallery img {
    border: 1px solid #AAA;
    //box-shadow: 0px 0px 2px 10px black;
  }
`;

const GalleryPage = () => {
  const data = useStaticQuery(graphql`
    query {
      allImages: allFile(filter: {relativeDirectory: {eq: "src/images/gallery"}}) {
        edges {
          node {
            thumb: childImageSharp {
              fixed(height: 400) {
                ...GatsbyImageSharpFixed
                originalName
              }
            }
            full: childImageSharp {
              fixed(height: 1200) {
                ...GatsbyImageSharpFixed
                originalName
              }
            }
          }
        }
      }
    }
  `);
  console.log(data.allImages.edges);
  const images = data.allImages.edges.map(img => img.node).filter(o => o).map(img => ({
    src: img.full.fixed.src,
    thumbnail: img.thumb.fixed.src,
    caption: 'Dashboard',
  }));
  console.log("IMAG", images);
  return (
    <Layout>
        <div css={galleryStyle}>
          <Gallery
            images={[...images]}
            margin={10}
            rowHeight={250}
            enableImageSelection={false}
          />
        </div>
    </Layout>);
};
export default GalleryPage;
