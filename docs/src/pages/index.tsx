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
import { useRef, useState, useEffect, JSX } from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import { Card, Carousel, Flex } from 'antd';
import styled from '@emotion/styled';
import GitHubButton from 'react-github-btn';
import { mq } from '../utils';
import SectionHeader from '../components/SectionHeader';
import databaseData from '../data/databases.json';
import BlurredSection from '../components/BlurredSection';
import DataSet from '../../../RESOURCES/INTHEWILD.yaml';
import type { DatabaseData } from '../components/databases/types';
import '../styles/main.css';

// Build database list from databases.json (databases with logos)
// Deduplicate by logo filename to avoid showing the same logo twice
const typedDatabaseData = databaseData as DatabaseData;
const seenLogos = new Set<string>();
const Databases = Object.entries(typedDatabaseData.databases)
  .filter(([, db]) => db.documentation?.logo && db.documentation?.homepage_url)
  .map(([name, db]) => ({
    title: name,
    href: db.documentation?.homepage_url,
    imgName: db.documentation?.logo,
    docPath: `/docs/databases/supported/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
  }))
  .sort((a, b) => a.title.localeCompare(b.title))
  .filter((db) => {
    if (seenLogos.has(db.imgName!)) return false;
    seenLogos.add(db.imgName!);
    return true;
  });

interface Organization {
  name: string;
  url: string;
  logo?: string;
}

interface DataSetType {
  categories: Record<string, Organization[]>;
}

const typedDataSet = DataSet as DataSetType;

// Extract all organizations with logos for the carousel
const companiesWithLogos = Object.values(typedDataSet.categories)
  .flat()
  .filter((org) => org.logo?.trim());

// Fisher-Yates shuffle for fair randomization
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const features = [
  {
    image: 'powerful-yet-easy.jpg',
    title: 'Powerful yet easy to use',
    description:
      'Superset makes it easy to explore your data, using either our simple no-code viz builder or state-of-the-art SQL IDE.',
  },
  {
    image: 'modern-databases.jpg',
    title: 'Integrates with modern databases',
    description:
      'Superset can connect to any SQL-based databases including modern cloud-native databases and engines at petabyte scale.',
  },
  {
    image: 'modern-architecture.jpg',
    title: 'Modern architecture',
    description:
      'Superset is lightweight and highly scalable, leveraging the power of your existing data infrastructure without requiring yet another ingestion layer.',
  },
  {
    image: 'rich-visualizations.jpg',
    title: 'Rich visualizations and dashboards',
    description:
      'Superset ships with 40+ pre-installed visualization types. Our plug-in architecture makes it easy to build custom visualizations.',
  },
];

const docSections = [
  {
    title: 'User Guide',
    description:
      'For analysts and business users. Learn to explore data, build charts, create dashboards, and connect to databases.',
    cta: 'Browse User Docs',
    href: '/user-docs/',
    accent: '#20a7c9',
  },
  {
    title: 'Administrator Guide',
    description:
      'For teams installing and operating Superset. Covers installation, configuration, security, and database drivers.',
    cta: 'Browse Admin Docs',
    href: '/admin-docs/',
    accent: '#457f8d',
  },
  {
    title: 'Developer Guide',
    description:
      'For contributors and engineers building on Superset. Covers the REST API, extensions, and contributing workflows.',
    cta: 'Browse Developer Docs',
    href: '/developer-docs/',
    accent: '#2d6a4f',
  },
  {
    title: 'Community',
    description:
      'Join the Superset community. Find resources on Slack, GitHub, the mailing list, and upcoming meetups.',
    cta: 'Join the Community',
    href: '/community',
    accent: '#6d4c7e',
  },
];

const StyledMain = styled('main')`
  text-align: center;
`;

const StyledTitleContainer = styled('div')`
  position: relative;
  padding: 130px 20px 20px;
  margin-bottom: 0;
  background-image: url('/img/grid-background.jpg');
  background-size: cover;
  .info-container {
    position: relative;
    z-index: 4;
  }
  .superset-mark {
    ${mq[1]} {
      width: 140px;
    }
  }
  .info-text {
    font-size: 30px;
    line-height: 37px;
    max-width: 720px;
    margin: 24px auto 10px;
    color: var(--ifm-font-base-color-inverse);
    ${mq[1]} {
      font-size: 25px;
      line-height: 30px;
    }
  }
  .github-section {
    margin-top: 9px;
    ${mq[1]} {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .github-button {
      margin: 5px;
      ${mq[1]} {
        transform: scale(1.25);
        margin: 8px;
        &:first-of-type {
          margin-top: 5px;
        }
        &:last-of-type {
          margin-bottom: 5px;
        }
      }
    }
  }
`;

const StyledButton = styled(Link)`
  border-radius: 10px;
  font-size: 20px;
  font-weight: bold;
  width: 170px;
  padding: 10px 0;
  margin: 15px auto 0;
  ${mq[1]} {
    font-size: 19px;
    width: 175px;
    padding: 10px 0;
  }
`;

const StyledScreenshotContainer = styled('div')`
  position: relative;
  display: inline-block;
  padding-top: 30px;
  margin-top: 25px;
  margin-bottom: -125px;
  max-width: 800px;
  ${mq[1]} {
    padding-top: 20px;
  }
  .screenshot {
    position: relative;
    z-index: 3;
    border-radius: 10px;
  }
  .screenshot-shadow-1 {
    position: absolute;
    top: 15px;
    left: 20px;
    width: calc(100% - 40px);
    height: calc(100% - 15px);
    background-color: #256b7c;
    border-radius: 10px;
    z-index: 2;
    ${mq[1]} {
      background-color: #335a64;
      top: 10px;
      left: 15px;
      width: calc(100% - 30px);
      height: calc(100% - 10px);
    }
  }
  .screenshot-shadow-2 {
    position: absolute;
    top: 0;
    left: 40px;
    width: calc(100% - 80px);
    height: 100%;
    background-color: #0d5262;
    border-radius: 10px;
    z-index: 1;
    ${mq[1]} {
      background-color: #1f4048;
      left: 30px;
      width: calc(100% - 60px);
    }
  }
  .screenshotBlur {
    display: none;
    background-color: #173036;
    filter: blur(45px);
    position: absolute;
    bottom: 0;
    left: 50%;
    width: 100%;
    padding-top: 100%;
    border-radius: 50%;
    transform: translate3d(-50%, 0, 0);
    opacity: 0.3;
    ${mq[1]} {
      display: block;
    }
  }
`;

const StyledFeaturesList = styled('ul')`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  width: 100%;
  max-width: 1170px;
  margin: 15px auto 0;
  padding: 0 20px;
  ${mq[1]} {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }
  .item {
    text-align: left;
    border: 1px solid var(--ifm-border-color);
    border-radius: 10px;
    overflow: hidden;
    display: flex;
    align-items: flex-start;
    padding: 20px;
    ${mq[1]} {
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 35px;
    }
    .image {
      flex-shrink: 0;
      margin-right: 20px;
      width: 140px;
      text-align: center;
      ${mq[1]} {
        width: 115px;
      }
    }
    .title {
      font-size: 24px;
      margin: 10px 0 0;
      ${mq[1]} {
        font-size: 23px;
        margin-top: 20px;
      }
    }
    .description {
      font-size: 17px;
      line-height: 23px;
      margin: 5px 0 0;
      ${mq[1]} {
        font-size: 16px;
        margin-top: 10px;
      }
    }
  }
`;

interface StyledDocSectionCardProps {
  accent: string;
}

const StyledDocSectionsHeader = styled('div')`
  & > div {
    max-width: 960px;
  }
`;

const StyledDocSectionsGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 20px;
  max-width: 1170px;
  width: 100%;
  margin: 30px auto 0;
  padding: 0 20px 10px;
  ${mq[2]} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  ${mq[0]} {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }
`;

const StyledDocSectionCard = styled(Link)<StyledDocSectionCardProps>`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  border: 1px solid var(--ifm-border-color);
  border-top: 4px solid ${({ accent }) => accent};
  border-radius: 10px;
  padding: 24px;
  text-decoration: none;
  color: var(--ifm-font-base-color);
  background: transparent;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
    text-decoration: none;
    color: var(--ifm-font-base-color);
  }
  .card-title {
    font-size: 20px;
    font-weight: 700;
    margin: 0 0 8px;
    color: var(--ifm-font-base-color);
  }
  .card-description {
    font-size: 15px;
    line-height: 22px;
    margin: 0 0 16px;
    color: var(--ifm-font-base-color);
    flex: 1;
  }
  .card-cta {
    font-size: 14px;
    font-weight: 700;
    color: ${({ accent }) => accent};
    margin: 0;
  }
  ${mq[1]} {
    padding: 20px;
    .card-title {
      font-size: 18px;
    }
    .card-description {
      font-size: 14px;
    }
  }
`;

const StyledSliderSection = styled('div')`
  position: relative;
  padding: 60px 20px;
  ${mq[1]} {
    padding-top: 0;
    padding-bottom: 50px;
  }
  &::before {
    content: '';
    display: block;
    width: 100%;
    height: calc(100% - 320px);
    position: absolute;
    top: 0;
    left: 0;
    background-image: url('/img/grid-background.jpg');
    background-size: cover;
    z-index: -1;
    ${mq[1]} {
      height: 100%;
    }
  }
  .toggleBtns {
    display: flex;
    justify-content: space-between;
    list-style: none;
    max-width: 870px;
    width: 100%;
    margin: 0 auto 20px;
    padding: 0;
    ${mq[1]} {
      flex-direction: column;
      text-align: left;
      max-width: 140px;
      gap: 10px;
      margin-top: 15px;
      margin-bottom: 40px;
    }
    .toggle {
      font-size: 24px;
      color: #b4c0c7;
      position: relative;
      padding-left: 32px;
      cursor: pointer;
      ${mq[1]} {
        font-size: 17px;
        font-weight: bold;
        padding-left: 22px;
      }
      &::before {
        content: '';
        display: block;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background-color: #457f8d;
        position: absolute;
        top: 50%;
        left: 0;
        transform: translate3d(0, -50%, 0);
        ${mq[1]} {
          width: 8px;
          height: 8px;
        }
      }
      &.active {
        font-weight: 700;
        color: var(--ifm-font-base-color-inverse);
      }
      &.active::before {
        background-color: var(--ifm-color-primary);
      }
    }
  }
  .slide {
    max-width: 920px;
    & > p {
      max-width: 560px;
      margin: 0 auto;
      font-size: 24px;
      line-height: 32px;
      color: var(--ifm-font-base-color-inverse);
      margin-bottom: 45px;
      ${mq[1]} {
        font-size: 17px;
        line-height: 23px;
      }
    }
  }
  video {
    width: 100%;
    max-width: 920px;
    margin-top: 10px;
    border-radius: 10px;
    ${mq[1]} {
      border-radius: 5px;
    }
  }
`;

const StyledKeyFeatures = styled('div')`
  margin-top: 50px;
  & > h3 {
    font-size: 30px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 30px;
    max-width: 960px;
    margin: 30px auto 0;
    padding: 0 20px;
    text-align: left;
    ${mq[1]} {
      grid-template-columns: repeat(1, minmax(0, 1fr));
    }
    & > .item {
      display: flex;
      font-size: 17px;
      ${mq[1]} {
        font-size: 15px;
      }
      & > img {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
        margin-right: 12px;
        margin-top: 4px;
        ${mq[1]} {
          width: 18px;
          height: 18px;
          margin-top: 2px;
        }
      }
    }
  }
  .row {
    display: flex;
    max-width: 960px;
    margin: 30px auto 0;
    & > .column {
      width: 50%;
      & > ul {
        font-size: 17px;
        list-style: none;
        padding: 0 20px;
        text-align: left;
        margin: 0;
        & > li {
          display: flex;
          margin-bottom: 20px;
          & > img {
            width: 20px;
            height: 20px;
            flex-shrink: 0;
            margin-right: 12px;
            margin-top: 4px;
          }
        }
      }
    }
  }
`;

const StyledIntegrations = styled('div')`
  padding: 0 20px;
  .database-grid {
    display: grid;
    grid-template-columns: repeat(8, minmax(0, 1fr));
    gap: 10px;
    max-width: 1200px;
    margin: 25px auto 0;
    ${mq[1]} {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }
    ${mq[0]} {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    & > .item {
      border: 1px solid var(--ifm-border-color);
      border-radius: 8px;
      overflow: hidden;
      height: 80px;
      padding: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      & > a {
        height: 100%;
      }
      & img {
        height: 100%;
        object-fit: contain;
      }
    }
  }
  .database-sub {
    display: block;
    text-align: center;
    font-size: 17px;
    margin-top: 50px;
  }
`;

export default function Home(): JSX.Element {
  const slider = useRef(null);

  const [slideIndex, setSlideIndex] = useState(0);
  const [shuffledCompanies, setShuffledCompanies] = useState(companiesWithLogos);

  const onChange = (current, next) => {
    setSlideIndex(next);
  };

  const changeToDark = () => {
    const navbar = document.body.querySelector('.navbar');
    const logo = document.body.querySelector('.navbar__logo img');
    if (navbar) {
      navbar.classList.add('navbar--dark');
    }
    if (logo) {
      logo.setAttribute('src', '/img/superset-logo-horiz-dark.svg');
    }
  };

  const changeToLight = () => {
    const navbar = document.body.querySelector('.navbar');
    const logo = document.body.querySelector('.navbar__logo img');
    if (navbar) {
      navbar.classList.remove('navbar--dark');
    }
    if (logo) {
      logo.setAttribute('src', '/img/superset-logo-horiz.svg');
    }
  };

  // Shuffle companies on mount for fair rotation
  useEffect(() => {
    setShuffledCompanies(shuffleArray(companiesWithLogos));
  }, []);

  // Set up dark <-> light navbar change
  useEffect(() => {
    changeToDark();

    const navbarToggle = document.body.querySelector('.navbar__toggle');
    if (navbarToggle) {
      navbarToggle.addEventListener('click', () => changeToLight());
    }

    const scrollListener = () => {
      if (window.scrollY > 0) {
        changeToLight();
      } else {
        changeToDark();
      }
    };

    window.addEventListener('scroll', scrollListener);

    return () => {
      window.removeEventListener('scroll', scrollListener);
      changeToLight();
    };
  }, []);

  return (
    <Layout
      title="Welcome"
      description="Community website for Apache Superset™, a data visualization and data exploration platform"
      wrapperClassName="under-navbar"
    >
      <StyledMain>
        <StyledTitleContainer>
          <div className="info-container">
            <img
              className="superset-mark"
              src="/img/superset-mark-dark.svg"
              alt="Superset mark"
            />
            <div className="info-text">
              Apache Superset&trade; is an open-source modern data exploration
              and visualization platform.
            </div>
            <img src="/img/community/line.png" alt="line" />
            <div className="github-section">
              <span className="github-button">
                <GitHubButton
                  href="https://github.com/apache/superset"
                  data-size="large"
                  data-show-count="true"
                  aria-label="Star apache/superset on GitHub"
                >
                  Star
                </GitHubButton>
              </span>
              <span className="github-button">
                <GitHubButton
                  href="https://github.com/apache/superset/subscription"
                  data-size="large"
                  data-show-count="true"
                  aria-label="Watch apache/superset on GitHub"
                >
                  Watch
                </GitHubButton>
              </span>
              <span className="github-button">
                <GitHubButton
                  href="https://github.com/apache/superset/fork"
                  data-size="large"
                  data-show-count="true"
                  aria-label="Fork apache/superset on GitHub"
                >
                  Fork
                </GitHubButton>
              </span>
            </div>
            <img src="/img/community/line.png" alt="line" />
            <StyledButton className="default-button-theme" href="/docs/intro">
              Get Started
            </StyledButton>
          </div>
          <StyledScreenshotContainer>
            <img
              className="screenshot"
              src="/img/hero-screenshot.jpg"
              alt="hero-screenshot"
            />
            <div className="screenshot-shadow-1"></div>
            <div className="screenshot-shadow-2"></div>
            <div className="screenshotBlur"></div>
          </StyledScreenshotContainer>
        </StyledTitleContainer>
        <BlurredSection>
          <StyledDocSectionsHeader>
            <SectionHeader
              level="h2"
              title="Find your documentation"
              subtitle="Whether you're exploring data, managing a deployment, building an integration, or joining the community — here's where to get started."
            />
          </StyledDocSectionsHeader>
          <StyledDocSectionsGrid>
            {docSections.map(({ title, description, cta, href, accent }) => (
              <StyledDocSectionCard key={title} to={href} accent={accent}>
                <h3 className="card-title">{title}</h3>
                <p className="card-description">{description}</p>
                <span className="card-cta">{cta} →</span>
              </StyledDocSectionCard>
            ))}
          </StyledDocSectionsGrid>
        </BlurredSection>
        <BlurredSection>
          <SectionHeader
            level="h2"
            title="Overview"
            subtitle="Superset is fast, lightweight, intuitive, and loaded with options that make it easy for users of all skill sets to explore and visualize their data, from simple line charts to highly detailed geospatial charts."
          />
          <StyledFeaturesList>
            {features.map(({ image, title, description }) => (
              <li className="item" key={title}>
                <div className="image">
                  <img src={`/img/features/${image}`} />
                </div>
                <div className="content">
                  <h4 className="title">{title}</h4>
                  <p className="description">{description}</p>
                </div>
              </li>
            ))}
          </StyledFeaturesList>
        </BlurredSection>
        <BlurredSection>
          <StyledSliderSection>
            <SectionHeader
              level="h2"
              title="Self-serve analytics for anyone"
              dark
            />
            <ul className="toggleBtns">
              <li
                className={`toggle ${slideIndex === 0 ? 'active' : null}`}
                onClick={() => slider.current.goTo(0)}
                role="button"
              >
                Dashboards
              </li>
              <li
                className={`toggle ${slideIndex === 1 ? 'active' : null}`}
                onClick={() => slider.current.goTo(1)}
                role="button"
              >
                Chart Builder
              </li>
              <li
                className={`toggle ${slideIndex === 2 ? 'active' : null}`}
                onClick={() => slider.current.goTo(2)}
                role="button"
              >
                SQL Lab
              </li>
              <li
                className={`toggle ${slideIndex === 3 ? 'active' : null}`}
                onClick={() => slider.current.goTo(3)}
                role="button"
              >
                Datasets
              </li>
            </ul>
            <Carousel ref={slider} effect="scrollx" beforeChange={onChange}>
              <div className="slide">
                <p>
                  Explore data and find insights from interactive dashboards.
                </p>
              </div>
              <div className="slide">
                <p>Drag and drop to create robust charts and tables.</p>
              </div>
              <div className="slide">
                <p>
                  Write custom SQL queries, browse database metadata, use Jinja
                  templating, and more.
                </p>
              </div>
              <div className="slide">
                <p>
                  Create physical and virtual datasets to scale chart creation
                  with unified metric definitions.
                </p>
              </div>
            </Carousel>
            <video autoPlay muted controls loop>
              <source
                src="https://superset.staged.apache.org/superset-video-4k.mp4"
                type="video/mp4"
              />
            </video>
          </StyledSliderSection>
          <StyledKeyFeatures>
            <h3>Key features</h3>
            <div className="grid">
              <div className="item">
                <img src="/img/check-icon.svg" alt="check-icon" />
                <div>
                  <strong>40+ pre-installed visualizations</strong>
                </div>
              </div>
              <div className="item">
                <img src="/img/check-icon.svg" alt="check-icon" />
                <div>
                  Support for <strong>drag-and-drop</strong> and{' '}
                  <strong>SQL queries</strong>
                </div>
              </div>
              <div className="item">
                <img src="/img/check-icon.svg" alt="check-icon" />
                <div>
                  <strong>Data caching</strong> for the faster load time of
                  charts and dashboards
                </div>
              </div>
              <div className="item">
                <img src="/img/check-icon.svg" alt="check-icon" />
                <div>
                  <strong>Jinja templating and dashboard filters</strong> for
                  creating interactive dashboards
                </div>
              </div>
              <div className="item">
                <img src="/img/check-icon.svg" alt="check-icon" />
                <div>
                  <strong>CSS templates</strong> to customize charts and
                  dashboards to your brand’s look and feel
                </div>
              </div>
              <div className="item">
                <img src="/img/check-icon.svg" alt="check-icon" />
                <div>
                  <strong>Semantic layer</strong> for SQL data transformations
                </div>
              </div>
              <div className="item">
                <img src="/img/check-icon.svg" alt="check-icon" />
                <div>
                  <strong>Cross-filters, drill-to-detail, and drill-by</strong>{' '}
                  features for deeper data analysis
                </div>
              </div>
              <div className="item">
                <img src="/img/check-icon.svg" alt="check-icon" />
                <div>
                  <strong>Virtual datasets</strong> for ad-hoc data exploration
                </div>
              </div>
              <div className="item">
                <img src="/img/check-icon.svg" alt="check-icon" />
                <div>
                  Access to new functionalities through{' '}
                  <strong>feature flags</strong>
                </div>
              </div>
            </div>
          </StyledKeyFeatures>
        </BlurredSection>
        <BlurredSection>
          <StyledIntegrations>
            <SectionHeader level="h2" title="Supported Databases" link="/docs/databases" />
            <div className="database-grid">
              {Databases.map(({ title, imgName, docPath }) => (
                <div className="item" key={title}>
                  <a href={docPath} aria-label={`${title} documentation`}>
                    <img src={`/img/databases/${imgName}`} title={title} />
                  </a>
                </div>
              ))}
            </div>
            <span className="database-sub">
              ...and many other{' '}
              <a href="/docs/databases#installing-database-drivers">
                compatible databases
              </a>
            </span>
          </StyledIntegrations>
        </BlurredSection>
        {/* Only show carousel when we have enough logos (>10) for a good display */}
        {companiesWithLogos.length > 7 && (
          <BlurredSection>
            <div style={{ padding: '0 20px' }}>
              <SectionHeader
                level="h2"
                title="Trusted by teams everywhere"
                subtitle="Join thousands of companies using Superset to explore and visualize their data"
              />
              <div style={{ maxWidth: 1160, margin: '25px auto 0' }}>
                <Carousel
                  autoplay
                  autoplaySpeed={2000}
                  slidesToShow={6}
                  slidesToScroll={1}
                  dots={false}
                  responsive={[
                    { breakpoint: 1024, settings: { slidesToShow: 4 } },
                    { breakpoint: 768, settings: { slidesToShow: 3 } },
                    { breakpoint: 480, settings: { slidesToShow: 2 } },
                  ]}
                >
                  {shuffledCompanies.map(({ name, url, logo }) => (
                    <div key={name}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Visit ${name}`}
                      >
                        <Card
                          style={{ margin: '0 8px' }}
                          styles={{
                            body: {
                              height: 80,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 16,
                            },
                          }}
                        >
                          <img
                            src={`/img/logos/${logo}`}
                            alt={name}
                            title={name}
                            style={{ maxHeight: 48, maxWidth: '100%', objectFit: 'contain' }}
                          />
                        </Card>
                      </a>
                    </div>
                  ))}
                </Carousel>
              </div>
              <Flex justify="center" style={{ marginTop: 30, fontSize: 17 }}>
                <Link to="/inTheWild">See all companies</Link>
                <span style={{ margin: '0 8px' }}>·</span>
                <a
                  href="https://github.com/apache/superset/edit/master/RESOURCES/INTHEWILD.yaml"
                  target="_blank"
                  rel="noreferrer"
                >
                  Add yours to the list!
                </a>
              </Flex>
            </div>
          </BlurredSection>
        )}
      </StyledMain>
    </Layout>
  );
}
