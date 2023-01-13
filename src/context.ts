import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as tmp from 'tmp';
import * as buildx from './buildx';
import * as core from '@actions/core';
import * as github from '@actions/github';
import {parse} from 'csv-parse/sync';

let _tmpDir: string;

export interface Inputs {
  builder: string;
  files: string[];
  workdir: string;
  targets: string[];
  noCache: boolean;
  pull: boolean;
  load: boolean;
  push: boolean;
  set: string[];
  source: string;
  ghaCache: GhaCache;
}

export enum GhaCache {
  Off = 'off',
  Min = 'min',
  Max = 'max'
}

interface BuildDefinitionTargets {
  target: Map<string, object>;
}

export function tmpDir(): string {
  if (!_tmpDir) {
    _tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docker-build-push-')).split(path.sep).join(path.posix.sep);
  }
  return _tmpDir;
}

export function tmpNameSync(options?: tmp.TmpNameOptions): string {
  return tmp.tmpNameSync(options);
}

export async function getInputs(): Promise<Inputs> {
  const ghaCache = Object.values(GhaCache).find(ghaCache => ghaCache == core.getInput('gha-cache'));
  if (ghaCache === undefined) {
    throw new Error(`gha-cache must be one of: off | min | max`);
  }
  return {
    builder: core.getInput('builder'),
    files: getInputList('files'),
    workdir: core.getInput('workdir') || '.',
    targets: getInputList('targets'),
    noCache: core.getBooleanInput('no-cache'),
    pull: core.getBooleanInput('pull'),
    load: core.getBooleanInput('load'),
    push: core.getBooleanInput('push'),
    set: getInputList('set', true),
    source: core.getInput('source'),
    ghaCache: ghaCache
  };
}

export async function getArgs(inputs: Inputs, buildxVersion: string, buildDefinition?: string): Promise<Array<string>> {
  // prettier-ignore
  return [
    ...await getBakeArgs(inputs, buildxVersion, buildDefinition),
    ...await getCommonArgs(inputs),
    ...inputs.targets
  ];
}

async function getBakeArgs(inputs: Inputs, buildxVersion: string, buildDefinition?: string): Promise<Array<string>> {
  const args: Array<string> = ['bake'];
  if (inputs.source) {
    args.push(inputs.source);
  }
  await asyncForEach(inputs.files, async file => {
    args.push('--file', file);
  });
  await asyncForEach(inputs.set, async set => {
    args.push('--set', set);
  });
  if (buildDefinition !== undefined && inputs.ghaCache != GhaCache.Off) {
    const targetsDefinition: BuildDefinitionTargets = JSON.parse(buildDefinition);
    for (const target in targetsDefinition.target) {
      args.push('--set', `${target}.cache-from=type=gha,scope=${github.context.ref}-${target}`);
      args.push('--set', `${target}.cache-to=type=gha,mode=${inputs.ghaCache},scope=${github.context.ref}-${target}`);
    }
  }
  if (buildx.satisfies(buildxVersion, '>=0.6.0')) {
    args.push('--metadata-file', await buildx.getMetadataFile());
  }
  return args;
}

async function getCommonArgs(inputs: Inputs): Promise<Array<string>> {
  const args: Array<string> = [];
  if (inputs.noCache) {
    args.push('--no-cache');
  }
  if (inputs.builder) {
    args.push('--builder', inputs.builder);
  }
  if (inputs.pull) {
    args.push('--pull');
  }
  if (inputs.load) {
    args.push('--load');
  }
  if (inputs.push) {
    args.push('--push');
  }
  return args;
}

export function getInputList(name: string, ignoreComma?: boolean): string[] {
  const res: Array<string> = [];

  const items = core.getInput(name);
  if (items == '') {
    return res;
  }

  const records = parse(items, {
    columns: false,
    relaxColumnCount: true,
    skipEmptyLines: true
  });

  for (const record of records as Array<string[]>) {
    if (record.length == 1) {
      res.push(record[0]);
      continue;
    } else if (!ignoreComma) {
      res.push(...record);
      continue;
    }
    res.push(record.join(','));
  }

  return res.filter(item => item).map(pat => pat.trim());
}

export const asyncForEach = async (array, callback) => {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
};
