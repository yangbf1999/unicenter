export type SettingsTabVisibility = {
  providerOnly?: boolean
  requiredFeature?: string
}

type VisibilityOptions = {
  tabNames: readonly string[]
  tabs: readonly SettingsTabVisibility[]
  isProviderAdmin: boolean
  licenseLoading: boolean
  hasFeature: (feature: string) => boolean
}

// These add-on entry points are not part of the current release because the
// component-license delivery flow is not available yet. Their components and
// backend guards stay intact so the entries can be restored independently.
export const HIDDEN_SETTINGS_TABS_THIS_RELEASE = new Set(['ha', 'api'])

export function getVisibleSettingsTabIndices({
  tabNames,
  tabs,
  isProviderAdmin,
  licenseLoading,
  hasFeature,
}: VisibilityOptions): number[] {
  return tabs.reduce<number[]>((visible, tab, index) => {
    if (HIDDEN_SETTINGS_TABS_THIS_RELEASE.has(tabNames[index] ?? '')) return visible
    if (tab.providerOnly && !isProviderAdmin) return visible
    if (!licenseLoading && tab.requiredFeature && !hasFeature(tab.requiredFeature)) return visible
    visible.push(index)
    return visible
  }, [])
}

export function normalizeConnectionTab(tab: number, migrationAvailable: boolean): number {
  return !migrationAvailable && tab > 1 ? 0 : tab
}
