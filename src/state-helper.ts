import * as core from '@actions/core';

export const tmpDir = process.env['STATE_tmpDir'] || '';
export const buildRefs = process.env['STATE_buildRefs'] ? process.env['STATE_buildRefs'].split(',') : [];

export function setTmpDir(tmpDir: string) {
  core.saveState('tmpDir', tmpDir);
}

export function setBuildRefs(buildRefs: Array<string>) {
  core.saveState('buildRefs', buildRefs.join(','));
}
