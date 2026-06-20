import {BakeDefinition} from '@docker/actions-toolkit/lib/types/buildx/bake.js';

export class DependencyGraph {
  readonly definition: BakeDefinition;
  private _maxDepth: number = -1;
  private predecessors: Record<string, Set<string>> = {};

  get maxDepth(): number {
    if (this._maxDepth == -1) {
      const depths: Array<number> = [];
      for (const targetName in this.predecessors) {
        depths.push(this.getMaxDepth(targetName));
      }
      this._maxDepth = Math.max(...depths, 0);
    }

    return this._maxDepth;
  }

  constructor(definition: BakeDefinition) {
    this.definition = definition;

    for (const targetName in this.definition.target) {
      this.predecessors[targetName] = this.getTargetDependencies(targetName);
    }
  }

  private getTargetDependencies(targetName: string): Set<string> {
    const result = new Set<string>();
    const contexts = this.definition.target[targetName].contexts;
    if (!contexts) {
      return result;
    }
    for (const context of Object.values(contexts)) {
      if (!context.startsWith('target:')) {
        continue;
      }
      result.add(context.substring(7));
    }
    return result;
  }

  private getMaxDepth(targetName: string): number {
    const targets: Array<number> = [];
    for (const predecessor of this.predecessors[targetName]) {
      targets.push(this.getMaxDepth(predecessor) + 1);
    }
    return Math.max(...targets, 1);
  }

  private getTargetsWithoutDependencies(): Set<string> {
    const result = new Set<string>();
    for (const targetName in this.predecessors) {
      if (this.predecessors[targetName].size == 0) {
        result.add(targetName);
      }
    }
    return result;
  }

  private getReadyTargets(finishedTargets: Array<string>): Set<string> {
    if (finishedTargets.length == 0) {
      return this.getTargetsWithoutDependencies();
    }

    const result = new Set<string>();
    for (const targetName in this.predecessors) {
      if (finishedTargets.includes(targetName)) {
        continue;
      }
      let ready = true;
      for (const dependency of this.predecessors[targetName].values()) {
        if (!finishedTargets.includes(dependency)) {
          ready = false;
          break;
        }
      }
      if (ready) {
        result.add(targetName);
      }
    }
    return result;
  }

  getLayeredMatrix(): Array<Array<string>> {
    const result: Array<Array<string>> = [];
    let targets: Set<string> = this.getReadyTargets([]);
    while (targets.size > 0) {
      result.push([...targets]);
      targets = this.getReadyTargets(result.flat());
    }
    return result;
  }
}
