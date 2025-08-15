import * as fs from 'fs';
import * as path from 'path';
import * as core from '@actions/core';
import * as actionsToolkit from '@docker/actions-toolkit';

import {Buildx} from '@docker/actions-toolkit/lib/buildx/buildx';
import {History as BuildxHistory} from '@docker/actions-toolkit/lib/buildx/history';
import {Context} from '@docker/actions-toolkit/lib/context';
import {Docker} from '@docker/actions-toolkit/lib/docker/docker';
import {Exec} from '@docker/actions-toolkit/lib/exec';
import {GitHub} from '@docker/actions-toolkit/lib/github';
import {Toolkit} from '@docker/actions-toolkit/lib/toolkit';
import {Util} from '@docker/actions-toolkit/lib/util';

import {BakeDefinition} from '@docker/actions-toolkit/lib/types/buildx/bake';
import {BuilderInfo} from '@docker/actions-toolkit/lib/types/buildx/builder';
import {ConfigFile} from '@docker/actions-toolkit/lib/types/docker/docker';
import {UploadArtifactResponse} from '@docker/actions-toolkit/lib/types/github';

import * as context from './context';
import * as stateHelper from './state-helper';

actionsToolkit.run(
  // main
  async () => {
    const startedTime = new Date();

    const inputs: context.Inputs = await context.getInputs();
    stateHelper.setSummaryInputs(inputs);
    core.debug(`inputs: ${JSON.stringify(inputs)}`);

    const toolkit = new Toolkit();
    const gitAuthToken = process.env.BUILDX_BAKE_GIT_AUTH_TOKEN ?? inputs['github-token'];

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

    await core.group(`Proxy configuration`, async () => {
      let dockerConfig: ConfigFile | undefined;
      let dockerConfigMalformed = false;
      try {
        dockerConfig = await Docker.configFile();
      } catch (e) {
        dockerConfigMalformed = true;
        core.warning(`Unable to parse config file ${path.join(Docker.configDir, 'config.json')}: ${e}`);
      }
      if (dockerConfig && dockerConfig.proxies) {
        for (const host in dockerConfig.proxies) {
          let prefix = '';
          if (Object.keys(dockerConfig.proxies).length > 1) {
            prefix = '  ';
            core.info(host);
          }
          for (const key in dockerConfig.proxies[host]) {
            core.info(`${prefix}${key}: ${dockerConfig.proxies[host][key]}`);
          }
        }
      } else if (!dockerConfigMalformed) {
        core.info('No proxy configuration found');
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

    let builder: BuilderInfo;
    await core.group(`Builder info`, async () => {
      builder = await toolkit.builder.inspect(inputs.builder);
      stateHelper.setBuilderDriver(builder.driver ?? '');
      stateHelper.setBuilderEndpoint(builder.nodes?.[0]?.endpoint ?? '');
      core.info(JSON.stringify(builder, null, 2));
    });

    let definition: BakeDefinition | undefined;
    await core.group(`Parsing raw definition`, async () => {
      definition = await toolkit.buildxBake.getDefinition(
        {
          allow: inputs.allow,
          files: inputs.files,
          load: inputs.load,
          noCache: inputs['no-cache'],
          overrides: inputs.set,
          provenance: inputs.provenance,
          push: inputs.push,
          sbom: inputs.sbom,
          source: inputs.source,
          targets: inputs.targets,
          githubToken: gitAuthToken
        },
        {
          cwd: inputs.workdir
        }
      );
    });
    if (!definition) {
      throw new Error('Bake definition not set');
    }
    stateHelper.setBakeDefinition(definition);

    const args: string[] = await context.getArgs(inputs, definition, toolkit);
    const buildCmd = await toolkit.buildx.getCommand(args);
    const buildEnv = Object.assign({}, process.env, {
      BUILDX_BAKE_GIT_AUTH_TOKEN: gitAuthToken,
      BUILDX_METADATA_WARNINGS: 'true'
    }) as {
      [key: string]: string;
    };

    await core.group(`Bake definition`, async () => {
      await Exec.getExecOutput(buildCmd.command, [...buildCmd.args, '--print'], {
        cwd: inputs.workdir,
        env: buildEnv,
        ignoreReturnCode: true
      }).then(res => {
        if (res.stderr.length > 0 && res.exitCode != 0) {
          throw Error(res.stderr);
        }
      });
    });

    let err: Error | undefined;
    await Exec.getExecOutput(buildCmd.command, buildCmd.args, {
      cwd: inputs.workdir,
      env: buildEnv,
      ignoreReturnCode: true
    }).then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        err = Error(`buildx bake failed with: ${res.stderr.match(/(.*)\s*$/)?.[0]?.trim() ?? 'unknown error'}`);
      }
    });

    const metadata = toolkit.buildxBake.resolveMetadata();
    if (metadata) {
      await core.group(`Metadata`, async () => {
        const metadatadt = JSON.stringify(metadata, null, 2);
        core.info(metadatadt);
        core.setOutput('metadata', metadatadt);
      });
    }

    let refs: Array<string> = [];
    await core.group(`Build references`, async () => {
      refs = await buildRefs(toolkit, startedTime, inputs.builder);
      if (refs.length > 0) {
        for (const ref of refs) {
          core.info(ref);
        }
        stateHelper.setBuildRefs(refs);
      } else {
        core.info('No build references found');
      }
    });

    if (buildChecksAnnotationsEnabled()) {
      const warnings = toolkit.buildxBake.resolveWarnings(metadata);
      if (refs.length > 0 && warnings && warnings.length > 0) {
        const annotations = await Buildx.convertWarningsToGitHubAnnotations(warnings, refs);
        core.debug(`annotations: ${JSON.stringify(annotations, null, 2)}`);
        if (annotations && annotations.length > 0) {
          await core.group(`Generating GitHub annotations (${annotations.length} build checks found)`, async () => {
            for (const annotation of annotations) {
              core.warning(annotation.message, annotation);
            }
          });
        }
      }
    }

    await core.group(`Check build summary support`, async () => {
      if (!buildSummaryEnabled()) {
        core.info('Build summary disabled');
      } else if (GitHub.isGHES) {
        core.info('Build summary is not yet supported on GHES');
      } else if (!(await toolkit.buildx.versionSatisfies('>=0.13.0'))) {
        core.info('Build summary requires Buildx >= 0.13.0');
      } else if (builder && builder.driver === 'kubernetes') {
        core.info('Build summary is not yet supported by the Kubernetes driver');
      } else if (refs.length == 0) {
        core.info('Build summary requires at least one build reference');
      } else {
        core.info('Build summary supported!');
        stateHelper.setSummarySupported();
      }
    });

    if (err) {
      throw err;
    }
  },
  // post
  async () => {
    if (stateHelper.isSummarySupported) {
      await core.group(`Generating build summary`, async () => {
        try {
          const recordUploadEnabled = buildRecordUploadEnabled();
          let recordRetentionDays: number | undefined;
          if (recordUploadEnabled) {
            recordRetentionDays = buildRecordRetentionDays();
          }

          const buildxHistory = new BuildxHistory();
          const exportRes = await buildxHistory.export({
            refs: stateHelper.buildRefs,
            useContainer: buildExportLegacy()
          });
          core.info(`Build records written to ${exportRes.dockerbuildFilename} (${Util.formatFileSize(exportRes.dockerbuildSize)})`);

          let uploadRes: UploadArtifactResponse | undefined;
          if (recordUploadEnabled) {
            uploadRes = await GitHub.uploadArtifact({
              filename: exportRes.dockerbuildFilename,
              mimeType: 'application/gzip',
              retentionDays: recordRetentionDays
            });
          }

          await GitHub.writeBuildSummary({
            exportRes: exportRes,
            uploadRes: uploadRes,
            inputs: stateHelper.summaryInputs,
            bakeDefinition: stateHelper.bakeDefinition,
            driver: stateHelper.builderDriver,
            endpoint: stateHelper.builderEndpoint
          });
        } catch (e) {
          core.warning(e.message);
        }
      });
    }
    if (stateHelper.tmpDir.length > 0) {
      await core.group(`Removing temp folder ${stateHelper.tmpDir}`, async () => {
        fs.rmSync(stateHelper.tmpDir, {recursive: true});
      });
    }
  }
);

