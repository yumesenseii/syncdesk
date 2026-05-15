"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { getAuthErrorMessage } from "@/lib/auth-errors"
import { getOptionalSupabaseClient } from "@/lib/supabase"

export interface ProfileRow {
  id: string
  display_name: string | null
  avatar_url: string | null
  updated_at: string | null
}

const profileKey = (userId: string | null | undefined) => ["profile", userId ?? "anon"] as const

export function useProfile(userId: string | null | undefined) {
  return useQuery<ProfileRow | null>({
    queryKey: profileKey(userId),
    enabled: Boolean(userId && getOptionalSupabaseClient()),
    staleTime: 30_000,
    queryFn: async () => {
      const client = getOptionalSupabaseClient()
      if (!client || !userId) return null
      const { data, error } = await client
        .from("profiles")
        .select("id, display_name, avatar_url, updated_at")
        .eq("id", userId)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return (data as ProfileRow | null) ?? null
    },
  })
}

export interface UpdateProfileInput {
  displayName?: string
  avatarUrl?: string | null
}

export function useUpdateProfile(userId: string | null | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      const client = getOptionalSupabaseClient()
      if (!client || !userId) {
        throw new Error("Connect Supabase in .env.local to sync your profile.")
      }
      const profilePayload: Record<string, unknown> = {
        id: userId,
        updated_at: new Date().toISOString(),
      }
      if (typeof input.displayName === "string") {
        profilePayload.display_name = input.displayName.trim()
      }
      if (input.avatarUrl !== undefined) {
        profilePayload.avatar_url = input.avatarUrl
      }
      const { error: pErr } = await client
        .from("profiles")
        .upsert(profilePayload, { onConflict: "id" })
      if (pErr) throw new Error(pErr.message)

      const metadata: Record<string, unknown> = {}
      if (typeof input.displayName === "string") {
        metadata.full_name = input.displayName.trim()
      }
      if (input.avatarUrl !== undefined) {
        metadata.avatar_url = input.avatarUrl
      }
      if (Object.keys(metadata).length > 0) {
        const { error: uErr } = await client.auth.updateUser({ data: metadata })
        if (uErr) throw new Error(uErr.message)
      }
      return profilePayload as Partial<ProfileRow>
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: profileKey(userId) })
    },
    onError: (err) => {
      toast.error(getAuthErrorMessage(err))
    },
  })
}

export interface UpdateEmailInput {
  email: string
}

export function useUpdateEmail() {
  return useMutation({
    mutationFn: async (input: UpdateEmailInput) => {
      const client = getOptionalSupabaseClient()
      if (!client) throw new Error("Connect Supabase in .env.local to manage email.")
      const email = input.email.trim()
      if (!email) throw new Error("Email is required.")
      const { error } = await client.auth.updateUser({ email })
      if (error) throw new Error(error.message)
      return true
    },
    onError: (err) => {
      toast.error(getAuthErrorMessage(err))
    },
  })
}

export interface UpdatePasswordInput {
  password: string
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: async (input: UpdatePasswordInput) => {
      const client = getOptionalSupabaseClient()
      if (!client) throw new Error("Connect Supabase in .env.local to change password.")
      const password = input.password
      if (!password || password.length < 8) {
        throw new Error("Password must be at least 8 characters.")
      }
      const { error } = await client.auth.updateUser({ password })
      if (error) throw new Error(error.message)
      return true
    },
    onError: (err) => {
      toast.error(getAuthErrorMessage(err))
    },
  })
}
