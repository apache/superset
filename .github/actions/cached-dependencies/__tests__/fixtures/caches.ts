/**
 * Example cache config.
 */
export const npmHashFiles = ['.*ignore'];
export const npmExpectedHash =
  '13ed29a1c7ec906e7dcb20626957ebfcd3f0f2174bd2685a012105792bf1ff55';

export default {
  npm: {
    path: [`~/.npm`],
    hashFiles: npmHashFiles,
    restoreKeys: 'node-npm-',
  },
};
