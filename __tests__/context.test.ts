import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

import {Bake} from '@docker/actions-toolkit/lib/buildx/bake';
import {Builder} from '@docker/actions-toolkit/lib/buildx/builder';
import {Buildx} from '@docker/actions-toolkit/lib/buildx/buildx';
import {Context} from '@docker/actions-toolkit/lib/context';
import {Docker} from '@docker/actions-toolkit/lib/docker/docker';
import {GitHub} from '@docker/actions-toolkit/lib/github';
import {Toolkit} from '@docker/actions-toolkit/lib/toolkit';

import {BakeDefinition} from '@docker/actions-toolkit/lib/types/buildx/bake';
import {BuilderInfo} from '@docker/actions-toolkit/lib/types/buildx/builder';
import {GitHubRepo} from '@docker/actions-toolkit/lib/types/github';

import * as context from '../src/context';

const tmpDir = path.join('/tmp', '.docker-bake-action-jest');
const tmpName = path.join(tmpDir, '.tmpname-jest');

import repoFixture from './fixtures/github-repo.json';
jest.spyOn(GitHub.prototype, 'repoData').mockImplementation((): Promise<GitHubRepo> => {
  return <Promise<GitHubRepo>>(repoFixture as unknown);
});

jest.spyOn(Context, 'tmpDir').mockImplementation((): string => {
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, {recursive: true});
  }
  return tmpDir;
});

jest.spyOn(Context, 'tmpName').mockImplementation((): string => {
  return tmpName;
});

jest.spyOn(Docker, 'isAvailable').mockImplementation(async (): Promise<boolean> => {
  return true;
});

const metadataJson = path.join(tmpDir, 'metadata.json');
jest.spyOn(Bake.prototype, 'getMetadataFilePath').mockImplementation((): string => {
  return metadataJson;
});

jest.spyOn(Builder.prototype, 'inspect').mockImplementation(async (): Promise<BuilderInfo> => {
  return {
    name: 'builder2',
    driver: 'docker-container',
    lastActivity: new Date('2023-01-16 09:45:23 +0000 UTC'),
    nodes: [
      {
        buildkit: 'v0.11.0',
        'buildkitd-flags': '--debug --allow-insecure-entitlement security.insecure --allow-insecure-entitlement network.host',
        'driver-opts': ['BUILDKIT_STEP_LOG_MAX_SIZE=10485760', 'BUILDKIT_STEP_LOG_MAX_SPEED=10485760', 'JAEGER_TRACE=localhost:6831', 'image=moby/buildkit:latest', 'network=host'],
        endpoint: 'unix:///var/run/docker.sock',
        name: 'builder20',
        platforms: 'linux/amd64,linux/amd64/v2,linux/amd64/v3,linux/arm64,linux/riscv64,linux/ppc64le,linux/s390x,linux/386,linux/mips64le,linux/mips64,linux/arm/v7,linux/arm/v6',
        status: 'running'
      }
    ]
  };
});

jest.spyOn(Bake.prototype, 'getDefinition').mockImplementation(async (): Promise<BakeDefinition> => {
  return JSON.parse(`{
    "group": {
      "default": {
        "targets": [
          "validate"
        ]
      },
      "validate": {
        "targets": [
          "lint",
          "validate-vendor",
          "validate-docs"
        ]
      }
    },
    "target": {
      "lint": {
        "context": ".",
        "dockerfile": "./hack/dockerfiles/lint.Dockerfile",
        "args": {
          "BUILDKIT_CONTEXT_KEEP_GIT_DIR": "1",
          "GO_VERSION": "1.20"
        },
        "output": [
          "type=cacheonly"
        ]
      },
      "validate-docs": {
        "context": ".",
        "dockerfile": "./hack/dockerfiles/docs.Dockerfile",
        "args": {
          "BUILDKIT_CONTEXT_KEEP_GIT_DIR": "1",
          "BUILDX_EXPERIMENTAL": "1",
          "FORMATS": "md",
          "GO_VERSION": "1.20"
        },
        "target": "validate",
        "output": [
          "type=cacheonly"
        ]
      },
      "validate-vendor": {
        "context": ".",
        "dockerfile": "./hack/dockerfiles/vendor.Dockerfile",
        "args": {
          "BUILDKIT_CONTEXT_KEEP_GIT_DIR": "1",
          "GO_VERSION": "1.20"
        },
        "target": "validate",
        "output": [
          "type=cacheonly"
        ]
      }
    }
  }`) as BakeDefinition;
});

