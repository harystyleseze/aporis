import { NextRequest, NextResponse } from 'next/server';
import { generateRiskNarrative, generateRecommendation } from '@/lib/llm';
import { analyzeRisk } from '@/lib/risk-engine';
import { calculateNetYield } from '@/lib/optimizer';
import type { Vault } from '@/types';

// Server-side route for LLM-powered analysis
// POST /api/analyze
// Body: { type: 'risk' | 'recommendation', vault: Vault, depositAmount?: number, riskTolerance?: string }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, vault, depositAmount, riskTolerance } = body as {
      type: 'risk' | 'recommendation';
      vault: Vault;
      depositAmount?: number;
      riskTolerance?: string;
    };

    if (!vault || !type) {
      return NextResponse.json({ error: 'Missing vault or type' }, { status: 400 });
    }

    const risk = analyzeRisk(vault);

    if (type === 'risk') {
      const narrative = await generateRiskNarrative(vault, risk);
      return NextResponse.json({ narrative, risk: risk.overall });
    }

    if (type === 'recommendation') {
      const amount = depositAmount || 1000;
      const netYield = calculateNetYield(vault, amount);
      const narrative = await generateRecommendation(
        vault, risk, netYield, amount, riskTolerance || 'medium',
      );
      return NextResponse.json({ narrative, netYield, risk: risk.overall });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analysis failed' },
      { status: 500 },
    );
  }
}
