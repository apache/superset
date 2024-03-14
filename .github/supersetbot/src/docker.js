import { spawnSync } from 'child_process';

const REPO = 'apache/superset';
const CACHE_REPO = `${REPO}-cache`;
const BASE_PY_IMAGE = '3.9-slim-bookworm';

export function runCmd(command, raiseOnFailure = true) {
  const { stdout, stderr } = spawnSync(command, { shell: true, encoding: 'utf-8', env: process.env });

  if (stderr && raiseOnFailure) {
    throw new Error(stderr);
  }
  return stdout;
}

function getGitSha() {
  return runCmd('git rev-parse HEAD').trim();
}

function getBuildContextRef(buildContext) {
  const event = buildContext || process.env.GITHUB_EVENT_NAME;
  const githubRef = process.env.GITHUB_REF || '';

  if (event === 'pull_request') {
    const githubHeadRef = process.env.GITHUB_HEAD_REF || '';
    return githubHeadRef.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 40);
  } if (event === 'release') {
    return githubRef.replace('refs/tags/', '').slice(0, 40);
  } if (event === 'push') {
    return githubRef.replace('refs/heads/', '').replace(/[^a-zA-Z0-9]/g, '-').slice(0, 40);
  }
  return '';
}

export function isLatestRelease(release) {
  const output = runCmd(`../../scripts/tag_latest_release.sh ${release} --dry-run`, false) || '';
  return output.includes('SKIP_TAG::false');
}

function makeDockerTag(parts) {
  return `${REPO}:${parts.filter((part) => part).join('-')}`;
}

export function getDockerTags({
  preset, platforms, sha, buildContext, buildContextRef, forceLatest = false,
}) {
  const tags = new Set();
  const tagChunks = [];

  const isLatest = isLatestRelease(buildContextRef);

  if (preset !== 'lean') {
    tagChunks.push(preset);
  }

  if (platforms.length === 1) {
    const platform = platforms[0];
    const shortBuildPlatform = platform.replace('linux/', '').replace('64', '');
    if (shortBuildPlatform !== 'amd') {
      tagChunks.push(shortBuildPlatform);
    }
  }

  tags.add(makeDockerTag([sha, ...tagChunks]));
  tags.add(makeDockerTag([sha.slice(0, 7), ...tagChunks]));

  if (buildContext === 'release') {
    tags.add(makeDockerTag([buildContextRef, ...tagChunks]));
    if (isLatest || forceLatest) {
      tags.add(makeDockerTag(['latest', ...tagChunks]));
    }
  } else if (buildContext === 'push' && buildContextRef === 'master') {
    tags.add(makeDockerTag(['master', ...tagChunks]));
  } else if (buildContext === 'pull_request') {
    tags.add(makeDockerTag([`pr-${buildContextRef}`, ...tagChunks]));
  }

  return [...tags];
}

export function getDockerCommand({
  preset, platform, buildContext, buildContextRef, forceLatest = false,
}) {
  const platforms = platform;

  let buildTarget = '';
  let pyVer = BASE_PY_IMAGE;
  let dockerContext = '.';

  if (preset === 'dev') {
    buildTarget = 'dev';
  } else if (preset === 'lean') {
    buildTarget = 'lean';
  } else if (preset === 'py310') {
    buildTarget = 'lean';
    pyVer = '3.10-slim-bookworm';
  } else if (preset === 'websocket') {
    dockerContext = 'superset-websocket';
  } else if (preset === 'ci') {
    buildTarget = 'ci';
  } else if (preset === 'dockerize') {
    dockerContext = '-f dockerize.Dockerfile .';
  } else {
    console.error(`Invalid build preset: ${preset}`);
    process.exit(1);
  }

  let ref = buildContextRef;
  if (!ref) {
    ref = getBuildContextRef(buildContext);
  }
  const sha = getGitSha();
  const tags = getDockerTags({
    preset, platforms, sha, buildContext, buildContextRef: ref, forceLatest,
  }).map((tag) => `-t ${tag}`).join(' \\\n        ');
  const isAuthenticated = !!(process.env.DOCKERHUB_TOKEN && process.env.DOCKERHUB_USER);

  const dockerArgs = isAuthenticated ? '--push' : '--load';
  const targetArgument = buildTarget ? `--target ${buildTarget}` : '';
  const cacheRef = `${CACHE_REPO}:${pyVer}`;
  const platformArg = `--platform ${platforms.join(',')}`;
  const cacheFromArg = `--cache-from=type=registry,ref=${cacheRef}`;
  const cacheToArg = isAuthenticated ? `--cache-to=type=registry,mode=max,ref=${cacheRef}` : '';
  const buildArg = pyVer ? `--build-arg PY_VER=${pyVer}` : '';
  const actor = process.env.GITHUB_ACTOR;

  return `docker buildx build \\
      ${dockerArgs} \\
      ${tags} \\
      ${cacheFromArg} \\
      ${cacheToArg} \\
      ${targetArgument} \\
      ${buildArg} \\
      ${platformArg} \\
      --label sha=${sha} \\
      --label target=${buildTarget} \\
      --label build_trigger=${ref} \\
      --label base=${pyVer} \\
      --label build_actor=${actor} \\
      ${dockerContext}
  `;
}
