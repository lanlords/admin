import { create } from 'zustand'
import type {
  CreateServerRequest,
  GameServer,
  Options,
  ServerConfig,
  UpdateServerRequest,
} from '@/types'
import { api } from '@/lib/api'

interface ServerStore {
  // Config loaded from the backend
  config: ServerConfig | null
  configLoading: boolean
  configError: string | null
  fetchConfig: () => Promise<void>

  // Managed servers
  servers: GameServer[]
  loading: boolean
  error: string | null
  fetchServers: () => Promise<void>
  clearError: () => void

  // Actions
  createServer: (data: CreateServerRequest) => Promise<GameServer>
  updateServer: (id: string, updates: UpdateServerRequest) => Promise<GameServer>
  deleteServer: (id: string) => Promise<void>
  startServer: (id: string) => Promise<void>
  restartServer: (id: string) => Promise<void>

  // Enabled filters (slugs of games/teams to show in Create Server form)
  enabledGameSlugs: string[]
  enabledTeamSlugs: string[]
  saveOptions: (options: Options) => Promise<void>
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const useServerStore = create<ServerStore>((set, get) => ({
  config: null,
  configLoading: true,
  configError: null,
  fetchConfig: async () => {
    set({ configLoading: true, configError: null })
    try {
      const [config, options] = await Promise.all([
        api.config(),
        api.options(),
      ])
      set({
        config,
        configLoading: false,
        enabledGameSlugs: options.enabledGameSlugs,
        enabledTeamSlugs: options.enabledTeamSlugs,
      })
    } catch (error) {
      set({ configLoading: false, configError: messageFrom(error) })
    }
  },

  servers: [],
  loading: true,
  error: null,

  fetchServers: async () => {
    try {
      const servers = await api.servers()
      set({ servers, loading: false })
    } catch (error) {
      set({ loading: false, error: messageFrom(error) })
    }
  },

  clearError: () => set({ error: null }),

  createServer: async (data) => {
    set({ error: null })
    try {
      const server = await api.createServer(data)
      set((state) => ({ servers: [...state.servers, server] }))
      void get().fetchServers()
      return server
    } catch (error) {
      set({ error: messageFrom(error) })
      throw error
    }
  },

  updateServer: async (id, updates) => {
    set({ error: null })
    try {
      const server = await api.updateServer(id, updates)
      set((state) => ({
        servers: state.servers.map((entry) =>
          entry.id === id ? server : entry,
        ),
      }))
      return server
    } catch (error) {
      set({ error: messageFrom(error) })
      throw error
    }
  },

  deleteServer: async (id) => {
    set({ error: null })
    try {
      await api.deleteServer(id)
      set((state) => ({
        servers: state.servers.filter((entry) => entry.id !== id),
      }))
    } catch (error) {
      set({ error: messageFrom(error) })
      throw error
    }
  },

  startServer: async (id) => {
    set({ error: null })
    try {
      const server = await api.startServer(id)
      set((state) => ({
        servers: state.servers.map((entry) =>
          entry.id === id ? server : entry,
        ),
      }))
    } catch (error) {
      set({ error: messageFrom(error) })
      throw error
    }
  },

  restartServer: async (id) => {
    set({ error: null })
    try {
      const server = await api.restartServer(id)
      set((state) => ({
        servers: state.servers.map((entry) =>
          entry.id === id ? server : entry,
        ),
      }))
    } catch (error) {
      set({ error: messageFrom(error) })
      throw error
    }
  },

  enabledGameSlugs: [],
  enabledTeamSlugs: [],
  saveOptions: async (options) => {
    const previous = get()
    // Optimistically apply so the Create Server form updates immediately.
    set({
      enabledGameSlugs: options.enabledGameSlugs,
      enabledTeamSlugs: options.enabledTeamSlugs,
      error: null,
    })
    try {
      const saved = await api.updateOptions(options)
      set({
        enabledGameSlugs: saved.enabledGameSlugs,
        enabledTeamSlugs: saved.enabledTeamSlugs,
      })
    } catch (error) {
      set({
        enabledGameSlugs: previous.enabledGameSlugs,
        enabledTeamSlugs: previous.enabledTeamSlugs,
        error: messageFrom(error),
      })
    }
  },
}))
