import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { expect, it, vi } from 'vitest'

it('initializes scales sequentially and preserves manual choices until a topic reset', () => {
  // Execute the real initialization call and controller without mounting audio/canvas.
  const source = ts.createSourceFile('main.ts', readFileSync(new URL('./main.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true)
  const controller = source.statements.find((statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === 'syncPlaybackChoice')
  const startup = source.statements.find((statement) => ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) && statement.expression.expression.getText(source) === 'syncPlaybackChoice')
  let topic = 'scales'
  const togetherInput = { checked: true, disabled: false }
  const sequenceInput = { checked: false }
  const once = { value: 'once', checked: false }
  const patternField = { hidden: true }
  const context = {
    selectedTopic: () => topic, togetherInput, sequenceInput,
    patternInputs: [once], patternField, motion: { reveal: vi.fn() },
  }
  const script = ts.transpile(`${controller.getText(source)}\n${startup.getText(source)}`, { target: ts.ScriptTarget.ES2022 })
  runInNewContext(script, context)
  expect(sequenceInput.checked).toBe(true)
  expect(togetherInput.checked).toBe(false)
  expect(patternField.hidden).toBe(false)
  expect(once.checked).toBe(true)

  togetherInput.checked = true
  sequenceInput.checked = false
  runInNewContext('syncPlaybackChoice()', context)
  expect(togetherInput.checked).toBe(true)
  expect(patternField.hidden).toBe(true)
  topic = 'chords'
  runInNewContext('syncPlaybackChoice(true)', context)
  expect(togetherInput.checked).toBe(true)
  topic = 'scales'
  runInNewContext('syncPlaybackChoice(true)', context)
  expect(sequenceInput.checked).toBe(true)
  expect(togetherInput.checked).toBe(false)
  expect(patternField.hidden).toBe(false)
  expect(once.checked).toBe(true)
})
