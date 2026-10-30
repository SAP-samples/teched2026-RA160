import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { AIMessage } from '@langchain/core/messages';
import { visibleReasoning } from '../src/agent-utils.ts';

describe('visible reasoning from orchestration messages', () => {
  it('displays only the text of signed reasoning blocks, separate from the answer', () => {
    const message = new AIMessage({
      content: 'The answer is 42.',
      additional_kwargs: {
        reasoning_content: [
          {
            content: 'First, compute the result.',
            signature: 'private-signature',
          },
          { signature: 'encrypted-thinking' },
          { content: 'Then check it.' },
        ],
      },
    });

    assert.deepEqual(visibleReasoning(message), [
      'First, compute the result.',
      'Then check it.',
    ]);
    assert.equal(
      message.additional_kwargs.reasoning_content?.[0].signature,
      'private-signature',
    );
  });

  it('does not display encrypted-only reasoning or infer thoughts from the answer', () => {
    assert.deepEqual(
      visibleReasoning(
        new AIMessage({
          content: 'Answer only',
          additional_kwargs: { reasoning_content: [{ signature: 'opaque' }] },
        }),
      ),
      [],
    );
    assert.deepEqual(visibleReasoning(new AIMessage('Answer only')), []);
  });
});
