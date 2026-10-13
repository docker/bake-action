import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {Bake} from '@docker/actions-toolkit/lib/buildx/bake.js';
import {Build} from '@docker/actions-toolkit/lib/buildx/build.js';
import {Builder} from '@docker/actions-toolkit/lib/buildx/builder.js';
import {Buildx} from '@docker/actions-toolkit/lib/buildx/buildx.js';
import {Docker} from '@docker/actions-toolkit/lib/docker/docker.js';
import {Toolkit} from '@docker/actions-toolkit/lib/toolkit.js';

import {BakeDefinition} from '@docker/actions-toolkit/lib/types/buildx/bake.js';
import {BuilderInfo} from '@docker/actions-toolkit/lib/types/buildx/builder.js';

import * as context from '../src/context.js';

const tmpDir = fs.mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), 'context-'));
const fixturesDir = path.join(__dirname, 'fixtures');

vi.spyOn(Docker, 'isAvailable').mockImplementation(async (): Promise<boolean> => {
  return true;
});

const metadataJson = path.join(tmpDir, 'metadata.json');
vi.spyOn(Bake.prototype, 'getMetadataFilePath').mockImplementation((): string => {
  return metadataJson;
});

type BuilderInfoFixture = Omit<BuilderInfo, 'lastActivity'> & {lastActivity: string};
const builderInfoFixture = <BuilderInfoFixture>JSON.parse(fs.readFileSync(path.join(fixturesDir, 'builder-info.json'), {encoding: 'utf-8'}).trim());
vi.spyOn(Builder.prototype, 'inspect').mockImplementation(async (): Promise<BuilderInfo> => {
  return {
    ...builderInfoFixture,
    lastActivity: new Date(builderInfoFixture.lastActivity)
  };
});

vi.spyOn(Bake.prototype, 'getDefinition').mockImplementation(async (): Promise<BakeDefinition> => {
  return <BakeDefinition>JSON.parse(fs.readFileSync(path.join(fixturesDir, 'bake-def.json'), {encoding: 'utf-8'}).trim());
});

