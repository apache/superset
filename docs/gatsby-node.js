exports.createPages = ({ actions }) => {
  const { createRedirect } = actions; //actions is collection of many actions - https://www.gatsbyjs.org/docs/actions
  createRedirect({
    fromPath: '/installation.html',
    toPath: '/docs/installation/installing-superset-using-docker-compose',
    isPermanent: true,
  });
};
