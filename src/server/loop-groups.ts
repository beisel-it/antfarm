import type { StepInfo } from "../installer/status.js";

export type LoopGroup = {
  loopStepId: string;
  verifyStepId: string | null;
  stepIds: string[];
};

export function computeLoopGroups(steps: StepInfo[]): LoopGroup[] {
  const groups: LoopGroup[] = [];
  for (const step of steps) {
    if (step.type !== "loop") continue;
    let verifyStepId: string | null = null;
    if (step.loop_config) {
      try {
        const lc = JSON.parse(step.loop_config) as { verifyStep?: string; verifyEach?: boolean };
        if (lc.verifyStep) {
          const verifyStep = steps.find((s) => s.step_id === lc.verifyStep);
          verifyStepId = verifyStep?.id ?? null;
        }
      } catch { /* ignore malformed JSON */ }
    }
    const stepIds = [step.id];
    if (verifyStepId) stepIds.push(verifyStepId);
    groups.push({ loopStepId: step.id, verifyStepId, stepIds });
  }
  return groups;
}
