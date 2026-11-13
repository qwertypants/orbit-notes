export interface StaffVisibilityElements {
  panel: Pick<HTMLElement, 'hidden'>
  host: Pick<HTMLElement, 'hidden'>
  toggle: Pick<HTMLButtonElement, 'textContent' | 'setAttribute'>
}

export function setStaffVisibility({ panel, host, toggle }: StaffVisibilityElements, visible: boolean): void {
  panel.hidden = !visible
  host.hidden = !visible
  toggle.setAttribute('aria-pressed', String(visible))
  toggle.textContent = visible ? 'Hide staff' : 'Show staff'
}
