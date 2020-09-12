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
import { useStaticQuery, graphql } from 'gatsby';
import Img from 'gatsby-image';

interface Props {
  imageName?: string;
  type?: string;
  width?: string;
  height?: string;
  otherProps?: any;
}

const Image = ({
  imageName, type, width, height, ...otherProps
}: Props) => {
  const data = useStaticQuery(graphql`
    query {
      logoSm: file(relativePath: { eq: "src/images/s.png" }) {
        childImageSharp {
          fixed(height: 30) {
            ...GatsbyImageSharpFixed
          }
        }
      }

      logoLg: file(relativePath: { eq: "src/images/s.png" }) {
        childImageSharp {
          fixed(width: 150) {
            ...GatsbyImageSharpFixed
          }
        }
      }

      incubatorSm: file(relativePath: { eq: "src/images/incubator.png" }) {
        childImageSharp {
          fixed(width: 300) {
            ...GatsbyImageSharpFixed
          }
        }
      }

      stackoverflow: file(
        relativePath: { eq: "src/images/stack_overflow.png" }
      ) {
        childImageSharp {
          fixed(width: 60) {
            ...GatsbyImageSharpFixed
          }
        }
      }

      docker: file(relativePath: { eq: "src/images/docker.png" }) {
        childImageSharp {
          fixed(width: 100) {
            ...GatsbyImageSharpFixed
          }
        }
      }

      preset: file(relativePath: { eq: "src/images/preset.png" }) {
        childImageSharp {
          fixed(width: 100) {
            ...GatsbyImageSharpFixed
          }
        }
      }

      getAllImages: allImageSharp {
        edges {
          node {
            fixed(height: 70) {
              ...GatsbyImageSharpFixed
              originalName
            }
          }
        }
      }
    }
  `);

  const filter = data.getAllImages.edges.filter(
    (n) => n.node.fixed.originalName === imageName,
  );
  const imgStyle = width && height ? { width, height } : {};

  return type === 'db' ? (
    <Img fixed={filter[0]?.node?.fixed} style={imgStyle} imgStyle={imgStyle} />
  ) : (
    <Img fixed={data[imageName]?.childImageSharp?.fixed} {...otherProps} />
  );
};

export default Image;
