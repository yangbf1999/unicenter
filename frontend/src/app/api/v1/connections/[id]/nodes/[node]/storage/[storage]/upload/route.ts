import { handleStorageUpload } from "@/lib/esage/storageUpload"

export const runtime = "nodejs"
export const maxDuration = 600

// POST /api/v1/connections/{id}/nodes/{node}/storage/{storage}/upload
// Modes (via headers):
//   X-Chunk-Index: stream a chunk directly to eSage
//   X-Finalize: close the multipart form and get the eSage response
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; node: string; storage: string }> },
) {
  const { id, node, storage } = await ctx.params
  return handleStorageUpload(req, { connectionId: id, node, storage })
}
