export interface StaffVisibilityElements {
  panel: Pick<HTMLElement, 'hidden'>
  host: Pick<HTMLElement, 'hidden'>
  row: { classList: Pick<DOMTokenList, 'toggle'> }
  toggle: Pick<HTMLButtonElement, 'setAttribute'>
}

export function setStaffVisibility({ panel, host, row, toggle }: StaffVisibilityElements, visible: boolean): void {
  panel.hidden = !visible
  host.hidden = !visible
  row.classList.toggle('staff-visible', visible)
  toggle.setAttribute('aria-pressed', String(visible))
}
