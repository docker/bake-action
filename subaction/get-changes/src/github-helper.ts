import * as github from '@actions/github';

import {PullRequestEvent, PushEvent} from '@octokit/webhooks-definitions/schema.js';

import {fetchCommit, getFileFromCommit} from './git-helper.js';

// HEAD commit before push or HEAD commit of base branch for PRs
export const baseCommit = getBaseCommit();
export const isFirstPush = baseCommit.length === 0;

function getBaseCommit(): string {
  switch (github.context.eventName) {
    case 'push':
      return (github.context.payload as PushEvent).before;
    case 'pull_request':
      return (github.context.payload as PullRequestEvent).pull_request.base.sha;

    default:
      throw new Error(`Unexpected event '${github.context.eventName}'. Only 'push' and 'pull_request' events are supported.`);
  }
}

export async function getBaseBakeDefinitionFiles(workdir: string, files: Array<string>): Promise<Array<string>> {
  const result: Array<string> = [];
  // first push doesn't have a previous commit
  if (isFirstPush) {
    return result;
  }
  await fetchCommit(workdir, baseCommit);
  for (const file of files) {
    const filePath = await getFileFromCommit(workdir, file, baseCommit);
    if (filePath) {
      result.push(filePath);
    }
  }

  return result;
}
