import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { SystemMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { assertAdvertisedToolsRegistered } from '../src/agent-utils.ts';

const planningTool = tool(() => 'Planning rows', {
  name: 'query_financial_planning',
  description: 'Load planning data',
  schema: z.object({}),
});
const systemPrompt = `Tool boundary:
- Available tools in this run: query_financial_planning, run_sql.
- Never fabricate tool results.`;

test('advertised tools cannot be omitted, empty, or only partly registered', () => {
  for (const tools of [undefined, [], [planningTool]]) {
    assert.throws(
      () => assertAdvertisedToolsRegistered({ systemPrompt, tools }),
      (error: Error) => {
        assert.match(
          error.message,
          /not registered with createAgent: .*run_sql/,
        );
        assert.match(error.message, /replace tools: \[\] with tools/);
        if (!tools?.length) {
          assert.match(error.message, /query_financial_planning, run_sql/);
        } else {
          assert.doesNotMatch(
            error.message,
            /not registered with createAgent: query_financial_planning/,
          );
        }
        return true;
      },
    );
  }
});

test('SystemMessage prompts enforce the same tool inventory', () => {
  assert.throws(
    () =>
      assertAdvertisedToolsRegistered({
        systemPrompt: new SystemMessage(systemPrompt),
        tools: [planningTool],
      }),
    /not registered with createAgent: run_sql\./,
  );
});
