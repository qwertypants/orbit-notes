import p5 from 'p5'

const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']

export function mountNoteCircle(host: HTMLElement): p5 {
  return new p5((sketch) => {
    let canvasSize = 0

    sketch.setup = () => {
      const canvas = sketch.createCanvas(canvasSize, canvasSize)
      canvas.parent(host)
      canvas.elt.setAttribute('aria-hidden', 'true')
      sketch.textFont('system-ui, sans-serif')
      sketch.textAlign(sketch.CENTER, sketch.CENTER)
      sketch.noLoop()
      drawCircle()
    }

    sketch.windowResized = () => {
      drawCircle()
    }

    function drawCircle(): void {
      const bounds = host.getBoundingClientRect()
      canvasSize = Math.max(1, Math.floor(Math.min(bounds.width, 520)))
      if (sketch.width !== canvasSize || sketch.height !== canvasSize) sketch.resizeCanvas(canvasSize, canvasSize)

      const center = canvasSize / 2
      const radius = canvasSize * 0.37
      sketch.clear()
      sketch.noFill()
      sketch.stroke(255, 255, 255, 38)
      sketch.strokeWeight(1)
      sketch.circle(center, center, radius * 2)
      sketch.noStroke()

      NOTE_NAMES.forEach((name, index) => {
        const angle = (index / NOTE_NAMES.length) * sketch.TWO_PI - sketch.HALF_PI
        const x = center + Math.cos(angle) * radius
        const y = center + Math.sin(angle) * radius
        const hue = (index * 360) / NOTE_NAMES.length
        sketch.fill(`hsl(${hue} 85% 68%)`)
        sketch.circle(x, y, Math.max(5, canvasSize * 0.014))
        sketch.fill('#f3f1ff')
        sketch.textSize(Math.max(12, canvasSize * 0.045))
        sketch.text(name, center + Math.cos(angle) * radius * 1.19, center + Math.sin(angle) * radius * 1.19)
      })
    }
  }, host)
}
