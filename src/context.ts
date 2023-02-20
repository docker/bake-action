import * as core from '@actions/core';
import {Toolkit} from '@docker/actions-toolkit/lib/toolkit';
import {Util} from '@docker/actions-toolkit/lib/util';

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
}

export async function getInputs(): Promise<Inputs> {
  return {
    builder: core.getInput('builder'),
    files: Util.getInputList('files'),
    workdir: core.getInput('workdir') || '.',
    targets: Util.getInputList('targets'),
    noCache: core.getBooleanInput('no-cache'),
    pull: core.getBooleanInput('pull'),
    load: core.getBooleanInput('load'),
    push: core.getBooleanInput('push'),
    set: Util.getInputList('set', {ignoreComma: true}),
    source: core.getInput('source')
  };
}

export async function getArgs(inputs: Inputs, toolkit: Toolkit): Promise<Array<string>> {
  // prettier-ignore
  return [
    ...await getBakeArgs(inputs, toolkit),
    ...await getCommonArgs(inputs),
    ...inputs.targets
  ];
}

async function getBakeArgs(inputs: Inputs, toolkit: Toolkit): Promise<Array<string>> {
  const args: Array<string> = ['bake'];
  if (inputs.source) {
    args.push(inputs.source);
  }
  await Util.asyncForEach(inputs.files, async file => {
    args.push('--file', file);
  });
  await Util.asyncForEach(inputs.set, async set => {
    args.push('--set', set);
  });
  if (await toolkit.buildx.versionSatisfies('>=0.6.0')) {
    args.push('--metadata-file', toolkit.buildx.inputs.getBuildMetadataFilePath());
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
