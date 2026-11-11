// src/app/api/v1/templates/unisphere/route.ts
//
// 聚合查询 UNISPHERE 侧模板/镜像：
//   GET /api/v1/templates/unisphere?type=vm      → 虚拟机模板（resources 中 template=true）
//   GET /api/v1/templates/unisphere?type=iso     → ISO 镜像（storage content=iso）
//   GET /api/v1/templates/unisphere?type=vztmpl  → 容器模板（storage content=vztmpl）
//
// 公共查询参数：
//   page, pageSize|limit, connId, node, storage(仅 iso/vztmpl), search, guestType(仅 vm: qemu|lxc)
//
// 上传 ISO：
//   POST /api/v1/templates/unisphere?connId=&node=&storage=
//   - 分片上传（大文件，与 storage/upload 相同协议）：
//       headers: X-Upload-Id, X-Chunk-Index, X-Total-Size, X-File-Name,
//                X-Content-Type=iso, X-Mime-Type；最后一请求带 X-Finalize=1
//   - URL 拉取：JSON { url, filename, content?: "iso" }
import { NextResponse } from "next/server"

import { checkPermission, PERMISSIONS } from "@/lib/rbac"
import {
  handleStorageDownloadUrl,
  handleStorageUpload,
} from "@/lib/esage/storageUpload"
import {
  collectStorageContent,
  collectVmTemplates,
  listUnisphereConnections,
  paginate,
  parsePagination,
  type UnisphereMediaKind,
} from "@/lib/templates/unisphereMediaList"

export const runtime = "nodejs"
export const maxDuration = 600

function parseKind(raw: string | null): UnisphereMediaKind | null {
  const t = (raw || "").trim().toLowerCase()
  if (t === "vm" || t === "template" || t === "qemu") return "vm"
  if (t === "iso") return "iso"
  if (t === "vztmpl" || t === "ct" || t === "lxc" || t === "rq") return "vztmpl"
  return null
}

export async function GET(req: Request) {
  try {
    const denied = await checkPermission(PERMISSIONS.VM_VIEW)
    if (denied) return denied

    const url = new URL(req.url)
    const kind = parseKind(url.searchParams.get("type"))
    if (!kind) {
      return NextResponse.json(
        { error: "type is required: vm | iso | vztmpl" },
        { status: 400 },
      )
    }

    const pagination = parsePagination(url)
    const connId = url.searchParams.get("connId")
    const node = url.searchParams.get("node")?.trim() || null
    const storage = url.searchParams.get("storage")?.trim() || null
    const search = url.searchParams.get("search")?.trim() || null

    const connections = await listUnisphereConnections({ connId })

    if (!connections.length) {
      return NextResponse.json({
        data: {
          type: kind,
          items: [],
          pagination: { page: 1, pageSize: pagination.pageSize, total: 0, totalPages: 1 },
        },
      })
    }

    let items: any[] = []

    if (kind === "vm") {
      const guestRaw = (url.searchParams.get("guestType") || "").trim().toLowerCase()
      const guestType =
        guestRaw === "qemu" || guestRaw === "vm"
          ? "qemu"
          : guestRaw === "lxc" || guestRaw === "ct" || guestRaw === "rq"
            ? "lxc"
            : null

      items = await collectVmTemplates({
        connections,
        node,
        search,
        guestType,
      })
    } else {
      items = await collectStorageContent({
        connections,
        content: kind,
        node,
        storage,
        search,
      })
    }

    const page = paginate(items, pagination)

    return NextResponse.json({
      data: {
        type: kind,
        items: page.items,
        pagination: page.pagination,
      },
    })
  } catch (e: any) {
    console.error("[templates/unisphere] Error:", e)
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}

function resolveUploadTarget(req: Request): {
  connectionId: string
  node: string
  storage: string
} | null {
  const url = new URL(req.url)
  const connectionId =
    url.searchParams.get("connId")?.trim() ||
    url.searchParams.get("connectionId")?.trim() ||
    req.headers.get("x-conn-id")?.trim() ||
    ""
  const node =
    url.searchParams.get("node")?.trim() ||
    req.headers.get("x-node")?.trim() ||
    ""
  const storage =
    url.searchParams.get("storage")?.trim() ||
    req.headers.get("x-storage")?.trim() ||
    ""
  if (!connectionId || !node || !storage) return null
  return { connectionId, node, storage }
}

/**
 * POST /api/v1/templates/unisphere?connId=&node=&storage=
 * 上传 ISO 到指定 UNISPHERE 节点存储（调用 UNISPHERE storage upload / download-url）。
 */
export async function POST(req: Request) {
  try {
    const target = resolveUploadTarget(req)
    if (!target) {
      return NextResponse.json(
        {
          error:
            "connId, node, storage are required (query or headers x-conn-id / x-node / x-storage)",
        },
        { status: 400 },
      )
    }

    // Chunked file upload → UNISPHERE /nodes/{node}/storage/{storage}/upload
    // （未传 X-Content-Type 时 lib 内默认 iso）
    if (req.headers.has("x-chunk-index") || req.headers.has("x-finalize")) {
      return handleStorageUpload(req, target)
    }

    // URL download mode
    const contentType = req.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => null)
      if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
      }
      return handleStorageDownloadUrl(target, {
        url: String(body.url || ""),
        filename: String(body.filename || ""),
        content: String(body.content || "iso"),
      })
    }

    return NextResponse.json(
      {
        error:
          "Use chunked upload (X-Chunk-Index / X-Finalize) or JSON body { url, filename, content }",
      },
      { status: 400 },
    )
  } catch (e: any) {
    console.error("[templates/unisphere] upload Error:", e)
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
