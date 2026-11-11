import { createPbsJobConfig, type PbsJobCollectionContext } from "@/lib/esage/pbsJobConfig"
import { TAPE_JOB } from "@/lib/esage/pbsJobSpecs"

export const runtime = "nodejs"

/**
 * POST /api/v1/pbs/[id]/jobs/tape
 * Crée un nouveau Tape Backup Job sur PBS
 */
export async function POST(req: Request, ctx: PbsJobCollectionContext) {
  return createPbsJobConfig(req, ctx, TAPE_JOB)
}
