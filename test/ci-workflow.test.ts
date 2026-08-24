import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

import { parse } from "yaml";

type WorkflowStep = {
  name?: string;
  run?: string;
  uses?: string;
  with?: Record<string, string | number>;
};

type BackendWorkflow = {
  name: string;
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  concurrency: Record<string, string | boolean>;
  jobs: {
    checks: {
      "runs-on": string;
      "timeout-minutes": number;
      steps: WorkflowStep[];
    };
  };
};

test("pull request workflow runs the complete backend verification gate", async () => {
  const workflowPath = resolve(process.cwd(), ".github/workflows/backend-ci.yml");
  const workflow = parse(await readFile(workflowPath, "utf8")) as BackendWorkflow;

  assert.equal(workflow.name, "Backend CI");
  assert.deepEqual(Object.keys(workflow.on).sort(), ["pull_request", "workflow_dispatch"]);
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.equal(workflow.concurrency["cancel-in-progress"], true);

  const job = workflow.jobs.checks;
  assert.equal(job["runs-on"], "ubuntu-latest");
  assert.equal(job["timeout-minutes"], 15);
  assert.equal(job.steps[0]?.uses, "actions/checkout@v4");

  const setupNode = job.steps.find((step) => step.uses === "actions/setup-node@v4");
  assert.deepEqual(setupNode?.with, {
    "node-version": 20,
    cache: "npm",
    "cache-dependency-path": "package-lock.json",
  });

  assert.deepEqual(
    job.steps.flatMap((step) => (step.run ? [step.run] : [])),
    [
      "npm ci",
      "npm run typecheck",
      "npm run build",
      "npm test",
      "npx prisma validate",
      "npx prisma generate",
      "npm audit --audit-level=high",
    ],
  );
});
