import * as tar from 'tar-stream'
import { describe, expect, it } from 'vitest'
import { buildArchive } from './docker.js'

interface Entry {
  name: string
  type?: tar.Header['type']
  mode?: number
  uid?: number
  gid?: number
  content: string
}

async function readEntries(archive: Buffer): Promise<Entry[]> {
  const extractor = tar.extract()
  const entries: Entry[] = []

  const done = new Promise<void>((resolve, reject) => {
    extractor.on('entry', (header, stream, next) => {
      let content = ''
      stream.on('data', (chunk) => {
        content += chunk.toString()
      })
      stream.on('end', () => {
        entries.push({
          name: header.name,
          type: header.type,
          mode: header.mode,
          uid: header.uid,
          gid: header.gid,
          content,
        })
        next()
      })
      stream.resume()
    })
    extractor.on('finish', resolve)
    extractor.on('error', reject)
  })

  extractor.end(archive)
  await done
  return entries
}

describe('buildArchive', () => {
  it('only writes the config file when no directories are needed', async () => {
    const archive = await buildArchive('data/main/server.cfg', 'sv_hostname FFsVH\n')
    const entries = await readEntries(archive)

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      name: 'data/main/server.cfg',
      type: 'file',
      mode: 0o644,
      content: 'sv_hostname FFsVH\n',
    })
  })

  it('creates missing directories with the parent directory owner', async () => {
    const archive = await buildArchive('data/main/server.cfg', 'x', {
      dirs: ['data/', 'data/main/'],
      owner: { uid: 1000, gid: 1001 },
    })
    const entries = await readEntries(archive)

    expect(entries.map((entry) => entry.name)).toEqual([
      'data/',
      'data/main/',
      'data/main/server.cfg',
    ])
    expect(entries[0]).toMatchObject({
      type: 'directory',
      mode: 0o755,
      uid: 1000,
      gid: 1001,
    })
    expect(entries[2]).toMatchObject({ uid: 1000, gid: 1001 })
  })
})
