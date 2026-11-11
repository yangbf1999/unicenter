import { describe, expect, it } from 'vitest'

import de from './de.json'
import en from './en.json'
import es from './es.json'
import fr from './fr.json'
import ko from './ko.json'
import zhCN from './zh-CN.json'

const locales: Record<string, any> = { en, fr, de, es, ko, 'zh-CN': zhCN }

const KEY = 'warmPrepNeedsUnisphere9'

describe('warm preparation UNISPHERE 9 requirement i18n parity across the 6 served locales', () => {
  for (const [locale, messages] of Object.entries(locales)) {
    it(`${locale} declares ${KEY} with both placeholders`, () => {
      const value = messages?.inventoryPage?.esxiMigration?.[KEY]
      expect(value, `${locale}: ${KEY}`).toBeTypeOf('string')
      expect(value, `${locale}: {unisphere} placeholder`).toContain('{unisphere}')
      expect(value, `${locale}: {debian} placeholder`).toContain('{debian}')
      expect(value, `${locale}: must name eSage UniSphere 9`).toContain('eSage UniSphere 9')
    })
  }
})
