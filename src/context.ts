import csvparse from 'csv-parse/lib/sync';
import * as buildx from './buildx';
import * as core from '@actions/core';
import {issueCommand} from '@actions/core/lib/command';

export interface Inputs {
  builder: string;
  files: string[];
  targets: string[];
  noCache: boolean;
  pull: boolean;
  load: boolean;
  push: boolean;
  set: string[];
}

export async function getInputs(): Promise<Inputs> {
  return {
    builder: core.getInput('builder'),
    files: getInputList('files'),
    targets: getInputList('targets'),
    noCache: core.getBooleanInput('no-cache'),
    pull: core.getBooleanInput('pull'),
    load: core.getBooleanInput('load'),
    push: core.getBooleanInput('push'),
    set: getInputList('set', true)
  };
}

export async function getArgs(inputs: Inputs, buildxVersion: string): Promise<Array<string>> {
  let args: Array<string> = ['buildx'];
  args.push.apply(args, await getBakeArgs(inputs, buildxVersion));
  args.push.apply(args, await getCommonArgs(inputs));
  args.push.apply(args, inputs.targets);
  return args;
}

async function getBakeArgs(inputs: Inputs, buildxVersion: string): Promise<Array<string>> {
  let args: Array<string> = ['bake'];
  await asyncForEach(inputs.files, async file => {
    args.push('--file', file);
  });
  await asyncForEach(inputs.set, async set => {
    args.push('--set', set);
  });
  return args;
}

async function getCommonArgs(inputs: Inputs): Promise<Array<string>> {
  let args: Array<string> = [];
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
  let res: Array<string> = [];

  const items = core.getInput(name);
  if (items == '') {
    return res;
  }

  for (let output of csvparse(items, {
    columns: false,
    relaxColumnCount: true,
    skipLinesWithEmptyValues: true
  }) as Array<string[]>) {
    if (output.length == 1) {
      res.push(output[0]);
      continue;
    } else if (!ignoreComma) {
      res.push(...output);
      continue;
    }
    res.push(output.join(','));
  }

  return res.filter(item => item).map(pat => pat.trim());
}

export const asyncForEach = async (array, callback) => {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
};

// FIXME: Temp fix https://github.com/actions/toolkit/issues/777
export function setOutput(name: string, value: any): void {
  issueCommand('set-output', {name}, value);
}
