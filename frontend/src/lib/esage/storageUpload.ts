import https from "node:https"
import http from "node:http"
import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"

import { getConnectionById } from "@/lib/connections/getConnection"
import { getPrincipal } from "@/lib/auth/principal"
import { checkPermission, PERMISSIONS } from "@/lib/rbac"
import { guardTenantStorageWrite } from "@/lib/vdc/scope"
import { setProgress, clearProgress } from "@/lib/upload-progress"

type StreamingSession = {
  proxyReq: http.ClientRequest
  boundary: string
  bytesSent: number
  totalFormLength: number
  resolve: (value: { statusCode: number; body: string }) => void
  reject: (reason: any) => void
  resultPromise: Promise<{ statusCode: number; body: string }>
}

const streamingSessions = new Map<string, StreamingSession>()

function buildMultipartParts(boundary: string, contentType: string, fileName: string, mimeType: string) {
  const contentField =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="content"\r\n\r\n` +
    `${contentType}\r\n`

  const fileHeader =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="filename"; filename="${fileName}"\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`

  const closing = `\r\n--${boundary}--\r\n`

  return { contentField, fileHeader, closing }
}

export type StorageUploadTarget = {
  connectionId: string
  node: string
  storage: string
}

/** Chunked streaming upload to UNISPHERE `/nodes/{node}/storage/{storage}/upload`. */
export async function handleStorageUpload(
  req: Request,
  target: StorageUploadTarget,
): Promise<Response> {
  const uploadId = req.headers.get("x-upload-id") || randomUUID()
  const isChunk = req.headers.has("x-chunk-index")
  const isFinalize = req.headers.has("x-finalize")

  if (isChunk) return handleChunk(req, target, uploadId)
  if (isFinalize) return handleFinalize(req, target, uploadId)
  return NextResponse.json(
    { error: "Missing X-Chunk-Index or X-Finalize header" },
    { status: 400 },
  )
}

async function handleChunk(
  req: Request,
  target: StorageUploadTarget,
  uploadId: string,
) {
  const { connectionId: id, node, storage } = target
  try {
    const denied = await checkPermission(PERMISSIONS.CONNECTION_VIEW, "connection", id)
    if (denied) return denied

    const storageBlock = await guardTenantStorageWrite(id, storage)
    if (storageBlock) return storageBlock

    const chunkIndex = Number.parseInt(req.headers.get("x-chunk-index") || "0", 10)
    const totalSize = Number.parseInt(req.headers.get("x-total-size") || "0", 10)
    const fileName = req.headers.get("x-file-name") || "upload"
    const contentType = req.headers.get("x-content-type") || "iso"
    const mimeType = req.headers.get("x-mime-type") || "application/octet-stream"

    if (!req.body) {
      return NextResponse.json({ error: "Missing body" }, { status: 400 })
    }

    let session = streamingSessions.get(uploadId)

    if (!session) {
      const conn = await getConnectionById(id)
      const baseUrl = conn.baseUrl.replace(/\/+$/, "")
      const targetUrl = new URL(
        `${baseUrl}/api2/json/nodes/${encodeURIComponent(node)}/storage/${encodeURIComponent(storage)}/upload`,
      )

      const boundary = `----UniCenterUpload${randomUUID().replaceAll(/-/g, "")}`
      const parts = buildMultipartParts(boundary, contentType, fileName, mimeType)

      const preambleLength = Buffer.byteLength(parts.contentField + parts.fileHeader, "utf-8")
      const closingLength = Buffer.byteLength(parts.closing, "utf-8")
      const totalFormLength = preambleLength + totalSize + closingLength

      const isHttps = targetUrl.protocol === "https:"
      const transport = isHttps ? https : http
      const agent =
        isHttps && conn.insecureDev ? new https.Agent({ rejectUnauthorized: false }) : undefined

      const principalResult = await getPrincipal()
      const ownerId = principalResult.ok ? principalResult.principal?.userId || null : null

      setProgress(uploadId, { bytesSent: 0, totalBytes: totalSize, status: "transferring" }, ownerId)

      let resolveResult: any
      let rejectResult: any
      const resultPromise = new Promise<{ statusCode: number; body: string }>((res, rej) => {
        resolveResult = res
        rejectResult = rej
      })

      const proxyReq = transport.request(
        {
          hostname: targetUrl.hostname,
          port: targetUrl.port || (isHttps ? 443 : 80),
          path: targetUrl.pathname + targetUrl.search,
          method: "POST",
          agent,
          headers: {
            Authorization: `PVEAPIToken=${conn.apiToken}`,
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
            "Content-Length": totalFormLength,
          },
          timeout: 600_000,
        },
        (res) => {
          const chunks: Buffer[] = []
          res.on("data", (chunk) => chunks.push(chunk))
          res.on("end", () => {
            resolveResult({
              statusCode: res.statusCode || 500,
              body: Buffer.concat(chunks).toString("utf-8"),
            })
          })
          res.on("error", rejectResult)
        },
      )

      proxyReq.on("error", rejectResult)
      proxyReq.write(parts.contentField + parts.fileHeader)

      session = {
        proxyReq,
        boundary,
        bytesSent: 0,
        totalFormLength,
        resolve: resolveResult,
        reject: rejectResult,
        resultPromise,
      }
      streamingSessions.set(uploadId, session)

      console.log(
        `[upload] Streaming "${fileName.replaceAll(/[\r\n]/g, "")}" (${totalSize} bytes) directly to eSage, uploadId=${uploadId}`,
      )
    }

    const reader = req.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        await new Promise<void>((resolve, reject) => {
          session!.proxyReq.write(value, (err: any) => (err ? reject(err) : resolve()))
        })
        session.bytesSent += value.byteLength
        setProgress(uploadId, {
          bytesSent: session.bytesSent,
          totalBytes: totalSize || session.totalFormLength,
          status: "transferring",
        })
      }
    }

    return NextResponse.json({
      ok: true,
      chunkIndex,
      bytesSent: session.bytesSent,
    })
  } catch (e: any) {
    console.error("Error streaming chunk:", e)
    const session = streamingSessions.get(uploadId)
    if (session) {
      session.proxyReq.destroy()
      streamingSessions.delete(uploadId)
    }
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}

