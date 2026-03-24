import type { AppDatabase } from "../db/index.js";
import { SopService } from "./sop-service.js";

export interface SopExecutionContext {
  agentId: string;
  taskId: string;
  sopId: string;
  variables: Record<string, unknown>;
}

export interface StepResult {
  success: boolean;
  output?: unknown;
  error?: string;
  nextAction?: "continue" | "wait" | "complete" | "fail";
}

export type StepHandler = (
  stepConfig: Record<string, unknown>,
  context: SopExecutionContext
) => Promise<StepResult>;

export class SopExecutor {
  private sopService: SopService;
  private stepHandlers = new Map<string, StepHandler>();

  constructor(sopService: SopService) {
    this.sopService = sopService;
  }

  registerStepHandler(actionType: string, handler: StepHandler) {
    this.stepHandlers.set(actionType, handler);
  }

  async executeStep(
    stepId: string,
    context: SopExecutionContext
  ): Promise<StepResult> {
    const step = await this.sopService.getStepById(stepId);
    if (!step) {
      return { success: false, error: `Step ${stepId} not found`, nextAction: "fail" };
    }

    if (step.condition) {
      const conditionMet = this.evaluateCondition(step.condition, context);
      if (!conditionMet) {
        if (step.nextStepOnFail) {
          return { success: true, nextAction: "continue", output: { skipTo: step.nextStepOnFail } };
        }
        return { success: false, error: "Step condition not met", nextAction: "fail" };
      }
    }

    const handler = this.stepHandlers.get(step.actionType);
    if (!handler) {
      return {
        success: false,
        error: `No handler registered for action type: ${step.actionType}`,
        nextAction: "fail",
      };
    }

    const config = JSON.parse(step.actionConfig);
    const result = await handler(config, context);

    if (result.success && result.nextAction === "continue" && step.nextStepId) {
      return { ...result, output: { ...result.output as any, nextStepId: step.nextStepId } };
    }

    return result;
  }

  async executeSop(
    sopId: string,
    context: Omit<SopExecutionContext, "sopId">
  ): Promise<{ success: boolean; results: StepResult[]; error?: string }> {
    const firstStep = await this.sopService.getFirstStep(sopId);
    if (!firstStep) {
      return { success: false, results: [], error: "SOP has no steps" };
    }

    const execContext: SopExecutionContext = { ...context, sopId };
    const results: StepResult[] = [];
    let currentStepId: string | null = firstStep.id;

    while (currentStepId) {
      const result = await this.executeStep(currentStepId, execContext);
      results.push(result);

      if (!result.success || result.nextAction === "fail") {
        return { success: false, results, error: result.error };
      }

      if (result.nextAction === "wait") {
        return { success: true, results };
      }

      if (result.nextAction === "complete" || !result.output) {
        return { success: true, results };
      }

      const output = result.output as any;
      currentStepId = output?.skipTo || output?.nextStepId || null;
    }

    return { success: true, results };
  }

  private evaluateCondition(
    condition: string,
    context: SopExecutionContext
  ): boolean {
    try {
      const vars = context.variables || {};
      if (condition.startsWith("var:")) {
        const varName = condition.slice(4).trim();
        return Boolean(vars[varName]);
      }
      if (condition === "always") return true;
      if (condition === "never") return false;
      return true;
    } catch {
      return false;
    }
  }
}
