import React, { useRef } from 'react';
import { theme, useConfig } from 'docz';
import { Link } from 'gatsby';
import { ThemeProvider } from 'theme-ui';
import { Button, Col, Carousel } from 'antd';
import { css } from '@emotion/core';
import { supersetTheme } from '@superset-ui/style';
import {
  BarChartOutlined,
  PieChartOutlined,
  DotChartOutlined,
  BoxPlotOutlined,
} from '@ant-design/icons';

import { Databases } from '../resources/data';
import Layout from '../components/layout';
import Image from '../components/image';
import 'antd/dist/antd.css';
import SEO from '../components/seo';
import logo from '../images/superset-logo-horiz-apache.svg';

const { colors } = supersetTheme;

const titleContainer = css`
  position: relative;
  text-align: center;
  padding-top: 131px;
  padding-bottom: 80px;
  background-image: url('/images/data-point.jpg');
  background-size: cover;
  Button {
    margin-top: 39px;
  }
  .logo-horiz {
    margin-top: 20px;
    margin-bottom: 20px;
  }
  .incubator {
    margin-top: 40px;
  }
  .alert {
    color: #0c5460;
    background-color: #d1ecf1;
    border-color: #bee5eb;
    max-width: 600px;
    margin: 0 auto;
    padding: 0.75rem 1.25rem;
    margin-top: 83px;
    border: 1px solid transparent;
    border-radius: 0.25rem;
  }
`;

const secondaryHeading = css`
  font-size: 55px;
  text-align: center;
`;

const featureHeight = '160';

const featureSectionStyle = css`
  background: #fff;
  padding: 5vw 0;
  margin-top: 0px;
  margin-bottom: 30px;
  .featureList {
    padding: 0px;
    width: 100%;
    list-style-type: none;
    margin: 0 auto;
    max-width: 1000px;
    margin-top: 40px;
    .feature {
      display: flex;
      margin: 10px;
      .imagePlaceHolder {
        display: block;
        position: relative;
        min-width: ${featureHeight}px;
        min-height: ${featureHeight}px;
        background: white;
        flex-grow: 1;
        svg {
          position: absolute;
          width: 60px;
          height: 60px;
          right: 10px;
          left: 72px;
          top: 35px;
        }
      }
      .featureText {
        display: block;
        padding-top: 30px;
        flex-grow: 6;
        font-size: 16px;
        color: ${colors.grayscale.dark2};
        line-height: 25px;
        strong {
          font-size: 18px;
        }
      }
    }
  }
  .heading {
    font-size: 25px;
    width: 60%;
    margin: 0 auto;
  }
`;

const integrationSection = css`
  background: white;
  margin-bottom: 150px;
  .databaseSub {
    text-align: center;
    display: block;
    margin-bottom: 40px;
  }

  .databaseList {
    margin-top: 100px;
    list-style-type: none;
    padding: 0px;
    max-width: 1000px;
    margin: 0 auto;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-around;
    margin-bottom: 50px;
    a {
      margin: 20px;
    }
  }
`;

const linkCarousel = css`
  .toggleContainer {
    display: flex;
    flex-direction: column;
    margin-bottom: 100px;
    .toggleBtns {
      display: flex;
      flex-direction: row;
      justify-content: center;
      .toggle {
        margin: 15px;
        color: #bfbfbf;
        border: 1px solid #bfbfbf;
        border-radius: 3px;
        padding: 30px;
        &:hover {
          cursor: pointer;
          color: ${colors.primary.base};
          border: 1px solid ${colors.primary.base};
        }
      }
    }
    .imageContainer {
      img {
        height: 400px;
        margin: 0 auto;
        box-shadow: 0 0 3px #aaa;
        margin-top: 5px;
        margin-bottom: 5px;
      }
    }
  }
`;

