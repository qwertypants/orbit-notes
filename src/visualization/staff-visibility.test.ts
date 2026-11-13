import { describe, expect, it, vi } from 'vitest'
import { setStaffVisibility } from './staff-visibility.ts'

describe('setStaffVisibility', () => {
  it('hides the panel and staff together while preserving toggle state', () => {
    const elements = {
      panel: { hidden: false },
      host: { hidden: false },
      row: { classList: { toggle: vi.fn() } },
      toggle: { setAttribute: vi.fn() },
    }

    setStaffVisibility(elements, false)
    expect(elements.panel.hidden).toBe(true)
    expect(elements.host.hidden).toBe(true)
    expect(elements.row.classList.toggle).toHaveBeenCalledWith('staff-visible', false)
    expect(elements.toggle.setAttribute).toHaveBeenCalledWith('aria-pressed', 'false')

    setStaffVisibility(elements, true)
    expect(elements.panel.hidden).toBe(false)
    expect(elements.host.hidden).toBe(false)
    expect(elements.row.classList.toggle).toHaveBeenLastCalledWith('staff-visible', true)
    expect(elements.toggle.setAttribute).toHaveBeenLastCalledWith('aria-pressed', 'true')
  })
})
