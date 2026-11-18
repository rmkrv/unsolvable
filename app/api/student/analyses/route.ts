import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/lib/server/auth/request-identity";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { saveTopicTestAnalysis } from "@/lib/server/analyses/analysis-service";
import { HOME_CACHE_TAG } from "@/lib/server/home/dashboard-data";
import { errorResponse } from "@/lib/server/http/api-errors";
import { routeError } from "@/lib/server/http/route-utils";

const analysisSchema = z.object({
  grade: z.string().trim().min(1).max(3),
  score: z.number().int().min(0).max(100),
  gradeReason: z.string().trim().min(1).max(2_000),
  summary: z.string().trim().min(1).max(4_000),
  strengths: z.array(z.string().trim().min(1).max(500)).min(1).max(6),
  improvements: z.array(z.string().trim().min(1).max(500)).min(1).max(6),
  breakdown: z.array(z.object({
    task: z.number().int().min(1).max(5),
    outcome: z.string().trim().min(1).max(80),
    explanation: z.string().trim().min(1).max(1_500),
  }).strict()).max(5),
  completedAt: z.number().int().positive(),
}).strict();

const saveAnalysisSchema = z.object({
  id: z.string().uuid(),
  topicSlug: z.string().trim().min(1).max(80),
  topicName: z.string().trim().min(1).max(120),
  subtopic: z.string().trim().min(1).max(180),
  mode: z.enum(["preparation", "test"]),
  answers: z.array(z.string().trim().max(8_000)).max(5),
  analysis: analysisSchema,
  startedAt: z.number().int().positive(),
}).strict();

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("cross_origin", "Cross-origin write rejected.", 403);
  try {
    const viewer = await requireRequestViewer();
    const parsed = saveAnalysisSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("invalid_input", "Invalid analysis result.", 400);
    const analysis = await saveTopicTestAnalysis(viewer, parsed.data);
    revalidateTag(HOME_CACHE_TAG, "max");
    return NextResponse.json({ analysis }, { status: 201 });
  } catch (error) {
    return routeError(error, "Could not save the analysis.");
  }
}
