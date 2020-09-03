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

      stackoverflow: file(relativePath: { eq: "src/images/stack_overflow.png" }) {
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

  const filter = data.getAllImages.edges.filter((n) => n.node.fixed.originalName === imageName);
  const imgStyle = width && height ? { width, height } : {};

  return type === 'db' ? (
    <Img fixed={filter[0]?.node?.fixed} style={imgStyle} imgStyle={imgStyle} />
  ) : (
    <Img fixed={data[imageName]?.childImageSharp?.fixed} {...otherProps} />
  );
};

export default Image;
