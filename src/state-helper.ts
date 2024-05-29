import * as core from '@actions/core';

import {BakeDefinition} from '@docker/actions-toolkit/lib/types/buildx/bake';
import {BuilderInfo} from '@docker/actions-toolkit/lib/types/buildx/builder';

import {Inputs, sanitizeInputs} from './context';

export const tmpDir = process.env['STATE_tmpDir'] || '';
export const inputs = process.env['STATE_inputs'] ? JSON.parse(process.env['STATE_inputs']) : undefined;
export const builder = process.env['STATE_builder'] ? <BuilderInfo>JSON.parse(process.env['STATE_builder']) : undefined;
export const bakeDefinition = process.env['STATE_bakeDefinition'] ? <BakeDefinition>JSON.parse(process.env['STATE_bakeDefinition']) : undefined;
export const buildRefs = process.env['STATE_buildRefs'] ? process.env['STATE_buildRefs'].split(',') : [];

export function setTmpDir(tmpDir: string) {
  core.saveState('tmpDir', tmpDir);
}

export function setInputs(inputs: Inputs) {
  core.saveState('inputs', JSON.stringify(sanitizeInputs(inputs)));
}

export function setBuilder(builder: BuilderInfo) {
  core.saveState('builder', JSON.stringify(builder));
}

export function setBakeDefinition(bakeDefinition: BakeDefinition) {
  core.saveState('bakeDefinition', JSON.stringify(bakeDefinition));
}

export function setBuildRefs(buildRefs: Array<string>) {
  core.saveState('buildRefs', buildRefs.join(','));
}
