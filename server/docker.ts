import Docker from 'dockerode'
import * as tar from 'tar-stream'
import { LABEL_MANAGED } from '../shared/labels.js'
import type { ContainerSpec } from './containerSpec.js'
import { ApiError, dockerErrorMessage, isDockerNotFound } from './errors.js'

export const docker = new Docker({
  socketPath: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock',
})

export async function requireImage(imageRef: string): Promise<void> {
  try {
    await docker.getImage(imageRef).inspect()
  } catch (error) {
    if (isDockerNotFound(error)) {
      throw new ApiError(
        409,
        `Image "${imageRef}" is not present locally; pull it first`,
      )
    }
    throw new ApiError(502, `Could not inspect image: ${dockerErrorMessage(error)}`)
  }
}

export async function pingDocker(): Promise<void> {
  try {
    await docker.ping()
  } catch (error) {
    throw new ApiError(
      502,
      `Could not reach the Docker daemon: ${dockerErrorMessage(error)}`,
    )
  }
}

/** Inspect a local image; returns null when the ref is not present. */
export async function inspectImage(
  imageRef: string,
): Promise<Docker.ImageInspectInfo | null> {
  try {
    return await docker.getImage(imageRef).inspect()
  } catch (error) {
    if (isDockerNotFound(error)) return null
    throw new ApiError(502, `Could not inspect image: ${dockerErrorMessage(error)}`)
  }
}

export interface PullProgress {
  status: string
  /** Docker layer id, when the event describes a specific layer. */
  id?: string
  current?: number
  total?: number
}

/**
 * Pull `imageRef`, reporting Docker's progress events. Resolves when the stream
 * ends successfully and rejects if Docker reports an error for the pull.
 */
export async function pullImage(
  imageRef: string,
  onProgress?: (progress: PullProgress) => void,
): Promise<void> {
  let stream: NodeJS.ReadableStream
  try {
    stream = await docker.pull(imageRef)
  } catch (error) {
    throw new ApiError(502, `Could not pull image: ${dockerErrorMessage(error)}`)
  }

  await new Promise<void>((resolve, reject) => {
    let buffer = ''
    let failure: string | null = null

    const handleLine = (line: string) => {
      if (!line.trim()) return
      let event: Record<string, unknown>
      try {
        event = JSON.parse(line) as Record<string, unknown>
      } catch {
        return
      }

      const detail = event.errorDetail as { message?: unknown } | undefined
      if (typeof detail?.message === 'string') {
        failure = detail.message
      } else if (typeof event.error === 'string') {
        failure = event.error
      }

      const progress = event.progressDetail as
        | { current?: unknown; total?: unknown }
        | undefined
      try {
        onProgress?.({
          status: typeof event.status === 'string' ? event.status : 'Pulling',
          id: typeof event.id === 'string' ? event.id : undefined,
          current:
            typeof progress?.current === 'number' ? progress.current : undefined,
          total: typeof progress?.total === 'number' ? progress.total : undefined,
        })
      } catch {
        // Progress reporting must not abort the pull.
      }
    }

    stream.on('data', (chunk: Buffer | string) => {
      buffer += chunk.toString()
      let index = buffer.indexOf('\n')
      while (index !== -1) {
        handleLine(buffer.slice(0, index))
        buffer = buffer.slice(index + 1)
        index = buffer.indexOf('\n')
      }
    })
    stream.on('end', () => {
      handleLine(buffer)
      if (failure) {
        reject(new ApiError(502, `Pull failed: ${failure}`))
      } else {
        resolve()
      }
    })
    stream.on('error', (error: unknown) => {
      reject(new ApiError(502, `Pull failed: ${dockerErrorMessage(error)}`))
    })
  })
}

export async function createContainer(spec: ContainerSpec, name: string) {
  try {
    return await docker.createContainer({
      name,
      Image: spec.imageRef,
      Cmd: spec.cmd,
      Labels: spec.labels,
      Tty: false,
      AttachStdout: false,
      AttachStderr: false,
      HostConfig: {
        RestartPolicy: {
          Name: spec.restartPolicy,
          MaximumRetryCount: 0,
        },
        ...(spec.network ? { NetworkMode: spec.network } : {}),
      },
    })
  } catch (error) {
    if (isDockerNotFound(error)) {
      throw new ApiError(
        502,
        spec.network
          ? `Docker network "${spec.network}" does not exist`
          : `Docker could not create the container: ${dockerErrorMessage(error)}`,
      )
    }
    throw new ApiError(502, dockerErrorMessage(error))
  }
}

interface Owner {
  uid: number
  gid: number
}

interface ArchiveOptions {
  /** Directory entries to create, relative to the tar root (e.g. "data/main/"). */
  dirs?: string[]
  owner?: Owner
}

