import type { LearningSummary } from './learning-summary.ts'
import type { TopicId } from './music-theory.ts'

export function renderTheorySummary(theoryContent: HTMLElement, summary: LearningSummary, topic: TopicId): void {
  const heading = document.createElement('h2')
  heading.textContent = summary.title
  const selected = document.createElement('p')
  selected.className = 'theory-selected'
  const label = document.createElement('span')
  label.textContent = 'Selected notes'
  selected.append(label)
  selected.append(document.createTextNode(summary.selectedNotes))
  const explanation = document.createElement('p')
  explanation.textContent = summary.explanation
  const listHeading = document.createElement('h3')
  listHeading.textContent = topic === 'fifths' ? 'Clockwise fifths' : 'Notes and relationships'
  const list = document.createElement('ol')
  list.className = 'theory-relationships'
  summary.relationships.forEach((relationship) => {
    const item = document.createElement('li')
    item.textContent = relationship
    list.append(item)
  })
  theoryContent.replaceChildren(heading, selected, explanation)
  if (summary.traditionName) {
    const tradition = document.createElement('p')
    tradition.textContent = `${summary.traditionName} · ${summary.region}`
    theoryContent.append(tradition)
    if (summary.explanation !== summary.context) {
      const context = document.createElement('p')
      context.textContent = `Original pattern: ${summary.patternName}. ${summary.context ?? ''}`
      theoryContent.append(context)
    }
  }
  appendRepresentationNote(theoryContent, summary)
  theoryContent.append(listHeading, list)
}

export function renderTraditionSummary(traditionSummary: HTMLElement, summary: LearningSummary): void {
  traditionSummary.replaceChildren()
  if (!summary.traditionName) {
    const prompt = document.createElement('p')
    prompt.textContent = 'Choose a pattern to explore its notes and context.'
    traditionSummary.append(prompt)
    return
  }

  const heading = document.createElement('h3')
  heading.textContent = summary.title
  const tradition = document.createElement('p')
  tradition.textContent = `${summary.traditionName} · ${summary.region}`
  const selected = document.createElement('p')
  selected.className = 'theory-selected'
  const label = document.createElement('span')
  label.textContent = 'Selected notes'
  selected.append(label, document.createTextNode(summary.selectedNotes))
  const context = document.createElement('p')
  context.textContent = summary.context ?? ''
  traditionSummary.append(heading, tradition, selected)
  if (summary.explanation !== summary.context) {
    const custom = document.createElement('p')
    custom.textContent = `${summary.explanation} Original pattern: ${summary.patternName}.`
    traditionSummary.append(custom)
  }
  traditionSummary.append(context)
  appendRepresentationNote(traditionSummary, summary)
}

function appendRepresentationNote(container: HTMLElement, summary: LearningSummary): void {
  if (summary.representationNote) {
    const caveat = document.createElement('p')
    caveat.textContent = summary.representationNote
    container.append(caveat)
  }
}
