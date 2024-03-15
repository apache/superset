import * as dockerUtils from './docker.js';

const SHA = '22e7c602b9aa321ec7e0df4bb0033048664dcdf0';
const PR_ID = '666';
const OLD_REL = '2.1.0';
const NEW_REL = '2.1.1';
const REPO = 'apache/superset';

beforeEach(() => {
  process.env.TEST_ENV = 'true';
});

afterEach(() => {
  delete process.env.TEST_ENV;
});

describe('isLatestRelease', () => {
  test.each([
    ['2.1.0', false],
    ['2.1.1', true],
    ['1.0.0', false],
    ['3.0.0', true],
  ])('returns %s for release %s', (release, expectedBool) => {
    expect(dockerUtils.isLatestRelease(release)).toBe(expectedBool);
  });
});

describe('getDockerTags', () => {
  test.each([
    // PRs
    [
      'lean',
      ['linux/arm64'],
      SHA,
      'pull_request',
      PR_ID,
      [`${REPO}:22e7c60-arm`, `${REPO}:${SHA}-arm`, `${REPO}:pr-${PR_ID}-arm`],
    ],
    [
      'ci',
      ['linux/amd64'],
      SHA,
      'pull_request',
      PR_ID,
      [`${REPO}:22e7c60-ci`, `${REPO}:${SHA}-ci`, `${REPO}:pr-${PR_ID}-ci`],
    ],
    [
      'lean',
      ['linux/amd64'],
      SHA,
      'pull_request',
      PR_ID,
      [`${REPO}:22e7c60`, `${REPO}:${SHA}`, `${REPO}:pr-${PR_ID}`],
    ],
    [
      'dev',
      ['linux/arm64'],
      SHA,
      'pull_request',
      PR_ID,
      [
        `${REPO}:22e7c60-dev-arm`,
        `${REPO}:${SHA}-dev-arm`,
        `${REPO}:pr-${PR_ID}-dev-arm`,
      ],
    ],
    [
      'dev',
      ['linux/amd64'],
      SHA,
      'pull_request',
      PR_ID,
      [`${REPO}:22e7c60-dev`, `${REPO}:${SHA}-dev`, `${REPO}:pr-${PR_ID}-dev`],
    ],
    // old releases
    [
      'lean',
      ['linux/arm64'],
      SHA,
      'release',
      OLD_REL,
      [`${REPO}:22e7c60-arm`, `${REPO}:${SHA}-arm`, `${REPO}:${OLD_REL}-arm`],
    ],
    [
      'lean',
      ['linux/amd64'],
      SHA,
      'release',
      OLD_REL,
      [`${REPO}:22e7c60`, `${REPO}:${SHA}`, `${REPO}:${OLD_REL}`],
    ],
    [
      'dev',
      ['linux/arm64'],
      SHA,
      'release',
      OLD_REL,
      [
        `${REPO}:22e7c60-dev-arm`,
        `${REPO}:${SHA}-dev-arm`,
        `${REPO}:${OLD_REL}-dev-arm`,
      ],
    ],
    [
      'dev',
      ['linux/amd64'],
      SHA,
      'release',
      OLD_REL,
      [`${REPO}:22e7c60-dev`, `${REPO}:${SHA}-dev`, `${REPO}:${OLD_REL}-dev`],
    ],
    // new releases
    [
      'lean',
      ['linux/arm64'],
      SHA,
      'release',
      NEW_REL,
      [
        `${REPO}:22e7c60-arm`,
        `${REPO}:${SHA}-arm`,
        `${REPO}:${NEW_REL}-arm`,
        `${REPO}:latest-arm`,
      ],
    ],
    [
      'lean',
      ['linux/amd64'],
      SHA,
      'release',
      NEW_REL,
      [`${REPO}:22e7c60`, `${REPO}:${SHA}`, `${REPO}:${NEW_REL}`, `${REPO}:latest`],
    ],
    [
      'dev',
      ['linux/arm64'],
      SHA,
      'release',
      NEW_REL,
      [
        `${REPO}:22e7c60-dev-arm`,
        `${REPO}:${SHA}-dev-arm`,
        `${REPO}:${NEW_REL}-dev-arm`,
        `${REPO}:latest-dev-arm`,
      ],
    ],
    [
      'dev',
      ['linux/amd64'],
      SHA,
      'release',
      NEW_REL,
      [
        `${REPO}:22e7c60-dev`,
        `${REPO}:${SHA}-dev`,
        `${REPO}:${NEW_REL}-dev`,
        `${REPO}:latest-dev`,
      ],
    ],
    // merge on master
    [
      'lean',
      ['linux/arm64'],
      SHA,
      'push',
      'master',
      [`${REPO}:22e7c60-arm`, `${REPO}:${SHA}-arm`, `${REPO}:master-arm`],
    ],
    [
      'lean',
      ['linux/amd64'],
      SHA,
      'push',
      'master',
      [`${REPO}:22e7c60`, `${REPO}:${SHA}`, `${REPO}:master`],
    ],
    [
      'dev',
      ['linux/arm64'],
      SHA,
      'push',
      'master',
      [
        `${REPO}:22e7c60-dev-arm`,
        `${REPO}:${SHA}-dev-arm`,
        `${REPO}:master-dev-arm`,
      ],
    ],
    [
      'dev',
      ['linux/amd64'],
      SHA,
      'push',
      'master',
      [`${REPO}:22e7c60-dev`, `${REPO}:${SHA}-dev`, `${REPO}:master-dev`],
    ],

  ])('returns expected tags', (preset, platforms, sha, buildContext, buildContextRef, expectedTags) => {
    const tags = dockerUtils.getDockerTags({
      preset, platforms, sha, buildContext, buildContextRef,
    });
    expect(tags).toEqual(expect.arrayContaining(expectedTags));
  });
});

describe('getDockerCommand', () => {
  test.each([
    [
      'lean',
      ['linux/amd64'],
      true,
      SHA,
      'push',
      'master',
      ['--push', `-t ${REPO}:master `],
    ],
    [
      'dev',
      ['linux/amd64'],
      false,
      SHA,
      'push',
      'master',
      ['--load', `-t ${REPO}:master-dev `],
    ],
    // multi-platform
    [
      'lean',
      ['linux/arm64', 'linux/amd64'],
      true,
      SHA,
      'push',
      'master',
      ['--platform linux/arm64,linux/amd64'],
    ],
  ])('returns expected docker command', (preset, platform, isAuthenticated, sha, buildContext, buildContextRef, contains) => {
    const cmd = dockerUtils.getDockerCommand({
      preset, platform, isAuthenticated, sha, buildContext, buildContextRef,
    });
    contains.forEach((expectedSubstring) => {
      expect(cmd).toContain(expectedSubstring);
    });
  });
});
