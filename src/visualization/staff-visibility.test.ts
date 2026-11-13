import { describe, expect, it, vi } from 'vitest'
import { setStaffVisibility } from './staff-visibility.ts'

describe('setStaffVisibility', () => {
  it('hides the panel and staff together while preserving toggle state', () => {
    const elements = {
      panel: { hidden: false },
      host: { hidden: false },
      toggle: { textContent: 'Hide staff', setAttribute: vi.fn() },
    }

    setStaffVisibility(elements, false)
    expect(elements.panel.hidden).toBe(true)
    expect(elements.host.hidden).toBe(true)
    expect(elements.toggle.setAttribute).toHaveBeenCalledWith('aria-pressed', 'false')
    expect(elements.toggle.textContent).toBe('Show staff')

    setStaffVisibility(elements, true)
    expect(elements.panel.hidden).toBe(false)
    expect(elements.host.hidden).toBe(false)
    expect(elements.toggle.setAttribute).toHaveBeenLastCalledWith('aria-pressed', 'true')
    expect(elements.toggle.textContent).toBe('Hide staff')
  })
})
