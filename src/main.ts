import * as fs from 'fs';
import * as core from '@actions/core';
import * as actionsToolkit from '@docker/actions-toolkit';
import {Inputs as BuildxInputs} from '@docker/actions-toolkit/lib/buildx/inputs';
import {Context} from '@docker/actions-toolkit/lib/context';
import {Docker} from '@docker/actions-toolkit/lib/docker/docker';
import {Exec} from '@docker/actions-toolkit/lib/exec';
import {GitHub} from '@docker/actions-toolkit/lib/github';
import {Toolkit} from '@docker/actions-toolkit/lib/toolkit';

import * as context from './context';
import * as stateHelper from './state-helper';

actionsToolkit.run(
  // main
  async () => {
    const inputs: context.Inputs = await context.getInputs();
    const toolkit = new Toolkit();

    await core.group(`GitHub Actions runtime token ACs`, async () => {
      try {
        await GitHub.printActionsRuntimeTokenACs();
      } catch (e) {
        core.warning(e.message);
      }
    });

    await core.group(`Docker info`, async () => {
      try {
        await Docker.printVersion();
        await Docker.printInfo();
      } catch (e) {
        core.info(e.message);
      }
    });

    if (!(await toolkit.buildx.isAvailable())) {
      core.setFailed(`Docker buildx is required. See https://github.com/docker/setup-buildx-action to set up buildx.`);
      return;
    }

    stateHelper.setTmpDir(Context.tmpDir());

    await core.group(`Buildx version`, async () => {
      await toolkit.buildx.printVersion();
    });

    const args: string[] = await context.getArgs(inputs, toolkit);
    const buildCmd = await toolkit.buildx.getCommand(args);

    await core.group(`Bake definition`, async () => {
      await Exec.exec(buildCmd.command, [...buildCmd.args, '--print'], {
        cwd: inputs.workdir
      });
    });

    await Exec.getExecOutput(buildCmd.command, buildCmd.args, {
      cwd: inputs.workdir,
      ignoreReturnCode: true
    }).then(res => {
      core.setOutput('stderr', res.stderr);
      if (res.stderr.length > 0 && res.exitCode != 0) {
        throw new Error(`buildx bake failed with: ${res.stderr.match(/(.*)\s*$/)?.[0]?.trim() ?? 'unknown error'}`);
      }
    });

    const metadata = await BuildxInputs.resolveBuildMetadata();
    if (metadata) {
      await core.group(`Metadata`, async () => {
        core.info(metadata);
        core.setOutput('metadata', metadata);
      });
    }
  },
  // post
  async () => {
    if (stateHelper.tmpDir.length > 0) {
      await core.group(`Removing temp folder ${stateHelper.tmpDir}`, async () => {
        fs.rmSync(stateHelper.tmpDir, {recursive: true});
      });
    }
  }
);
