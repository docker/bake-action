import {beforeEach, describe, expect, jest, test} from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import {Buildx} from '@docker/actions-toolkit/lib/buildx/buildx';
import {Context} from '@docker/actions-toolkit/lib/context';
import {Docker} from '@docker/actions-toolkit/lib/docker';
import {Toolkit} from '@docker/actions-toolkit/lib/toolkit';

import * as context from '../src/context';

const tmpDir = path.join('/tmp', '.docker-bake-action-jest');
const tmpName = path.join(tmpDir, '.tmpname-jest');

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

describe('getArgs', () => {
  beforeEach(() => {
    process.env = Object.keys(process.env).reduce((object, key) => {
      if (!key.startsWith('INPUT_')) {
        object[key] = process.env[key];
      }
      return object;
    }, {});
  });

  // prettier-ignore
  test.each([
    [
      0,
      '0.4.1',
      new Map<string, string>([
        ['load', 'false'],
        ['no-cache', 'false'],
        ['push', 'false'],
        ['pull', 'false'],
      ]),
      [
        'bake',
      ]
    ],
    [
      1,
      '0.8.2',
      new Map<string, string>([
        ['load', 'false'],
        ['no-cache', 'false'],
        ['push', 'false'],
        ['pull', 'false']
      ]),
      [
        'bake',
        '--metadata-file', path.join(tmpDir, 'metadata-file')
      ]
    ],
    [
      2,
      '0.8.2',
      new Map<string, string>([
        ['targets', 'webapp\nvalidate'],
        ['load', 'false'],
        ['no-cache', 'false'],
        ['push', 'false'],
        ['pull', 'false']
      ]),
      [
        'bake',
        '--metadata-file', path.join(tmpDir, 'metadata-file'),
        'webapp', 'validate'
      ]
    ],
    [
      3,
      '0.8.2',
      new Map<string, string>([
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
        '--metadata-file', path.join(tmpDir, 'metadata-file')
      ]
    ],
  ])(
    '[%d] given %p with %p as inputs, returns %p',
    async (num: number, buildxVersion: string, inputs: Map<string, string>, expected: Array<string>) => {
      inputs.forEach((value: string, name: string) => {
        setInput(name, value);
      });
      const toolkit = new Toolkit();
      jest.spyOn(Buildx.prototype, 'version').mockImplementation(async (): Promise<string> => {
        return buildxVersion;
      });
      const inp = await context.getInputs();
      const res = await context.getArgs(inp, toolkit);
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
