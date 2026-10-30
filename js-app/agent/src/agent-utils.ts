import type { AIMessage } from '@langchain/core/messages';
import type { createAgent } from 'langchain';

type ToolConfiguration = Pick<
  Parameters<typeof createAgent>[0],
  'systemPrompt' | 'tools'
>;

/** Checks the explicit tool inventory emitted by systemPromptForTools. */
export function assertAdvertisedToolsRegistered({
  systemPrompt,
  tools = [],
}: ToolConfiguration): void {
  const prompt =
    typeof systemPrompt === 'string' ? systemPrompt : systemPrompt?.text;
  const inventory = prompt?.match(/^- Available tools in this run: (.+)\.$/m);
  if (!inventory) return;

  const registeredNames = new Set(
    tools.flatMap((tool) => ('name' in tool ? [tool.name] : [])),
  );
  const missingTools = inventory[1]
    .split(', ')
    .filter((name) => !registeredNames.has(name));
  if (missingTools.length > 0) {
    throw new Error(
      `Agent configuration error: systemPromptForTools advertises tools that are not registered with createAgent: ${missingTools.join(', ')}. In buildFinancialAgent(), replace tools: [] with tools and use the same tools array for systemPromptForTools(tools) and createAgent({ ..., tools }).`,
    );
  }
}

/** Return displayable text only; keep signed reasoning blocks on the original message for round-trips. */
export function visibleReasoning(message: AIMessage): string[] {
  const blocks: unknown = message.additional_kwargs.reasoning_content;
  if (!Array.isArray(blocks)) return [];

  const thoughts: string[] = [];
  for (const block of blocks) {
    if (
      block !== null &&
      typeof block === 'object' &&
      'content' in block &&
      typeof block.content === 'string' &&
      block.content
    ) {
      thoughts.push(block.content);
    }
  }
  return thoughts;
}
