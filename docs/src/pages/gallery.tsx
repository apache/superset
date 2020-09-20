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
import { useStaticQuery, graphql } from 'gatsby';
import Gallery from 'react-grid-gallery';
import Layout from '../components/layout';

const galleryStyle = css`
  margin-bottom: 25px;
  padding-top: 100px;
  padding-left: 50px;
  padding-right: 50px;
  text-align: center;
  .ReactGridGallery_tile-viewport {
    overflow: visible !important;
  }
  .ReactGridGallery img {
    box-shadow: 0px 0px 3px 1px #AAA;
  }
`;

// This defines the ordering of the images in the gallery
// and allows to add metadata to images.
const imageMeta = {
  'worldbank_dashboard.png': { caption: "World's Bank Dashboard" },
  'sqllab.png': { caption: 'SQL Lab' },
  'explore.png': { caption: 'Explore!' },
  'visualizations.png': { caption: 'Visualizations' },
  'chord_diagram.png': { caption: 'Explore' },
  'deck_scatter.png': { caption: 'Geospatial Scatterplot' },
  'deck_polygon.png': { caption: 'Geospatial Polygon' },
  'deck_arc.png': { caption: 'Geospatial Arc' },
  'deck_path.png': { caption: 'Geospatial Path' },
};

const GalleryPage = () => {
  const data = useStaticQuery(graphql`
    query {
      allImages: allFile(filter: {extension: {eq: "png"}, relativeDirectory: {regex: "/gallery/"}})  {
        edges {
          node {
            thumb: childImageSharp {
              fixed(height: 350) {
                ...GatsbyImageSharpFixed
                originalName
              }
            }
            full: childImageSharp {
              fixed(height: 1600) {
                ...GatsbyImageSharpFixed
                originalName
              }
            }
          }
        }
      }
    }
  `);
  const imagesMap = {};
  data.allImages.edges.map((img) => img.node).forEach((img) => {
    imagesMap[img.thumb.fixed.originalName] = {
      src: img.full.fixed.src,
      thumbnail: img.thumb.fixed.src,
      // caption: img.thumb.fixed.originalName,
    };
  });

  const augmentedImages = [];
  Object.keys(imageMeta).forEach((originalName) => {
    const img = imagesMap[originalName];
    delete imagesMap[originalName];
    augmentedImages.push({
      ...img,
      ...imageMeta[originalName],
    });
  });
  Object.values(imagesMap).forEach((img) => {
    augmentedImages.push(img);
  });
  return (
    <Layout>
      <div css={galleryStyle}>
        <Gallery
          images={augmentedImages}
          margin={10}
          rowHeight={200}
          enableImageSelection={false}
        />
      </div>
    </Layout>
  );
};
export default GalleryPage;
