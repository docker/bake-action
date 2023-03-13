import * as core from '@actions/core';
import {Bake} from '@docker/actions-toolkit/lib/buildx/bake';
import {Inputs as BuildxInputs} from '@docker/actions-toolkit/lib/buildx/inputs';
import {GitHub} from '@docker/actions-toolkit/lib/github';
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
  provenance: string;
  push: boolean;
  sbom: string;
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
    provenance: BuildxInputs.getProvenanceInput('provenance'),
    push: core.getBooleanInput('push'),
    sbom: core.getInput('sbom'),
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
    args.push('--metadata-file', BuildxInputs.getBuildMetadataFilePath());
  }
  if (await toolkit.buildx.versionSatisfies('>=0.10.0')) {
    const bakedef = await toolkit.bake.parseDefinitions([...inputs.files, inputs.source], inputs.targets, inputs.workdir);
    if (inputs.provenance) {
      args.push('--provenance', inputs.provenance);
    } else if ((await toolkit.buildkit.versionSatisfies(inputs.builder, '>=0.11.0')) && !Bake.hasDockerExporter(bakedef, inputs.load)) {
      // if provenance not specified and BuildKit version compatible for
      // attestation, set default provenance. Also needs to make sure user
      // doesn't want to explicitly load the image to docker.
      if (GitHub.context.payload.repository?.private ?? false) {
        // if this is a private repository, we set the default provenance
        // attributes being set in buildx: https://github.com/docker/buildx/blob/fb27e3f919dcbf614d7126b10c2bc2d0b1927eb6/build/build.go#L603
        args.push('--provenance', BuildxInputs.resolveProvenanceAttrs(`mode=min,inline-only=true`));
      } else {
        // for a public repository, we set max provenance mode.
        args.push('--provenance', BuildxInputs.resolveProvenanceAttrs(`mode=max`));
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