const Theme = () => {
  const config = useConfig();
  const slider = useRef(null);

  return (
    <ThemeProvider theme={config}>
      <SEO title="Superset" />
      <Layout>
        <div css={titleContainer}>
          <img width="600" className="logo-horiz" src={logo} alt="logo-horiz" />
          <h2>
            Apache Superset is a modern data
            {' '}
            <br />
            exploration and visualization platform
          </h2>
          <div className="incubator">
            <Image imageName="incubatorSm" />
          </div>
          <div>
            <Link to="/docs/intro">
              <Button type="primary" size="large">
                Get Started
              </Button>
            </Link>
          </div>
        </div>

        <div css={featureSectionStyle}>
          <h2 css={secondaryHeading}>Overview</h2>
          <h4 className="heading">
            {' '}
            Superset is fast, lightweight, intuitive, and loaded with options that make it easy for
            users of all skill sets to explore and visualize their data, from simple pie charts to
            highly detailed geospatial charts.
            {' '}
          </h4>
          <ul className="featureList ant-row">
            <Col span={12}>
              <li className="feature">
                <span className="imagePlaceHolder">
                  {' '}
                  <PieChartOutlined />
                  {' '}
                </span>
                <span className="featureText">
                  <strong>Powerful and easy to use </strong>
                  <br />
                  Quickly and easily integrate and explore your data, using either our simple
                  no-code viz builder or state of the art SQL IDE.
                </span>
              </li>

              <li className="feature">
                <span className="imagePlaceHolder">
                  {' '}
                  <BoxPlotOutlined />
                  {' '}
                </span>
                <span className="featureText">
                  <strong> Integrates with modern databases</strong>
                  <br />
                  {' '}
                  Superset can connect to any SQL based datasource through SQL Alchemy,
                  including modern cloud native data sources and engines at petabyte scale.
                </span>
              </li>
            </Col>

            <Col span={12}>
              <li className="feature">
                <span className="imagePlaceHolder">
                  {' '}
                  <BarChartOutlined />
                  {' '}
                </span>
                <span className="featureText">
                  <strong> Modern architecture </strong>
                  <br />
                  Superset is lightweight and highly scalable, leveraging the power of your existing
                  data infrastructure without requiring yet another ingestion layer.
                </span>
              </li>
              <li className="feature">
                <span className="imagePlaceHolder">
                  {' '}
                  <DotChartOutlined />
                  {' '}
                </span>
                <span className="featureText">
                  <strong> Rich visualizations and dashboards </strong>
                  {' '}
                  <br />
                  Superset ships with a wide array of beautiful visualizations. Our visualization
                  plug-in architecture makes it easy to build custom visualizations that drop
                  directly into Superset.
                </span>
              </li>
            </Col>
          </ul>
        </div>

        <div css={linkCarousel}>
          <h2 css={secondaryHeading}>Explore</h2>
          <div className="toggleContainer">
            <div className="toggleBtns">
              <div className="toggle" onClick={() => slider.current.goTo(0)} role="button">
                <h3>Explore</h3>
                <span>Explore your data using the array of data visualizations.</span>
              </div>

              <div className="toggle" onClick={() => slider.current.goTo(1)} role="button">
                <h3>View</h3>
                <span>View your data through interactive dashboards</span>
              </div>
              <div className="toggle" onClick={() => slider.current.goTo(2)} role="button">
                <h3>Investigate</h3>
                <span>Use sqlab to write queries to explore your data</span>
              </div>
            </div>
            <Carousel ref={slider} effect="scrollx">
              <div className="imageContainer">
                <img src="/images/pie-chart.png" alt="" />
              </div>
              <div className="imageContainer">
                <img src="/images/google-analytics.png" alt="" />
              </div>
              <div className="imageContainer">
                <img src="/images/sqllab.png" alt="" />
              </div>
            </Carousel>
          </div>
        </div>
        <div css={integrationSection}>
          <h2 css={secondaryHeading}>Supported Data Sources</h2>

          <ul className="databaseList">
            {Databases.map(({
              title, href, imgName: imageName, width, height,
            }) => (
              <a href={href} target="_blank" key={imageName} rel="noreferrer">
                <Image {...{
                  imageName, type: 'db', width, height, alt: title,
                }}
                />
              </a>
            ))}
          </ul>
          <span className="databaseSub">
            {' '}
            ... and any other SQLAlchemy
            {' '}
            <a href="https://superset.incubator.apache.org/installation.html#database-dependencies">
              {' '}
              compatible data source.
              {' '}
            </a>
            {' '}
          </span>
        </div>
      </Layout>
    </ThemeProvider>
  );
};

// @ts-ignore
export default theme()(Theme);