async function handleFinalize(
  req: Request,
  target: StorageUploadTarget,
  uploadId: string,
) {
  const { connectionId: id, node, storage } = target
  try {
    const denied = await checkPermission(PERMISSIONS.CONNECTION_VIEW, "connection", id)
    if (denied) return denied

    const storageBlock = await guardTenantStorageWrite(id, storage)
    if (storageBlock) return storageBlock

    const session = streamingSessions.get(uploadId)
    if (!session) {
      return NextResponse.json(
        { error: "No streaming session found. Send chunks first." },
        { status: 400 },
      )
    }

    const closing = `\r\n--${session.boundary}--\r\n`
    await new Promise<void>((resolve, reject) => {
      session.proxyReq.write(closing, (err: any) => (err ? reject(err) : resolve()))
    })
    session.proxyReq.end()

    const result = await session.resultPromise

    console.log(`[upload] eSage responded ${result.statusCode}:`, result.body.substring(0, 500))

    if (result.statusCode < 200 || result.statusCode >= 300) {
      let errMsg = `eSage returned ${result.statusCode}`
      try {
        const json = JSON.parse(result.body)
        errMsg = json.errors ? JSON.stringify(json.errors) : json.message || errMsg
      } catch {
        /* use default */
      }
      setProgress(uploadId, {
        bytesSent: session.bytesSent,
        totalBytes: session.totalFormLength,
        status: "error",
        error: errMsg,
      })
      return NextResponse.json({ error: errMsg, uploadId }, { status: result.statusCode })
    }

    setProgress(uploadId, {
      bytesSent: session.bytesSent,
      totalBytes: session.bytesSent,
      status: "done",
    })

    let data = null
    try {
      const json = JSON.parse(result.body)
      data = json.data
    } catch {
      /* ignore */
    }

    const { audit } = await import("@/lib/audit")
    await audit({
      action: "update" as any,
      category: "storage",
      resourceType: "storage",
      resourceId: storage,
      details: { node, connectionId: id, operation: "upload" },
    })

    return NextResponse.json({ success: true, data, uploadId })
  } catch (e: any) {
    console.error("Error finalizing upload:", e)
    setProgress(uploadId, {
      bytesSent: 0,
      totalBytes: 0,
      status: "error",
      error: e?.message || String(e),
    })
    return NextResponse.json({ error: e?.message || String(e), uploadId }, { status: 500 })
  } finally {
    streamingSessions.delete(uploadId)
    setTimeout(() => clearProgress(uploadId), 30_000)
  }
}

/** Download a remote URL into UNISPHERE storage (ISO / vztmpl / …). */
export async function handleStorageDownloadUrl(
  target: StorageUploadTarget,
  body: { url: string; content: string; filename: string },
): Promise<Response> {
  const { connectionId: id, node, storage } = target
  const denied = await checkPermission(PERMISSIONS.CONNECTION_VIEW, "connection", id)
  if (denied) return denied

  const storageBlock = await guardTenantStorageWrite(id, storage)
  if (storageBlock) return storageBlock

  const { url, content, filename } = body
  if (!url || !content || !filename) {
    return NextResponse.json(
      { error: "url, content and filename are required" },
      { status: 400 },
    )
  }

  const { unisphereFetch } = await import("@/lib/esage/client")
  const conn = await getConnectionById(id)
  const params = new URLSearchParams({
    url,
    content,
    filename,
    node,
    storage,
    "verify-certificates": "0",
  })

  const result = await unisphereFetch<any>(
    conn,
    `/nodes/${encodeURIComponent(node)}/storage/${encodeURIComponent(storage)}/download-url`,
    {
      method: "POST",
      body: params.toString(),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    },
  )

  const { audit } = await import("@/lib/audit")
  await audit({
    action: "update" as any,
    category: "storage",
    resourceType: "storage",
    resourceId: storage,
    details: { node, connectionId: id, content, filename, url, operation: "download-url" },
  })

  return NextResponse.json({ success: true, data: result })
}
