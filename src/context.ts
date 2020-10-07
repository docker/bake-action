import * as buildx from './buildx';
import * as core from '@actions/core';

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
    files: await getInputList('files'),
    targets: await getInputList('targets'),
    noCache: /true/i.test(core.getInput('no-cache')),
    pull: /true/i.test(core.getInput('pull')),
    load: /true/i.test(core.getInput('load')),
    push: /true/i.test(core.getInput('push')),
    set: await getInputList('set', true)
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

export async function getInputList(name: string, ignoreComma?: boolean): Promise<string[]> {
  const items = core.getInput(name);
  if (items == '') {
    return [];
  }
  return items
    .split(/\r?\n/)
    .filter(x => x)
    .reduce<string[]>(
      (acc, line) => acc.concat(!ignoreComma ? line.split(',').filter(x => x) : line).map(pat => pat.trim()),
      []
    );
}

export const asyncForEach = async (array, callback) => {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
};