export async function uploadFile(
  container: Docker.Container,
  targetPath: string,
  content: string,
): Promise<void> {
  const parts = targetPath.split('/').filter(Boolean)
  const fileName = parts.pop()
  if (!fileName) throw new ApiError(500, 'Config target must be a file path')

  // Docker applies each tar header's owner and mode to whatever it extracts,
  // including directories that already exist. A directory entry for e.g.
  // "/data" therefore re-owns it as root (and clamps its mode), which breaks
  // images that run the game process as an unprivileged user. Only add
  // directory entries for directories that are actually missing.
  const dirs: string[] = []
  let owner: Owner = { uid: 0, gid: 0 }
  let current = ''
  let missing = false
  for (const part of parts) {
    current = current ? `${current}/${part}` : part
    if (!missing) {
      const dirOwner = await directoryOwner(container, `/${current}`)
      if (dirOwner) {
        owner = dirOwner
        continue
      }
      missing = true
    }
    dirs.push(`${current}/`)
  }

  const archive = await buildArchive([...parts, fileName].join('/'), content, {
    dirs,
    owner,
  })
  try {
    await container.putArchive(archive, { path: '/' })
  } catch (error) {
    throw new ApiError(
      502,
      `Could not write the rendered config into the container: ${dockerErrorMessage(error)}`,
    )
  }
}

async function directoryOwner(
  container: Docker.Container,
  dir: string,
): Promise<Owner | null> {
  let stream: NodeJS.ReadableStream
  try {
    stream = await container.getArchive({ path: dir })
  } catch (error) {
    if (isDockerNotFound(error)) return null
    throw new ApiError(
      502,
      `Could not inspect "${dir}" inside the container: ${dockerErrorMessage(error)}`,
    )
  }

  const readable = stream as NodeJS.ReadableStream & { destroy?: () => void }
  try {
    return await readArchiveOwner(stream)
  } finally {
    readable.destroy?.()
  }
}

function readArchiveOwner(stream: NodeJS.ReadableStream): Promise<Owner> {
  return new Promise((resolve, reject) => {
    const extractor = tar.extract()
    let settled = false

    const fail = (error: unknown) => {
      if (settled) return
      settled = true
      reject(error instanceof Error ? error : new Error(String(error)))
    }

    extractor.on('entry', (header, entry) => {
      entry.resume()
      if (settled) return
      settled = true
      resolve({ uid: header.uid ?? 0, gid: header.gid ?? 0 })
    })
    extractor.on('error', fail)
    extractor.on('finish', () =>
      fail(new Error('Docker returned an empty archive')),
    )
    stream.on('error', fail)
    stream.pipe(extractor)
  })
}

export async function listManagedContainers(): Promise<Docker.ContainerInfo[]> {
  try {
    return await docker.listContainers({
      all: true,
      filters: { label: [`${LABEL_MANAGED}=true`] },
    })
  } catch (error) {
    throw new ApiError(
      502,
      `Could not reach the Docker daemon: ${dockerErrorMessage(error)}`,
    )
  }
}

export async function inspectContainer(
  containerId: string,
): Promise<Docker.ContainerInspectInfo> {
  try {
    return await docker.getContainer(containerId).inspect()
  } catch (error) {
    if (isDockerNotFound(error)) {
      throw new ApiError(404, 'Container not found')
    }
    throw new ApiError(502, dockerErrorMessage(error))
  }
}

export async function removeContainer(containerId: string): Promise<void> {
  try {
    await docker.getContainer(containerId).remove({ force: true })
  } catch (error) {
    if (isDockerNotFound(error)) return
    throw new ApiError(502, dockerErrorMessage(error))
  }
}

export async function startContainer(containerId: string): Promise<void> {
  try {
    await docker.getContainer(containerId).start()
  } catch (error) {
    throw new ApiError(502, dockerErrorMessage(error))
  }
}

export async function restartContainer(containerId: string): Promise<void> {
  try {
    await docker.getContainer(containerId).restart()
  } catch (error) {
    throw new ApiError(502, dockerErrorMessage(error))
  }
}

export async function containerLogs(
  containerId: string,
): Promise<NodeJS.ReadableStream> {
  try {
    return await docker.getContainer(containerId).logs({
      follow: true,
      stdout: true,
      stderr: true,
      tail: 200,
      timestamps: false,
    })
  } catch (error) {
    throw new ApiError(502, dockerErrorMessage(error))
  }
}

export function demuxLogs(
  stream: NodeJS.ReadableStream,
  stdout: NodeJS.WritableStream,
  stderr: NodeJS.WritableStream,
): void {
  docker.modem.demuxStream(stream, stdout, stderr)
}

export function buildArchive(
  entryPath: string,
  content: string,
  options: ArchiveOptions = {},
): Promise<Buffer> {
  const { dirs = [], owner = { uid: 0, gid: 0 } } = options
  return new Promise((resolve, reject) => {
    const pack = tar.pack()
    const chunks: Buffer[] = []

    pack.on('data', (chunk: unknown) => chunks.push(chunk as Buffer))
    pack.on('error', reject)
    pack.on('end', () => resolve(Buffer.concat(chunks)))

    for (const dir of dirs) {
      pack.entry({
        name: dir,
        type: 'directory',
        mode: 0o755,
        uid: owner.uid,
        gid: owner.gid,
      })
    }

    pack.entry(
      {
        name: entryPath,
        mode: 0o644,
        type: 'file',
        uid: owner.uid,
        gid: owner.gid,
      },
      content,
    )
    pack.finalize()
  })
}

export function containerIp(
  inspect: Docker.ContainerInspectInfo,
  network?: string,
): string | null {
  const networks = inspect.NetworkSettings?.Networks
  if (!networks) return null

  if (network) {
    return networks[network]?.IPAddress || null
  }

  for (const entry of Object.values(networks)) {
    if (entry.IPAddress) return entry.IPAddress
  }
  return null
}