async function buildRefs(toolkit: Toolkit, since: Date, builder?: string): Promise<Array<string>> {
  // get refs from metadata file
  const metaRefs = toolkit.buildxBake.resolveRefs();
  if (metaRefs) {
    return metaRefs;
  }
  // otherwise, look for the very first build ref since the build has started
  if (!builder) {
    const currentBuilder = await toolkit.builder.inspect();
    builder = currentBuilder.name;
  }
  const res = Buildx.refs({
    dir: Buildx.refsDir,
    builderName: builder,
    since: since
  });
  const refs: Array<string> = [];
  for (const ref in res) {
    if (Object.prototype.hasOwnProperty.call(res, ref)) {
      refs.push(ref);
    }
  }
  return refs;
}

function buildChecksAnnotationsEnabled(): boolean {
  if (process.env.DOCKER_BUILD_CHECKS_ANNOTATIONS) {
    return Util.parseBool(process.env.DOCKER_BUILD_CHECKS_ANNOTATIONS);
  }
  return true;
}

function buildSummaryEnabled(): boolean {
  if (process.env.DOCKER_BUILD_NO_SUMMARY) {
    core.warning('DOCKER_BUILD_NO_SUMMARY is deprecated. Set DOCKER_BUILD_SUMMARY to false instead.');
    return !Util.parseBool(process.env.DOCKER_BUILD_NO_SUMMARY);
  } else if (process.env.DOCKER_BUILD_SUMMARY) {
    return Util.parseBool(process.env.DOCKER_BUILD_SUMMARY);
  }
  return true;
}

function buildRecordUploadEnabled(): boolean {
  if (process.env.DOCKER_BUILD_RECORD_UPLOAD) {
    return Util.parseBool(process.env.DOCKER_BUILD_RECORD_UPLOAD);
  }
  return true;
}

function buildRecordRetentionDays(): number | undefined {
  let val: string | undefined;
  if (process.env.DOCKER_BUILD_EXPORT_RETENTION_DAYS) {
    core.warning('DOCKER_BUILD_EXPORT_RETENTION_DAYS is deprecated. Use DOCKER_BUILD_RECORD_RETENTION_DAYS instead.');
    val = process.env.DOCKER_BUILD_EXPORT_RETENTION_DAYS;
  } else if (process.env.DOCKER_BUILD_RECORD_RETENTION_DAYS) {
    val = process.env.DOCKER_BUILD_RECORD_RETENTION_DAYS;
  }
  if (val) {
    const res = parseInt(val);
    if (isNaN(res)) {
      throw Error(`Invalid build record retention days: ${val}`);
    }
    return res;
  }
}

function buildExportLegacy(): boolean {
  if (process.env.DOCKER_BUILD_EXPORT_LEGACY) {
    return Util.parseBool(process.env.DOCKER_BUILD_EXPORT_LEGACY);
  }
  return false;
}
