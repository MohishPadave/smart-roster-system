import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const ForgotSchema = z.object({
  email: z.string().email('Valid email is required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ForgotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid email' },
        { status: 400 }
      );
    }

    const email = parsed.data.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Return generic success to avoid email enumeration in production
      return NextResponse.json({
        success: true,
        message: 'If an account exists for that email, a 6-digit reset code has been generated.',
      });
    }

    // Invalidate prior unused tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const code = String(randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: code,
        expiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'A 6-digit password reset code has been generated (valid for 15 minutes).',
      // Exposed in non-production / local demo mode when no SMTP relay is configured
      resetCode: process.env.SMTP_HOST ? undefined : code,
    });
  } catch (error) {
    console.error('POST /api/auth/forgot-password error:', error);
    return NextResponse.json({ error: 'Failed to initiate password reset' }, { status: 500 });
  }
}
