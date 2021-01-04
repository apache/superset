// Possible input names
export enum InputName {
  // @actions/cache specific inputs
  Key = 'key',
  Path = 'path',
  RestoreKeys = 'restore-keys',

  // setup-webapp specific inputs
  Run = 'run',
  Caches = 'caches',
  Bashlib = 'bashlib',
  Parallel = 'parallel',
}

// Possible GitHub event names
export enum GitHubEvent {
  Push = 'push',
  PullRequest = 'pull_request',
}

// Directly available environment variables
export enum EnvVariable {
  GitHubEventName = 'GITHUB_EVENT_NAME',
}

export const EnvVariableNames = new Set(Object.values(EnvVariable) as string[]);

export interface Inputs {
  [EnvVariable.GitHubEventName]?: string;
  [InputName.Key]?: string;
  [InputName.RestoreKeys]?: string;
  [InputName.Path]?: string;
  [InputName.Caches]?: string;
  [InputName.Bashlib]?: string;
  [InputName.Run]?: string;
  [InputName.Parallel]?: string;
}

export const DefaultInputs = {
  [InputName.Caches]: '.github/workflows/caches.js',
  [InputName.Bashlib]: '.github/workflows/bashlib.sh',
  [InputName.Run]: 'default-setup-command',
} as Inputs;
