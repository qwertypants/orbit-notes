import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export async function buildOffline(directory = resolve('dist')) {
  const files = (await readdir(directory, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name !== 'sw.js')
    .map((entry) => relative(directory, resolve(entry.parentPath, entry.name)))
    .sort()
  const entries = await Promise.all(files.map(async (path) => ({
    path,
    digest: createHash('sha256').update(await readFile(resolve(directory, path))).digest('hex'),
  })))
  const template = await readFile(new URL('./service-worker.js', import.meta.url), 'utf8')
  const release = createHash('sha256').update(template).update(JSON.stringify(entries)).digest('hex').slice(0, 20)
  await writeFile(resolve(directory, 'sw.js'), template
    .replace("'__ORBIT_RELEASE__'", JSON.stringify(release))
    .replace('[] /* __ORBIT_FILES__ */', JSON.stringify(entries)))
  return { release, entries }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { release, entries } = await buildOffline()
  console.log(`Offline release ${release}: ${entries.length} files`)
}
