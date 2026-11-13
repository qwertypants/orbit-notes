import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createExplorerState, toggleExplorerNote } from '../explorer-state.ts'
import { createLearningSummary, type LearningSummary } from './learning-summary.ts'
import { renderTheorySummary, renderTraditionSummary } from './learning-panel.ts'

class FakeNode {
  children: FakeNode[] = []
  className = ''
  href = ''
  target = ''
  rel = ''
  private text = ''

  constructor(readonly tagName: string) {}
  get textContent(): string { return this.text + this.children.map((child) => child.textContent).join('') }
  set textContent(value: string) { this.text = value; this.children = [] }
  get childElementCount(): number { return this.children.filter((child) => child.tagName !== '#text').length }
  append(...children: FakeNode[]): void { this.children.push(...children) }
  replaceChildren(...children: FakeNode[]): void { this.text = ''; this.children = children }
}

let created: FakeNode[]
beforeEach(() => {
  created = []
  vi.stubGlobal('document', {
    createElement: (tag: string) => {
      const node = new FakeNode(tag)
      created.push(node)
      return node
    },
    createTextNode: (text: string) => {
      const node = new FakeNode('#text')
      node.textContent = text
      return node
    },
  })
})
afterEach(() => vi.unstubAllGlobals())

const renderers = [
  ['Theory', (container: HTMLElement, summary: LearningSummary) => renderTheorySummary(container, summary, 'scales')],
  ['Traditions', renderTraditionSummary],
] as const

describe.each(renderers)('%s summary', (_tab, render) => {
  it.each(['bihor-hemitonic-pentatonic', 'chinese-c-gong-mode', 'maqam-ajam-c'])('shows %s context beside its caveat and sources', (id) => {
    const summary = createLearningSummary(createExplorerState({ topic: 'scales', root: 0, culturalPatternId: id }))
    const container = document.createElement('div')
    render(container, summary)

    for (const text of [summary.title, summary.selectedNotes, summary.traditionName, summary.region, summary.context, summary.representationNote]) {
      expect(container.textContent).toContain(text)
    }
    expect(created.filter(({ tagName }) => tagName === 'a')).toEqual(summary.sources?.map((source) => expect.objectContaining({
      textContent: source.title, href: source.url, target: '_blank', rel: 'noreferrer',
    })))
  })

  it('retains original context, representation limits and sources for edited notes', () => {
    const state = toggleExplorerNote(createExplorerState({ topic: 'scales', root: 0, culturalPatternId: 'chinese-c-gong-mode' }), 2)
    const summary = createLearningSummary(state)
    const container = document.createElement('div')
    render(container, summary)

    expect(container.textContent).toContain('Custom notes around C')
    expect(container.textContent).toContain('C, E, G, A')
    expect(container.textContent).toContain('Original pattern: C gōng mode.')
    expect(container.textContent).toContain(summary.context)
    expect(container.textContent).toContain(summary.representationNote)
    expect(created.filter(({ tagName }) => tagName === 'a').map(({ href }) => href)).toEqual(summary.sources?.map(({ url }) => url))
  })

  it('keeps catalog copy as text and excludes malformed or non-HTTP(S) source URLs', () => {
    const text = '<img src=x onerror=alert(1)>'
    const source = { title: text, supportsPattern: true }
    const summary = { ...createLearningSummary(createExplorerState({ topic: 'scales', root: 0, culturalPatternId: 'chinese-c-gong-mode' })),
      context: text, explanation: text, representationNote: text,
      sources: ['javascript:alert(1)', 'data:text/html,bad', 'not a url', 'https://example.com/', 'http://example.com/'].map((url) => ({ ...source, url })),
    }
    const container = document.createElement('div')
    render(container, summary)

    expect(container.textContent).toContain(text)
    expect(created.some(({ tagName }) => tagName === 'img')).toBe(false)
    expect(created.filter(({ tagName }) => tagName === 'a')).toEqual([
      expect.objectContaining({ href: 'https://example.com/', textContent: text, target: '_blank', rel: 'noreferrer' }),
      expect.objectContaining({ href: 'http://example.com/', textContent: text, target: '_blank', rel: 'noreferrer' }),
    ])
  })

  it('clears the previous catalog attribution when a standard preset is selected', () => {
    const container = document.createElement('div')
    render(container, createLearningSummary(createExplorerState({ topic: 'scales', root: 0, culturalPatternId: 'chinese-c-gong-mode' })))
    render(container, createLearningSummary(createExplorerState({ topic: 'scales', root: 0, preset: 'major' })))
    expect(container.textContent).not.toContain('gōng')
    expect(container.textContent).not.toContain('Sources:')
  })
})
