import { create } from 'zustand'
import type { GameImage, ImagePullJob } from '@/types'
import { api } from '@/lib/api'

interface ImageStore {
  images: GameImage[]
  loading: boolean
  error: string | null
  fetchImages: () => Promise<void>
  pull: (ref: string) => Promise<ImagePullJob>
  pullAll: () => Promise<ImagePullJob>
  clearError: () => void
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const useImageStore = create<ImageStore>((set, get) => ({
  images: [],
  loading: true,
  error: null,

  fetchImages: async () => {
    if (get().images.length === 0) set({ loading: true })
    try {
      const images = await api.images()
      set({ images, loading: false, error: null })
    } catch (error) {
      set({ loading: false, error: messageFrom(error) })
    }
  },

  pull: async (ref) => {
    set({ error: null })
    try {
      return await api.pullImage(ref)
    } catch (error) {
      set({ error: messageFrom(error) })
      throw error
    }
  },

  pullAll: async () => {
    set({ error: null })
    try {
      return await api.pullAllImages()
    } catch (error) {
      set({ error: messageFrom(error) })
      throw error
    }
  },

  clearError: () => set({ error: null }),
}))