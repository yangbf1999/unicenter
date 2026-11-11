// Configuration de version UniCenter.
//
// Source of truth: `frontend/package.json#version`. The Docker build inlines
// the workflow-resolved tag value into NEXT_PUBLIC_APP_VERSION (e.g. "1.0.0"
// for a v1.0.0 tag, or the package version for a branch build). At runtime, the env var wins so
// production always shows what the workflow tagged. In `npm run dev` the env
// var is absent, so we fall back to package.json, which `npm version` keeps
// in sync on every release. Bump package.json before tagging or the dev
// banner will be stale.
import pkg from '../../package.json'

export const VERSION_NAME = 'UniCenter'
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || pkg.version
export const GIT_SHA = process.env.NEXT_PUBLIC_GIT_SHA || ''
export const GITHUB_REPO = process.env.NEXT_PUBLIC_GITHUB_REPO || ''
export const GITHUB_URL = GITHUB_REPO ? `https://github.com/${GITHUB_REPO}` : ''
