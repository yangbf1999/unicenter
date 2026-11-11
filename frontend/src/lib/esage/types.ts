// src/lib/esage/types.ts
export type eSageResourceType =
  | "node"
  | "qemu"
  | "lxc"
  | "storage"

export type eSageResource = {
  id: string
  type: eSageResourceType
  name: string
  node?: string
  status?: string
  cpu?: number
  mem?: number
  maxmem?: number
  disk?: number
  maxdisk?: number
  uptime?: number
  vmid?: number
  tags?: string
}
