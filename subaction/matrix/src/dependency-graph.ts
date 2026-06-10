import {BakeDefinition} from '@docker/actions-toolkit/lib/types/buildx/bake.js';

export class DependencyGraph {
  readonly definition: BakeDefinition;
  private _maxDepth: number = -1;
  private edges: Record<string, Set<string>> = {};

  get maxDepth(): number {
    if (this._maxDepth == -1) {
      const depths: Array<number> = [];
      for (const targetName in this.edges) {
        depths.push(this.getMaxDepth(targetName));
      }
      this._maxDepth = Math.max(...depths, 0);
    }

    return this._maxDepth;
  }

  constructor(definition: BakeDefinition) {
    this.definition = definition;

    this.populateEdges();
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

  private populateEdges(): void {
    for (const targetName in this.definition.target) {
      this.edges[targetName] = new Set();
    }
    for (const targetName in this.definition.target) {
      this.getTargetDependencies(targetName).forEach(dep => this.edges[dep].add(targetName));
    }
  }

  private getMaxDepth(targetName: string): number {
    const targets: Array<number> = [];
    for (const successor of this.edges[targetName]) {
      targets.push(this.getMaxDepth(successor) + 1);
    }
    return Math.max(...targets, 1);
  }

  private targetDependsOn(targetName: string, other: string): boolean {
    const deps: Array<string> = [...this.edges[other]];
    return deps.some(successorName => successorName == targetName || this.targetDependsOn(targetName, successorName));
  }

  private withoutDependencies(targets: Set<string>): Set<string> {
    const originalTargets = [...targets];
    for (const firstTarget of originalTargets) {
      for (const secondTarget of originalTargets) {
        if (firstTarget == secondTarget) {
          continue;
        }
        if (this.targetDependsOn(firstTarget, secondTarget)) {
          targets.delete(firstTarget);
          return this.withoutDependencies(targets);
        }
      }
    }
    return targets;
  }

  private flattenTargets(targets: Array<string>): Array<string> {
    const result: Array<string> = [];
    for (const name of targets) {
      if (name in this.definition.group) {
        if (name in this.definition.target && this.definition.group[name].targets.every(result.includes)) {
          continue;
        }
        result.push(...this.flattenTargets(this.definition.group[name].targets));
      } else {
        result.push(name);
      }
    }
    return result;
  }

  private getReadyTargets(finishedTargets: Array<Array<string>>, previousTarget: string): Set<string> {
    const result = new Set<string>();
    const flatFinishedTargets = finishedTargets.flat();
    for (const targetName of this.edges[previousTarget]) {
      const dependencies = [...this.getTargetDependencies(targetName)];
      let ready = true;
      for (const dependency of dependencies) {
        if (!flatFinishedTargets.includes(dependency)) {
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

  getProcessMatrices(...affectedTargets: Array<string>): Array<Array<string>> {
    const result: Array<Array<string>> = [];
    let targets: Set<string> = new Set(this.flattenTargets(affectedTargets));
    targets = this.withoutDependencies(targets);
    while (targets.size > 0) {
      const latestTargets = [...targets];
      result.push(latestTargets);
      targets.clear();
      for (const targetName of latestTargets) {
        if (!(targetName in this.edges)) {
          continue;
        }
        targets = targets.union(this.getReadyTargets(result, targetName));
      }
    }
    return result;
  }

  getLayeredMatrix(): Array<Array<string>> {
    return this.getProcessMatrices(...Object.keys(this.definition.target));
  }
}
