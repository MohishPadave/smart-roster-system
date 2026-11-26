/**
 * AI conflict explanation endpoint
 * Uses OpenAI/Anthropic for natural language explanations with structured fallback
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ConflictExplanation,
  UnsatisfiableCoreItem,
  SpofAuditItem,
  RuleViolation,
} from '@/types/roster';

export const maxDuration = 60;

const ExplainRequestSchema = z.object({
  monthKey: z.string().optional(),
  unsatisfiableCore: z.array(z.any()).optional(),
  spofItems: z.array(z.any()).optional(),
  violations: z.array(z.any()).optional(),
  context: z.string().optional(),
});

/**
 * Deterministic structured fallback explanation
 */
function generateDeterministicExplanation(
  unsatisfiableCore?: UnsatisfiableCoreItem[],
  spofItems?: SpofAuditItem[],
  violations?: RuleViolation[]
): ConflictExplanation {
  const rootCauses: string[] = [];
  const recommendedActions: string[] = [];

  // Analyze unsatisfiable core
  if (unsatisfiableCore && unsatisfiableCore.length > 0) {
    const constraintTypes = new Set(unsatisfiableCore.map((item) => item.constraint_type));

    if (constraintTypes.has('COVERAGE')) {
      rootCauses.push(
        'Insufficient employee capacity to meet brand coverage requirements'
      );
      recommendedActions.push(
        'Review brand process rules and reduce minHeadcount or add more employees with matching skills'
      );
    }

    if (constraintTypes.has('LEAVE_LOCK')) {
      rootCauses.push('Approved leaves conflict with critical coverage periods');
      recommendedActions.push(
        'Reject or reschedule conflicting leave requests, or reallocate backup employees'
      );
    }

    if (constraintTypes.has('WEEKLY_OFF')) {
      rootCauses.push('Weekly off constraints cannot be satisfied given workload');
      recommendedActions.push(
        'Increase pool of float/backup employees or reduce coverage requirements on weekends'
      );
    }

    if (constraintTypes.has('MAX_CAPACITY')) {
      rootCauses.push('Employee daily capacity limits exceeded');
      recommendedActions.push(
        'Redistribute work across more employees or increase max_daily_capacity for affected employees'
      );
    }
  }

  // Analyze SPOF items
  if (spofItems && spofItems.length > 0) {
    const highRisks = spofItems.filter((item) => item.risk_level === 'HIGH');
    if (highRisks.length > 0) {
      rootCauses.push(
        `${highRisks.length} brands have single points of failure (no backup coverage)`
      );
      recommendedActions.push(
        'Assign SECONDARY_BACKUP employees to high-risk brands or cross-train existing employees'
      );
    }
  }

  // Analyze violations
  if (violations && violations.length > 0) {
    const p0Count = violations.filter((v) => v.severity === 'P0').length;
    const p1Count = violations.filter((v) => v.severity === 'P1').length;

    if (p0Count > 0) {
      rootCauses.push(`${p0Count} critical (P0) constraint violations detected`);
      recommendedActions.push('Fix all P0 violations before publishing roster');
    }

    if (p1Count > 0) {
      rootCauses.push(`${p1Count} important (P1) policy violations detected`);
      recommendedActions.push('Review and resolve P1 violations to ensure compliance');
    }
  }

  const summary =
    rootCauses.length > 0
      ? `Roster generation failed due to ${rootCauses.length} constraint conflicts. ${rootCauses[0]}.`
      : 'No major conflicts detected. Roster is feasible.';

  return {
    summary,
    rootCauses: rootCauses.length > 0 ? rootCauses : ['No conflicts detected'],
    recommendedActions:
      recommendedActions.length > 0
        ? recommendedActions
        : ['Proceed with roster generation'],
    provider: 'deterministic',
  };
}

/**
 * AI-powered explanation using OpenAI
 */
async function generateOpenAIExplanation(
  prompt: string,
  fallback: ConflictExplanation
): Promise<ConflictExplanation> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fallback;
  }

  try {
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a roster optimization expert. Analyze constraint conflicts and provide actionable recommendations in JSON format.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 1000,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      summary: result.summary || fallback.summary,
      rootCauses: result.rootCauses || fallback.rootCauses,
      recommendedActions: result.recommendedActions || fallback.recommendedActions,
      provider: 'openai',
    };
  } catch (error) {
    console.error('OpenAI explanation error:', error);
    return fallback;
  }
}

/**
 * AI-powered explanation using Anthropic
 */
async function generateAnthropicExplanation(
  prompt: string,
  fallback: ConflictExplanation
): Promise<ConflictExplanation> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return fallback;
  }

  try {
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\nProvide your response in JSON format with keys: summary, rootCauses (array), recommendedActions (array).`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      const result = JSON.parse(content.text);
      return {
        summary: result.summary || fallback.summary,
        rootCauses: result.rootCauses || fallback.rootCauses,
        recommendedActions: result.recommendedActions || fallback.recommendedActions,
        provider: 'anthropic',
      };
    }

    return fallback;
  } catch (error) {
    console.error('Anthropic explanation error:', error);
    return fallback;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { monthKey, unsatisfiableCore, spofItems, violations, context } =
      ExplainRequestSchema.parse(body);

    // Generate deterministic fallback
    const deterministicExplanation = generateDeterministicExplanation(
      unsatisfiableCore,
      spofItems,
      violations
    );

    // Build AI prompt
    const prompt = `
Analyze the following roster optimization conflicts for month ${monthKey || 'unknown'}:

${unsatisfiableCore ? `Unsatisfiable Core:\n${JSON.stringify(unsatisfiableCore, null, 2)}\n` : ''}
${spofItems ? `SPOF Risks:\n${JSON.stringify(spofItems, null, 2)}\n` : ''}
${violations ? `Violations:\n${JSON.stringify(violations, null, 2)}\n` : ''}
${context ? `Additional Context:\n${context}\n` : ''}

Provide a concise summary, identify root causes, and recommend specific actionable steps.
Return JSON with keys: summary (string), rootCauses (string array), recommendedActions (string array).
    `.trim();

    // Try OpenAI first, then Anthropic, then fall back to deterministic
    let explanation = deterministicExplanation;

    if (process.env.OPENAI_API_KEY) {
      explanation = await generateOpenAIExplanation(prompt, deterministicExplanation);
    } else if (process.env.ANTHROPIC_API_KEY) {
      explanation = await generateAnthropicExplanation(prompt, deterministicExplanation);
    }

    return NextResponse.json(explanation);
  } catch (error) {
    console.error('POST /api/ai/explain error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
