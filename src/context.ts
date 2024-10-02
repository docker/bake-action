import * as core from '@actions/core';
import * as handlebars from 'handlebars';

import {Bake} from '@docker/actions-toolkit/lib/buildx/bake';
import {Build} from '@docker/actions-toolkit/lib/buildx/build';
import {Context} from '@docker/actions-toolkit/lib/context';
import {GitHub} from '@docker/actions-toolkit/lib/github';
import {Toolkit} from '@docker/actions-toolkit/lib/toolkit';
import {Util} from '@docker/actions-toolkit/lib/util';

import {BakeDefinition} from '@docker/actions-toolkit/lib/types/buildx/bake';

export interface Inputs {
  allow: string[];
  builder: string;
  files: string[];
  workdir: string;
  targets: string[];
  'no-cache': boolean;
  pull: boolean;
  load: boolean;
  provenance: string;
  push: boolean;
  sbom: string;
  set: string[];
  source: string;
  'github-token': string;
}

export async function getInputs(): Promise<Inputs> {
  return {
    allow: Util.getInputList('allow'),
    builder: core.getInput('builder'),
    files: Util.getInputList('files'),
    workdir: core.getInput('workdir') || '.',
    targets: Util.getInputList('targets'),
    'no-cache': core.getBooleanInput('no-cache'),
    pull: core.getBooleanInput('pull'),
    load: core.getBooleanInput('load'),
    provenance: Build.getProvenanceInput('provenance'),
    push: core.getBooleanInput('push'),
    sbom: core.getInput('sbom'),
    set: Util.getInputList('set', {ignoreComma: true, quote: false}),
    source: getSourceInput('source'),
    'github-token': core.getInput('github-token')
  };
}

export function sanitizeInputs(inputs: Inputs) {
  const res = {};
  for (const key of Object.keys(inputs)) {
    if (key === 'github-token') {
      continue;
    }
    const value: string | string[] | boolean = inputs[key];
    if (typeof value === 'boolean' && value === false) {
      continue;
    } else if (Array.isArray(value) && value.length === 0) {
      continue;
    } else if (!value) {
      continue;
    }
    if (key === 'workdir' && value === '.') {
      continue;
    }
    res[key] = value;
  }
  return res;
}

export async function getArgs(inputs: Inputs, definition: BakeDefinition, toolkit: Toolkit): Promise<Array<string>> {
  // prettier-ignore
  return [
    ...await getBakeArgs(inputs, definition, toolkit),
    ...await getCommonArgs(inputs),
    ...inputs.targets
  ];
}

async function getBakeArgs(inputs: Inputs, definition: BakeDefinition, toolkit: Toolkit): Promise<Array<string>> {
  const args: Array<string> = ['bake'];
  if (inputs.source) {
    args.push(inputs.source);
  }
  if (await toolkit.buildx.versionSatisfies('>=0.17.0')) {
    if (inputs.allow.length > 0) {
      args.push('--allow', inputs.allow.join(','));
    }
  }
  await Util.asyncForEach(inputs.files, async file => {
    args.push('--file', file);
  });
  await Util.asyncForEach(inputs.set, async set => {
    args.push('--set', set);
  });
  if (await toolkit.buildx.versionSatisfies('>=0.6.0')) {
    args.push('--metadata-file', toolkit.buildxBake.getMetadataFilePath());
  }
  if (await toolkit.buildx.versionSatisfies('>=0.10.0')) {
    if (inputs.provenance) {
      args.push('--provenance', inputs.provenance);
    } else if ((await toolkit.buildkit.versionSatisfies(inputs.builder, '>=0.11.0')) && !Bake.hasDockerExporter(definition, inputs.load)) {
      // if provenance not specified and BuildKit version compatible for
      // attestation, set default provenance. Also needs to make sure user
      // doesn't want to explicitly load the image to docker.
      if (GitHub.context.payload.repository?.private ?? false) {
        // if this is a private repository, we set the default provenance
        // attributes being set in buildx: https://github.com/docker/buildx/blob/fb27e3f919dcbf614d7126b10c2bc2d0b1927eb6/build/build.go#L603
        args.push('--provenance', Build.resolveProvenanceAttrs(`mode=min,inline-only=true`));
      } else {
        // for a public repository, we set max provenance mode.
        args.push('--provenance', Build.resolveProvenanceAttrs(`mode=max`));
      }
    }
    if (inputs.sbom) {
      args.push('--sbom', inputs.sbom);
    }
  }
  return args;
}

async function getCommonArgs(inputs: Inputs): Promise<Array<string>> {
  const args: Array<string> = [];
  if (inputs['no-cache']) {
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

function getSourceInput(name: string): string {
  let source = handlebars.compile(core.getInput(name))({
    defaultContext: Context.gitContext()
  });
  if (source === '.') {
    source = '';
  }
  return source;
}
