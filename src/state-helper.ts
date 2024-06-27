import * as core from '@actions/core';

import {BakeDefinition} from '@docker/actions-toolkit/lib/types/buildx/bake';

import {Inputs, sanitizeInputs} from './context';

export const tmpDir = process.env['STATE_tmpDir'] || '';
export const inputs = process.env['STATE_inputs'] ? JSON.parse(process.env['STATE_inputs']) : undefined;
export const bakeDefinition = process.env['STATE_bakeDefinition'] ? <BakeDefinition>JSON.parse(process.env['STATE_bakeDefinition']) : undefined;
export const buildRefs = process.env['STATE_buildRefs'] ? process.env['STATE_buildRefs'].split(',') : [];
export const isSummarySupported = !!process.env['STATE_isSummarySupported'];

export function setTmpDir(tmpDir: string) {
  core.saveState('tmpDir', tmpDir);
}

export function setInputs(inputs: Inputs) {
  core.saveState('inputs', JSON.stringify(sanitizeInputs(inputs)));
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