describe('getInputs', () => {
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

  function setRequiredBooleanInputs(): void {
    setInput('no-cache', 'false');
    setInput('pull', 'false');
    setInput('load', 'false');
    setInput('push', 'false');
  }

  test('uses Build git context when source input is empty', async () => {
    const gitContext = 'https://github.com/docker/bake-action.git?ref=refs/heads/master&checksum=0123456789abcdef';
    const gitContextSpy = vi.spyOn(Build.prototype, 'gitContext').mockResolvedValue(gitContext);
    setRequiredBooleanInputs();
    const inputs = await context.getInputs();
    expect(inputs.source).toEqual({
      remoteRef: gitContext
    });
    expect(gitContextSpy).toHaveBeenCalledTimes(1);
    gitContextSpy.mockRestore();
  });

  test('renders defaultContext source templates from Build git context', async () => {
    const gitContext = 'https://github.com/docker/bake-action.git#refs/heads/master';
    const gitContextSpy = vi.spyOn(Build.prototype, 'gitContext').mockResolvedValue(gitContext);
    setRequiredBooleanInputs();
    setInput('source', '{{defaultContext}}:subdir');
    const inputs = await context.getInputs();
    expect(inputs.source).toEqual({
      remoteRef: `${gitContext}:subdir`
    });
    expect(gitContextSpy).toHaveBeenCalledTimes(1);
    gitContextSpy.mockRestore();
  });

  describe('vars', () => {
    beforeEach(() => {
      setRequiredBooleanInputs();
      setInput('source', '.');
    });

    test('preserves line-based input parsing', async () => {
      setInput('vars', 'TAGS=one,two\nJSON={"value":"a,b=c"}\nQUOTED="literal"\nEMPTY=');
      expect((await context.getInputs()).vars).toEqual(['TAGS=one,two', 'JSON={"value":"a,b=c"}', 'QUOTED="literal"', 'EMPTY=']);
    });

    test('preserves JSON entries including multiline values and whitespace', async () => {
      const vars = [
        'DOCKER_METADATA_OUTPUT_TAGS=example/app:latest\nexample/app:main\n',
        'DOCKER_METADATA_OUTPUT_LABELS=version=1.2.3\r\ntitle=example\r\n',
        'DOCKER_METADATA_OUTPUT_JSON={"tags":["example/app:latest","example/app:main"]}',
        'PADDED=  "one,two"=three  ',
        'EMPTY='
      ];
      setInput('vars', `  \n${JSON.stringify(vars, null, 2)}\n  `);
      expect((await context.getInputs()).vars).toEqual(vars);
    });

    test('preserves duplicate JSON variable entries in order', async () => {
      setInput('vars', JSON.stringify(['VERSION=default', 'OTHER=value', 'VERSION=override', 'VERSION=final']));
      expect((await context.getInputs()).vars).toEqual(['VERSION=default', 'OTHER=value', 'VERSION=override', 'VERSION=final']);
    });

    test('accepts an empty JSON array', async () => {
      setInput('vars', '[]');
      expect((await context.getInputs()).vars).toEqual([]);
    });

    test('falls back to list parsing when JSON parsing fails', async () => {
      setInput('vars', '["KEY=value"');
      expect((await context.getInputs()).vars).toEqual(['["KEY=value"']);
    });

    test.each(['null', 'true', '1', '"KEY=value"', '{"KEY":"value"}', '["KEY=value",1]', '[null]', '[["KEY=value"]]'])('rejects invalid JSON variable lists: %s', async value => {
      setInput('vars', value);
      await expect(context.getInputs()).rejects.toThrow('Invalid vars input: expected a JSON array of strings.');
    });
  });
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

  test('passes JSON variables as individual CLI arguments without changing their values', async () => {
    const vars = ['DOCKER_METADATA_OUTPUT_TAGS=example/app:latest\nexample/app:main', 'PADDED=  "one,two"=three  ', 'EMPTY='];
    setInput('source', '.');
    setInput('no-cache', 'false');
    setInput('pull', 'false');
    setInput('load', 'false');
    setInput('push', 'false');
    setInput('provenance', 'false');
    setInput('vars', JSON.stringify(vars));
    vi.spyOn(Buildx.prototype, 'version').mockResolvedValue('0.31.0');
    const toolkit = new Toolkit();
    const inputs = await context.getInputs();
    const definition = await toolkit.buildxBake.getDefinition({vars: inputs.vars});
    expect(await context.getArgs(inputs, definition, toolkit)).toEqual(['bake', '--allow', 'fs=*', ...vars.flatMap(value => ['--var', value]), '--metadata-file', metadataJson, '--provenance', 'false']);
  });

  test('requires Buildx 0.31.0 for JSON variables', async () => {
    setInput('source', '.');
    setInput('no-cache', 'false');
    setInput('pull', 'false');
    setInput('load', 'false');
    setInput('push', 'false');
    setInput('vars', '["KEY=value"]');
    vi.spyOn(Buildx.prototype, 'version').mockResolvedValue('0.30.0');
    const toolkit = new Toolkit();
    const inputs = await context.getInputs();
    const definition = await toolkit.buildxBake.getDefinition({vars: inputs.vars});
    await expect(context.getArgs(inputs, definition, toolkit)).rejects.toThrow('Buildx >= 0.31.0 is required to use the vars input.');
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
        '--set', `lint.attest=type=provenance,mode=min,inline-only=true,builder-id=https://github.com/docker/bake-action/actions/runs/123456789/attempts/1`,
        '--set', `validate-docs.attest=type=provenance,mode=min,inline-only=true,builder-id=https://github.com/docker/bake-action/actions/runs/123456789/attempts/1`,
        '--set', `validate-vendor.attest=type=provenance,mode=min,inline-only=true,builder-id=https://github.com/docker/bake-action/actions/runs/123456789/attempts/1`,
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
        "--provenance", `builder-id=https://github.com/docker/bake-action/actions/runs/123456789/attempts/1`
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
        "--provenance", `mode=max,builder-id=https://github.com/docker/bake-action/actions/runs/123456789/attempts/1`
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
        '--set', `lint.attest=type=provenance,mode=min,inline-only=true,builder-id=https://github.com/docker/bake-action/actions/runs/123456789/attempts/1`,
        '--set', `validate-docs.attest=type=provenance,mode=min,inline-only=true,builder-id=https://github.com/docker/bake-action/actions/runs/123456789/attempts/1`,
        '--set', `validate-vendor.attest=type=provenance,mode=min,inline-only=true,builder-id=https://github.com/docker/bake-action/actions/runs/123456789/attempts/1`,
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
        '--set', `lint.attest=type=provenance,mode=min,inline-only=true,builder-id=https://github.com/docker/bake-action/actions/runs/123456789/attempts/1`,
        '--set', `validate-docs.attest=type=provenance,mode=min,inline-only=true,builder-id=https://github.com/docker/bake-action/actions/runs/123456789/attempts/1`,
        '--set', `validate-vendor.attest=type=provenance,mode=min,inline-only=true,builder-id=https://github.com/docker/bake-action/actions/runs/123456789/attempts/1`,
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
        'https://github.com/docker/bake-action.git#refs/heads/master',
        '--file', './foo.hcl',
        '--metadata-file', metadataJson,
        '--set', `lint.attest=type=provenance,mode=min,inline-only=true,builder-id=https://github.com/docker/bake-action/actions/runs/123456789/attempts/1`,
        '--set', `validate-docs.attest=type=provenance,mode=min,inline-only=true,builder-id=https://github.com/docker/bake-action/actions/runs/123456789/attempts/1`,
        '--set', `validate-vendor.attest=type=provenance,mode=min,inline-only=true,builder-id=https://github.com/docker/bake-action/actions/runs/123456789/attempts/1`
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
        '--set', `lint.attest=type=provenance,mode=min,inline-only=true,builder-id=https://github.com/docker/bake-action/actions/runs/123456789/attempts/1`,
        '--set', `validate-docs.attest=type=provenance,mode=min,inline-only=true,builder-id=https://github.com/docker/bake-action/actions/runs/123456789/attempts/1`,
        '--set', `validate-vendor.attest=type=provenance,mode=min,inline-only=true,builder-id=https://github.com/docker/bake-action/actions/runs/123456789/attempts/1`
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
        'https://github.com/docker/bake-action.git#refs/heads/master:subdir',
        '--file', './foo.hcl',
        '--metadata-file', metadataJson,
        '--set', `lint.attest=type=provenance,mode=min,inline-only=true,builder-id=https://github.com/docker/bake-action/actions/runs/123456789/attempts/1`,
        '--set', `validate-docs.attest=type=provenance,mode=min,inline-only=true,builder-id=https://github.com/docker/bake-action/actions/runs/123456789/attempts/1`,
        '--set', `validate-vendor.attest=type=provenance,mode=min,inline-only=true,builder-id=https://github.com/docker/bake-action/actions/runs/123456789/attempts/1`
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
    [
      15,
      '0.29.0',
      new Map<string, string>([
        ['load', 'false'],
        ['no-cache', 'false'],
        ['push', 'false'],
        ['pull', 'false'],
        ['files', './foo.hcl'],
      ]),
      [
        'bake',
        'https://github.com/docker/bake-action.git?ref=refs/heads/master',
        '--allow', 'fs=*',
        '--file', './foo.hcl',
        '--metadata-file', metadataJson,
        '--set', `lint.attest=type=provenance,mode=min,inline-only=true,builder-id=https://github.com/docker/bake-action/actions/runs/123456789/attempts/1`,
        '--set', `validate-docs.attest=type=provenance,mode=min,inline-only=true,builder-id=https://github.com/docker/bake-action/actions/runs/123456789/attempts/1`,
        '--set', `validate-vendor.attest=type=provenance,mode=min,inline-only=true,builder-id=https://github.com/docker/bake-action/actions/runs/123456789/attempts/1`
      ],
      new Map<string, string>([
        ['BUILDX_SEND_GIT_QUERY_AS_INPUT', 'true']
      ])
    ],
    [
      16,
      '0.28.0',
      new Map<string, string>([
        ['load', 'false'],
        ['no-cache', 'false'],
        ['push', 'false'],
        ['pull', 'false'],
        ['files', './foo.hcl'],
      ]),
      [
        'bake',
        'https://github.com/docker/bake-action.git#refs/heads/master',
        '--allow', 'fs=*',
        '--file', './foo.hcl',
        '--metadata-file', metadataJson,
        '--set', `lint.attest=type=provenance,mode=min,inline-only=true,builder-id=https://github.com/docker/bake-action/actions/runs/123456789/attempts/1`,
        '--set', `validate-docs.attest=type=provenance,mode=min,inline-only=true,builder-id=https://github.com/docker/bake-action/actions/runs/123456789/attempts/1`,
        '--set', `validate-vendor.attest=type=provenance,mode=min,inline-only=true,builder-id=https://github.com/docker/bake-action/actions/runs/123456789/attempts/1`
      ],
      new Map<string, string>([
        ['BUILDX_SEND_GIT_QUERY_AS_INPUT', 'true']
      ])
    ],
  ])(
    '[%d] given %o with %o as inputs, returns %o',
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
      vi.spyOn(Buildx.prototype, 'version').mockImplementation(async (): Promise<string> => {
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
          source: inp.source.remoteRef,
          targets: inp.targets
        },
        {
          cwd: inp.source.workdir,
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