describe('getArgs', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = Object.keys(process.env).reduce((object, key) => {
      if (!key.startsWith('INPUT_')) {
        object[key] = process.env[key];
      }
      return object;
    }, {});
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  // prettier-ignore
  test.each([
    [
      0,
      '0.4.1',
      new Map<string, string>([
        ['source', '.'],
        ['load', 'false'],
        ['no-cache', 'false'],
        ['push', 'false'],
        ['pull', 'false'],
      ]),
      [
        'bake',
      ],
      undefined
    ],
    [
      1,
      '0.8.2',
      new Map<string, string>([
        ['source', '.'],
        ['load', 'false'],
        ['no-cache', 'false'],
        ['push', 'false'],
        ['pull', 'false']
      ]),
      [
        'bake',
        '--metadata-file', metadataJson
      ],
      undefined
    ],
    [
      2,
      '0.8.2',
      new Map<string, string>([
        ['source', '.'],
        ['targets', 'webapp\nvalidate'],
        ['load', 'false'],
        ['no-cache', 'false'],
        ['push', 'false'],
        ['pull', 'false']
      ]),
      [
        'bake',
        '--metadata-file', metadataJson,
        'webapp', 'validate'
      ],
      undefined
    ],
    [
      3,
      '0.8.2',
      new Map<string, string>([
        ['source', '.'],
        ['set', '*.cache-from=type=gha\n*.cache-to=type=gha'],
        ['load', 'false'],
        ['no-cache', 'false'],
        ['push', 'false'],
        ['pull', 'false']
      ]),
      [
        'bake',
        '--set', '*.cache-from=type=gha',
        '--set', '*.cache-to=type=gha',
        '--metadata-file', metadataJson
      ],
      undefined
    ],
    [
      4,
      '0.10.0',
      new Map<string, string>([
        ['source', '.'],
        ['load', 'false'],
        ['no-cache', 'false'],
        ['push', 'false'],
        ['pull', 'false'],
      ]),
      [
        'bake',
        '--metadata-file', metadataJson,
        "--provenance", `mode=min,inline-only=true,builder-id=https://github.com/docker/build-push-action/actions/runs/123456789/attempts/1`,
      ],
      undefined
    ],
    [
      5,
      '0.10.0',
      new Map<string, string>([
        ['source', '.'],
        ['load', 'false'],
        ['no-cache', 'false'],
        ['push', 'false'],
        ['pull', 'false'],
        ['provenance', 'true'],
      ]),
      [
        'bake',
        '--metadata-file', metadataJson,
        "--provenance", `builder-id=https://github.com/docker/build-push-action/actions/runs/123456789/attempts/1`
      ],
      undefined
    ],
    [
      6,
      '0.10.0',
      new Map<string, string>([
        ['source', '.'],
        ['load', 'false'],
        ['no-cache', 'false'],
        ['push', 'false'],
        ['pull', 'false'],
        ['provenance', 'mode=max'],
      ]),
      [
        'bake',
        '--metadata-file', metadataJson,
        "--provenance", `mode=max,builder-id=https://github.com/docker/build-push-action/actions/runs/123456789/attempts/1`
      ],
      undefined
    ],
    [
      7,
      '0.10.0',
      new Map<string, string>([
        ['source', '.'],
        ['load', 'false'],
        ['no-cache', 'false'],
        ['push', 'false'],
        ['pull', 'false'],
        ['provenance', 'false'],
      ]),
      [
        'bake',
        '--metadata-file', metadataJson,
        "--provenance", 'false'
      ],
      undefined
    ],
    [
      8,
      '0.10.0',
      new Map<string, string>([
        ['source', '.'],
        ['load', 'false'],
        ['no-cache', 'false'],
        ['push', 'false'],
        ['pull', 'false'],
        ['provenance', 'builder-id=foo'],
      ]),
      [
        'bake',
        '--metadata-file', metadataJson,
        "--provenance", 'builder-id=foo'
      ],
      undefined
    ],
    [
      9,
      '0.10.0',
      new Map<string, string>([
        ['source', '.'],
        ['load', 'false'],
        ['no-cache', 'false'],
        ['push', 'false'],
        ['pull', 'false'],
        ['set', `*.platform=linux/amd64,linux/ppc64le,linux/s390x\n*.output=type=image,"name=moby/buildkit:v0.11.0,moby/buildkit:latest",push=true`],
        ['targets', `"image-all"`],
      ]),
      [
        'bake',
        '--set', '*.platform=linux/amd64,linux/ppc64le,linux/s390x',
        '--set', `*.output=type=image,"name=moby/buildkit:v0.11.0,moby/buildkit:latest",push=true`,
        '--metadata-file', metadataJson,
        '--provenance', `mode=min,inline-only=true,builder-id=https://github.com/docker/build-push-action/actions/runs/123456789/attempts/1`,
        'image-all'
      ],
      undefined
    ],
    [
      10,
      '0.10.0',
      new Map<string, string>([
        ['source', '.'],
        ['load', 'false'],
        ['no-cache', 'false'],
        ['push', 'false'],
        ['pull', 'false'],
        ['set', `*.labels.foo=bar=#baz`],
        ['targets', `"image-all"`],
      ]),
      [
        'bake',
        '--set', `*.labels.foo=bar=#baz`,
        '--metadata-file', metadataJson,
        '--provenance', `mode=min,inline-only=true,builder-id=https://github.com/docker/build-push-action/actions/runs/123456789/attempts/1`,
        'image-all'
      ],
      undefined
    ],
    [
      11,
      '0.10.0',
      new Map<string, string>([
        ['load', 'false'],
        ['no-cache', 'false'],
        ['push', 'false'],
        ['pull', 'false'],
        ['files', './foo.hcl'],
      ]),
      [
        'bake',
        'https://github.com/docker/build-push-action.git#refs/heads/master',
        '--file', './foo.hcl',
        '--metadata-file', metadataJson,
        '--provenance', `mode=min,inline-only=true,builder-id=https://github.com/docker/build-push-action/actions/runs/123456789/attempts/1`,
      ],
      undefined
    ],
    [
      12,
      '0.17.0',
      new Map<string, string>([
        ['source', '.'],
        ['allow', 'network.host'],
        ['load', 'false'],
        ['no-cache', 'false'],
        ['push', 'false'],
        ['pull', 'false'],
      ]),
      [
        'bake',
        '--allow', 'network.host',
        '--metadata-file', metadataJson,
        "--provenance", `mode=min,inline-only=true,builder-id=https://github.com/docker/build-push-action/actions/runs/123456789/attempts/1`
      ],
      undefined
    ],
    [
      13,
      '0.15.0',
      new Map<string, string>([
        ['source', '{{defaultContext}}:subdir'],
        ['load', 'false'],
        ['no-cache', 'false'],
        ['push', 'false'],
        ['pull', 'false'],
        ['files', './foo.hcl'],
      ]),
      [
        'bake',
        'https://github.com/docker/build-push-action.git#refs/heads/master:subdir',
        '--file', './foo.hcl',
        '--metadata-file', metadataJson,
        '--provenance', `mode=min,inline-only=true,builder-id=https://github.com/docker/build-push-action/actions/runs/123456789/attempts/1`,
      ],
      undefined
    ],
    [
      14,
      '0.15.0',
      new Map<string, string>([
        ['source', '.'],
        ['load', 'false'],
        ['no-cache', 'false'],
        ['push', 'false'],
        ['pull', 'false']
      ]),
      [
        'bake',
        '--metadata-file', metadataJson
      ],
      new Map<string, string>([
        ['BUILDX_NO_DEFAULT_ATTESTATIONS', '1']
      ])
    ],
  ])(
    '[%d] given %p with %p as inputs, returns %p',
    async (num: number, buildxVersion: string, inputs: Map<string, string>, expected: Array<string>, envs: Map<string, string> | undefined) => {
      if (envs) {
        envs.forEach((value: string, name: string) => {
          process.env[name] = value;
        });
      }
      inputs.forEach((value: string, name: string) => {
        setInput(name, value);
      });
      const toolkit = new Toolkit();
      jest.spyOn(Buildx.prototype, 'version').mockImplementation(async (): Promise<string> => {
        return buildxVersion;
      });
      const inp = await context.getInputs();
      const definition = await toolkit.buildxBake.getDefinition(
        {
          files: inp.files,
          load: inp.load,
          noCache: inp['no-cache'],
          overrides: inp.set,
          provenance: inp.provenance,
          push: inp.push,
          sbom: inp.sbom,
          source: inp.source,
          targets: inp.targets
        },
        {
          cwd: inp.workdir
        }
      );
      const res = await context.getArgs(inp, definition, toolkit);
      expect(res).toEqual(expected);
    }
  );
});

// See: https://github.com/actions/toolkit/blob/a1b068ec31a042ff1e10a522d8fdf0b8869d53ca/packages/core/src/core.ts#L89
function getInputName(name: string): string {
  return `INPUT_${name.replace(/ /g, '_').toUpperCase()}`;
}

function setInput(name: string, value: string): void {
  process.env[getInputName(name)] = value;
}
