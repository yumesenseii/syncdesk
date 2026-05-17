"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { toast } from "sonner"

import { invalidateActivityFeed } from "@/lib/activity/activity-invalidation"
import * as taskActivity from "@/lib/activity/task-activity"
import type { BoardMeta, BoardTask, TeamMember } from "@/lib/boards/types"
import type { TaskComment } from "@/lib/boards/types"
import { resolveActorSnapshot } from "@/lib/activity/resolve-actor"
import {
  notificationsKey,
  notificationsUnreadKey,
} from "@/lib/syncdesk/notifications-keys"
import { dispatchTaskCommentNotifications } from "@/lib/syncdesk/notifications-dispatch"
import {
  fetchTaskComments,
  insertTaskComment,
  mapTaskCommentRow,
  type TaskCommentRow,
} from "@/lib/syncdesk/task-comments-remote"
import { taskCommentsKey } from "@/lib/syncdesk/task-comments-keys"
import { getOptionalSupabaseClient } from "@/lib/supabase"
import { subscribeToPostgresChanges } from "@/lib/supabase/realtime/create-channel"
import { useBoardsStore } from "@/stores/boards-store"

export { taskCommentsKey } from "@/lib/syncdesk/task-comments-keys"

function mergeCommentDeduped(list: TaskComment[], incoming: TaskComment): TaskComment[] {
  if (list.some((c) => c.id === incoming.id)) return list
  return [incoming, ...list]
}

export function useTaskCommentsQuery(
  taskId: string | null | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: taskCommentsKey(taskId ?? "none"),
    enabled: Boolean(taskId && getOptionalSupabaseClient() && options?.enabled !== false),
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchOnMount: "always",
    queryFn: async () => {
      const client = getOptionalSupabaseClient()
      if (!client || !taskId) return []
      const { data, error } = await fetchTaskComments(client, taskId)
      if (error) throw error
      return data
    },
  })
}

export function useTaskCommentsRealtime(
  taskId: string | null | undefined,
  enabled: boolean,
  currentUserId: string | null | undefined
) {
  const qc = useQueryClient()

  useEffect(() => {
    const client = getOptionalSupabaseClient()
    if (!client || !taskId || !enabled) return

    return subscribeToPostgresChanges(client, {
      topic: `task_comments:${taskId}`,
      bindings: [
        {
          event: "INSERT",
          schema: "public",
          table: "task_comments",
          filter: `task_id=eq.${taskId}`,
        },
      ],
      onChange: async (payload) => {
        const row = payload.new as TaskCommentRow | undefined
        if (!row?.id || row.task_id !== taskId) return

        // Own inserts are handled via mutation optimistic cache.
        if (row.user_id === currentUserId) return

        const { data: profile } = await client
          .from("profiles")
          .select("id, display_name, avatar_url")
          .eq("id", row.user_id)
          .maybeSingle()

        const mapped = mapTaskCommentRow(row, profile)

        qc.setQueryData<TaskComment[]>(taskCommentsKey(taskId), (prev) =>
          mergeCommentDeduped(prev ?? [], mapped)
        )

        const boardId = useBoardsStore.getState().findBoardIdForTask(taskId)
        if (boardId) {
          const count = qc.getQueryData<TaskComment[]>(taskCommentsKey(taskId))?.length ?? 0
          useBoardsStore.getState().patchTaskLocal(boardId, taskId, { comments: count })
        }
      },
    })
  }, [qc, taskId, enabled, currentUserId])
}

export function useInsertTaskComment(options: {
  boardId: string
  board: BoardMeta | undefined
  task: BoardTask
  workspaceId: string
  workspaceName?: string
  workspaceSlug?: string
  assigneeIds: string[]
  workspaceMembers: TeamMember[]
  userId: string
  userEmail?: string | null
}) {
  const qc = useQueryClient()
  const {
    boardId,
    board,
    task,
    workspaceId,
    workspaceName,
    workspaceSlug,
    assigneeIds,
    workspaceMembers,
    userId,
    userEmail,
  } = options

  return useMutation({
    mutationFn: async (content: string) => {
      if (!task.id) throw new Error("Save the task before commenting.")
      const client = getOptionalSupabaseClient()
      if (!client) throw new Error("Supabase is not configured.")
      const trimmed = content.trim()
      if (!trimmed) throw new Error("Comment cannot be empty.")
      const { data, error } = await insertTaskComment(client, {
        taskId: task.id,
        userId,
        content: trimmed,
      })
      if (error) throw error
      if (!data) throw new Error("Comment was not saved.")
      const { data: profile } = await client
        .from("profiles")
        .select("id, display_name, avatar_url")
        .eq("id", userId)
        .maybeSingle()
      return mapTaskCommentRow(data, profile, userEmail)
    },
    onMutate: async (content) => {
      const key = taskCommentsKey(task.id)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<TaskComment[]>(key)
      const optimisticId = `optimistic-${Date.now()}`
      const actor = workspaceMembers.find((m) => m.id === userId)
      const optimistic: TaskComment = {
        id: optimisticId,
        authorId: userId,
        authorName: actor?.name ?? "You",
        initials: actor?.initials ?? "YO",
        color: actor?.color ?? "bg-primary/15 text-primary",
        avatarUrl: actor?.avatarUrl,
        text: content.trim(),
        createdAt: Date.now(),
      }
      qc.setQueryData<TaskComment[]>(key, (old) => mergeCommentDeduped(old ?? [], optimistic))
      return { prev, optimisticId }
    },
    onSuccess: async (saved, _content, ctx) => {
      const key = taskCommentsKey(task.id)
      qc.setQueryData<TaskComment[]>(key, (old) => {
        const withoutOptimistic = (old ?? []).filter((c) => c.id !== ctx?.optimisticId)
        return mergeCommentDeduped(withoutOptimistic, saved)
      })

      const count =
        qc.getQueryData<TaskComment[]>(key)?.length ??
        (task.comments ?? 0) + 1
      useBoardsStore.getState().patchTaskLocal(boardId, task.id, { comments: count })

      const client = getOptionalSupabaseClient()
      if (!client || !board) return

      const actor = await resolveActorSnapshot(client, userId, userEmail)
      taskActivity.logCommentAdded(workspaceId, board, task, saved.text, {
        name: workspaceName ?? "",
        slug: workspaceSlug ?? "",
      })

      const assignees = assigneeIds
        .map((id) => workspaceMembers.find((m) => m.id === id))
        .filter((m): m is TeamMember => Boolean(m))

      await dispatchTaskCommentNotifications({
        client,
        actorId: userId,
        actorName: actor.name,
        workspaceId,
        boardId: board.id,
        taskId: task.id,
        taskTitle: task.title,
        content: saved.text,
        assignees,
        workspaceMembers,
      })

      invalidateActivityFeed()
      void qc.invalidateQueries({ queryKey: notificationsKey(userId) })
      void qc.invalidateQueries({ queryKey: notificationsUnreadKey(userId) })
    },
    onError: (err: Error, _content, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(taskCommentsKey(task.id), ctx.prev)
      }
      toast.error(err.message)
    },
  })
}
