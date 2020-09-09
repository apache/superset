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
import { Button } from 'antd';
import SEO from '../components/seo';
import Image from '../components/image';
import Layout from '../components/layout';

const resourcesContainer = css`
  background: #fff;
  .links {
    margin-top: 80px;
    .resourcesLinks {
      display: flex;
      height: 400px;
      flex-direction: row;
      justify-content: center;
      text-align: center;
      .link {
        margin: 25px;
        width: 189px;
        position: relative;
        font-size: 16px;
        flex-direction: column;
        border: solid 1px #cbcbcb;
        border-radius: 5px;
        padding: 45px 36px;
        height: 50%;
        &:hover{
          border-color: #1fa8c9;;
          cursor: pointer;
        }
        .youtube {
          width: 94px;
          height: 24px;
          margin-bottom: 40px;
        }
        .preset {
          margin-top: -13px;
          margin-bottom: -10px;
        }
      }
        a {
          display: block;
          margin-bottom: 50px;
        }
        .gatsby-image-wrapper {
          display: block !important;
          margin-bottom: 40px;
        }
      }
    }
  }
  .videos {
    text-align: center;
    iframe {
      margin: 15px;
    }
  }
`;

const title = css`
  margin-top: 150px;
  text-align: center;
  font-size: 60px;
`;

const Resources = () => (
  <Layout>
    <SEO title="Resources" />
    <div css={resourcesContainer}>
      <h1 css={title}>Resources</h1>
      <div className="links">
        <div className="resourcesLinks">
          <div className="link">
            <div>
              <Image imageName="docker" />
            </div>
            <a
              href="https://hub.docker.com/r/preset/superset/"
              target="_blank"
              rel="noreferrer"
            >
              <Button type="primary">Docker Image</Button>
            </a>
          </div>
          <div className="link">
            <div className="preset">
              <Image imageName="preset" />
            </div>
            <a href="https://preset.io/blog/" target="_blank" rel="noreferrer">
              <Button type="primary">Preset Blog</Button>
            </a>
          </div>
          <div className="link">
            <div>
              <img
                src="/images/youtube.png"
                alt="youtube"
                className="youtube"
              />
            </div>
            <a
              href="https://www.youtube.com/channel/UCMuwrvBsg_jjI2gLcm04R0g"
              target="_blank"
              rel="noreferrer"
            >
              <Button type="primary">Youtube Page</Button>
            </a>
          </div>
        </div>
        <div className="videos">
          <iframe
            width="560"
            height="315"
            src="https://www.youtube.com/embed/24XDOkGJrEY"
            frameBorder="0"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          <iframe width="560" height="315" src="https://www.youtube.com/embed/AqousXQ7YHw" frameBorder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          <iframe width="560" height="315" src="https://www.youtube.com/embed/JGeIHrQYhIs" frameBorder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          <iframe width="560" height="315" src="https://www.youtube.com/embed/z350Gbi463I" frameBorder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      </div>
    </div>
  </Layout>
);

export default Resources;
