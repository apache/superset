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
            <a href="https://hub.docker.com/r/preset/superset/" target="_blank" rel="noreferrer">
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
              <img src="/images/youtube.png" alt="youtube" className="youtube" />
            </div>
            <a href="https://www.youtube.com/channel/UCMuwrvBsg_jjI2gLcm04R0g" target="_blank" rel="noreferrer">
              <Button type="primary">Youtube Page</Button>
            </a>
          </div>
        </div>
        <div className="videos">
          <iframe
            width="560"
            height="315"
            src="https://www.youtube.com/embed/Mhai7sVU244"
            frameBorder="0"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          <iframe
            width="560"
            height="315"
            src="https://www.youtube.com/embed/24XDOkGJrEY"
            frameBorder="0"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          <iframe
            width="560"
            height="315"
            src="https://www.youtube.com/embed/NC9ehDUUu2o"
            frameBorder="0"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          <iframe
            width="560"
            height="315"
            src="https://www.youtube.com/embed/hLnDZcewogE"
            frameBorder="0"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          <iframe
            width="560"
            height="315"
            src="https://www.youtube.com/embed/W_Sp4jo1ACg"
            frameBorder="0"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  </Layout>
);

export default Resources;
