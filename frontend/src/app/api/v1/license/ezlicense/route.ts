import { NextResponse } from "next/server"

import { prisma } from "@/lib/db/prisma"
import { checkPermission, PERMISSIONS } from "@/lib/rbac"
import { resolveLicensePrivateKey, rsaDecryptBase64 } from "@/lib/rsa/decrypt"
import { parseAndValidateLicensePayload } from "@/lib/rsa/license-payload"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function pickCiphertext(body: unknown): string {
  if (!body || typeof body !== "object") return ""
  const o = body as Record<string, unknown>
  for (const key of ["license", "serial", "ciphertext", "data"] as const) {
    const v = o[key]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return ""
}

function pickId(body: unknown, url: URL): string {
  const fromQuery = url.searchParams.get("id")?.trim()
  if (fromQuery) return fromQuery
  if (body && typeof body === "object") {
    const id = (body as { id?: unknown }).id
    if (typeof id === "string" && id.trim()) return id.trim()
  }
  return ""
}

function decryptStored(data: string) {
  const privateKey = resolveLicensePrivateKey()
  const plaintext = rsaDecryptBase64(data, privateKey)
  const payload = parseAndValidateLicensePayload(plaintext)
  return { plaintext, payload }
}

/**
 * GET /api/v1/license/ezlicense
 * 查询全部序列号：解密 data 后返回，并带上 id
 */
export async function GET() {
  const denied = await checkPermission(PERMISSIONS.ADMIN_SETTINGS)
  if (denied) return denied

  try {
    const rows = await prisma.ezLicense.findMany({ orderBy: { id: "asc" } })
    const items = rows.map((row) => {
      try {
        const { plaintext, payload } = decryptStored(row.data)
        return {
          id: row.id,
          data: payload ?? plaintext,
        }
      } catch (e: any) {
        return {
          id: row.id,
          data: null,
          error: e?.message || "decrypt failed",
        }
      }
    })
    return NextResponse.json({ success: true, items })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Failed to list ezlicense" },
      { status: 500 },
    )
  }
}

/**
 * POST /api/v1/license/ezlicense
 * body: { license: "<RSA Base64 密文>" }
 * 解密校验 expireDate/edition/features，通过后将密文写入 ezlicense.data
 */
export async function POST(req: Request) {
  const denied = await checkPermission(PERMISSIONS.ADMIN_SETTINGS)
  if (denied) return denied

  try {
    const body = await req.json().catch(() => null)
    const ciphertext = pickCiphertext(body)
    if (!ciphertext) {
      return NextResponse.json(
        { success: false, error: "license (encrypted serial) is required" },
        { status: 400 },
      )
    }

    let plaintext: string
    try {
      plaintext = rsaDecryptBase64(ciphertext, resolveLicensePrivateKey())
    } catch (e: any) {
      const msg = e?.message || String(e)
      const status = msg.includes("LICENSE_RSA_PRIVATE_KEY") ? 503 : 400
      return NextResponse.json(
        { success: false, error: status === 400 ? "无效的序列号" : msg },
        { status },
      )
    }

    const payload = parseAndValidateLicensePayload(plaintext)
    if (!payload) {
      return NextResponse.json({ success: false, error: "无效的序列号" }, { status: 400 })
    }

    const row = await prisma.ezLicense.create({
      data: { data: ciphertext },
    })

    return NextResponse.json({
      success: true,
      id: row.id,
      data: payload,
    })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Failed to create ezlicense" },
      { status: 500 },
    )
  }
}

/**
 * DELETE /api/v1/license/ezlicense?id=...
 * 或 body: { id: "..." }
 */
export async function DELETE(req: Request) {
  const denied = await checkPermission(PERMISSIONS.ADMIN_SETTINGS)
  if (denied) return denied

  try {
    const url = new URL(req.url)
    const body = await req.json().catch(() => null)
    const id = pickId(body, url)
    if (!id) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 })
    }

    const existing = await prisma.ezLicense.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 })
    }

    await prisma.ezLicense.delete({ where: { id } })
    return NextResponse.json({ success: true, id })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Failed to delete ezlicense" },
      { status: 500 },
    )
  }
}
