import * as core from '@actions/core';

import {BakeDefinition} from '@docker/actions-toolkit/lib/types/buildx/bake';

import {Inputs} from './context';

export const tmpDir = process.env['STATE_tmpDir'] || '';

export const builderDriver = process.env['STATE_builderDriver'] || '';
export const builderEndpoint = process.env['STATE_builderEndpoint'] || '';
export const summaryInputs = process.env['STATE_summaryInputs'] ? JSON.parse(process.env['STATE_summaryInputs']) : undefined;
export const bakeDefinition = process.env['STATE_bakeDefinition'] ? <BakeDefinition>JSON.parse(process.env['STATE_bakeDefinition']) : undefined;

export const buildRefs = process.env['STATE_buildRefs'] ? process.env['STATE_buildRefs'].split(',') : [];
export const isSummarySupported = !!process.env['STATE_isSummarySupported'];

export function setTmpDir(tmpDir: string) {
  core.saveState('tmpDir', tmpDir);
}

export function setBuilderDriver(builderDriver: string) {
  core.saveState('builderDriver', builderDriver);
}

export function setBuilderEndpoint(builderEndpoint: string) {
  core.saveState('builderEndpoint', builderEndpoint);
}

export function setBakeDefinition(bakeDefinition: BakeDefinition) {
  core.saveState('bakeDefinition', JSON.stringify(bakeDefinition));
}

export function setBuildRefs(buildRefs: Array<string>) {
  core.saveState('buildRefs', buildRefs.join(','));
}

export function setSummarySupported() {
  core.saveState('isSummarySupported', 'true');
}

export function setSummaryInputs(inputs: Inputs) {
  const res = {};
  for (const key of Object.keys(inputs)) {
    if (key === 'github-token') {
      continue;
    }
    const value: string | string[] | boolean = inputs[key];
    if (typeof value === 'boolean' && !value) {
      continue;
    } else if (Array.isArray(value) && value.length === 0) {
      continue;
    } else if (!value) {
      continue;
    }
    res[key] = value;
  }
  core.saveState('summaryInputs', JSON.stringify(res));
}
