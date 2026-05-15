"use client"

import { useMemo } from "react"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { toast } from "sonner"

import type {
  BoardMeta,
  BoardSettings,
  BoardTask,
  KanbanColumnId,
  TeamMember,
  WorkspaceEntity,
} from "@/lib/boards/types"
import { DEFAULT_BOARD_SETTINGS } from "@/lib/boards/seed"
import { applyTaskMove } from "@/lib/boards/reorder-tasks"
import { newTaskUuid, nextSortOrder } from "@/lib/boards/task-utils"
import { ensureUniqueSlug } from "@/lib/boards/slug"
import * as taskActivity from "@/lib/activity/task-activity"
import { getBoardsRemoteContext } from "@/lib/syncdesk/boards-sync-context"
import * as remoteSync from "@/lib/syncdesk/boards-remote-sync"

/**
 * Stable empty array for Zustand selectors and lookups.
 * Never use `?? []` inside `useBoardsStore((s) => …)` — inline arrays break
 * React 19 getSnapshot caching and can cause infinite re-render loops.
 */
export const EMPTY_BOARD_TASKS: BoardTask[] = []

export function selectBoardTasks(state: BoardsState, boardId: string): BoardTask[] {
  return state.tasksByBoardId[boardId] ?? EMPTY_BOARD_TASKS
}

function workspaceActivityCtx(
  workspaces: WorkspaceEntity[],
  workspaceId: string
): { name: string; slug: string } | undefined {
  const ws = workspaces.find((w) => w.id === workspaceId)
  return ws ? { name: ws.name, slug: ws.slug } : undefined
}

function teamByIdMap(members: TeamMember[]) {
  return new Map(members.map((m) => [m.id, m]))
}

function newWorkspaceId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/** Valid UUID for local-only boards when Supabase is unavailable (matches DB uuid type). */
function newLocalBoardId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return newWorkspaceId()
}

export type CreateWorkspaceResult =
  | { ok: true }
  | { ok: false; message: string }

export interface BoardsState {
  workspaces: WorkspaceEntity[]
  boardsById: Record<string, BoardMeta>
  tasksByBoardId: Record<string, BoardTask[]>
  teamMembers: TeamMember[]
  /** First remote pull finished (or skipped when offline). */
  remoteReady: boolean
  setRemoteReady: (ready: boolean) => void
  /** Workspace selected in the dashboard top bar (shared with welcome CTA). */
  activeWorkspaceId: string | null
  setActiveWorkspaceId: (id: string | null) => void
  createWorkspace: (name: string, icon: string) => Promise<CreateWorkspaceResult>
  renameWorkspace: (workspaceId: string, name: string) => void
  updateWorkspace: (workspaceId: string, patch: { name?: string; icon?: string; memberIds?: string[] }) => void
  deleteWorkspace: (workspaceId: string) => void
  toggleWorkspaceExpanded: (workspaceId: string) => void
  createBoard: (workspaceId: string, name: string) => Promise<string | null>
  renameBoard: (boardId: string, name: string) => void
  updateBoardMeta: (boardId: string, patch: Partial<Pick<BoardMeta, "name" | "description">>) => void
  updateBoardSettings: (boardId: string, patch: Partial<BoardSettings>) => void
  duplicateBoard: (boardId: string) => Promise<string | null>
  deleteBoard: (boardId: string) => void
  moveTask: (
    boardId: string,
    taskId: string,
    columnId: KanbanColumnId,
    beforeTaskId?: string | null
  ) => void
  updateTask: (boardId: string, taskId: string, patch: Partial<Omit<BoardTask, "id">>) => void
  addTask: (boardId: string, task: Omit<BoardTask, "id">) => void
  removeTask: (boardId: string, taskId: string) => void
}

const defaultState = {
  workspaces: [] as WorkspaceEntity[],
  boardsById: {} as Record<string, BoardMeta>,
  tasksByBoardId: {} as Record<string, BoardTask[]>,
  teamMembers: [] as TeamMember[],
  remoteReady: false,
  activeWorkspaceId: null as string | null,
}

export const useBoardsStore = create<BoardsState>()(
  persist(
    (set, get) => ({
      ...defaultState,

      setRemoteReady: (ready) => set({ remoteReady: ready }),

      setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),

      createWorkspace: async (name, icon) => {
        const trimmed = name.trim()
        if (!trimmed) {
          return { ok: false as const, message: "Workspace name is required." }
        }
        const id = newWorkspaceId()
        const prev = get()
        const slug = ensureUniqueSlug(
          trimmed,
          prev.workspaces.map((w) => w.slug)
        )
        const sortOrder = prev.workspaces.length
        const { client, userId } = getBoardsRemoteContext()
        const ownerMemberIds = userId ? [userId] : []
        set((s) => ({
          workspaces: [
            ...s.workspaces,
            {
              id,
              slug,
              name: trimmed,
              icon: icon.trim() || "📂",
              expanded: true,
              boardIds: [],
              memberIds: ownerMemberIds,
            },
          ],
          ...(userId
            ? {
                teamMembers: mergeTeamMembers(s.teamMembers, [
                  {
                    id: userId,
                    userId,
                    name: "You",
                    initials: "YO",
                    color: "bg-primary/15 text-primary",
                    role: "owner",
                  },
                ]),
              }
            : {}),
        }))
        if (!client || !userId) {
          return { ok: true as const }
        }
        const { error } = await remoteSync.remoteInsertWorkspace(client, userId, {
          id,
          slug,
          name: trimmed,
          icon: icon.trim() || "📂",
          expanded: true,
          memberIds: ownerMemberIds,
          sortOrder,
        })
        if (error) {
          set({ workspaces: prev.workspaces })
          return { ok: false as const, message: error.message }
        }
        taskActivity.logWorkspaceCreated(id, trimmed, slug)
        return { ok: true as const }
      },

      renameWorkspace: (workspaceId, name) => {
        const trimmed = name.trim()
        if (!trimmed) return
        const prev = get()
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === workspaceId ? { ...w, name: trimmed } : w
          ),
        }))
        const { client } = getBoardsRemoteContext()
        if (!client) return
        void remoteSync.remoteUpdateWorkspace(client, workspaceId, { name: trimmed }).then(({ error }) => {
          if (error) {
            toast.error(error.message)
            set({ workspaces: prev.workspaces })
            return
          }
          const ws = get().workspaces.find((w) => w.id === workspaceId)
          if (ws) taskActivity.logWorkspaceUpdated(workspaceId, ws.name, ws.slug)
        })
      },

      updateWorkspace: (workspaceId, patch) => {
        const prev = get()
        const cleaned: { name?: string; icon?: string; memberIds?: string[] } = {}
        if (typeof patch.name === "string") {
          const t = patch.name.trim()
          if (t) cleaned.name = t
        }
        if (typeof patch.icon === "string") {
          const t = patch.icon.trim()
          if (t) cleaned.icon = t
        }
        if (Array.isArray(patch.memberIds)) cleaned.memberIds = patch.memberIds
        if (Object.keys(cleaned).length === 0) return
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === workspaceId
              ? {
                  ...w,
                  ...(cleaned.name !== undefined ? { name: cleaned.name } : {}),
                  ...(cleaned.icon !== undefined ? { icon: cleaned.icon } : {}),
                  ...(cleaned.memberIds !== undefined ? { memberIds: cleaned.memberIds } : {}),
                }
              : w
          ),
        }))
        const { client } = getBoardsRemoteContext()
        if (!client) return
        void remoteSync.remoteUpdateWorkspace(client, workspaceId, cleaned).then(({ error }) => {
          if (error) {
            toast.error(error.message)
            set({ workspaces: prev.workspaces })
            return
          }
          if (cleaned.name !== undefined || cleaned.icon !== undefined) {
            const ws = get().workspaces.find((w) => w.id === workspaceId)
            if (ws) taskActivity.logWorkspaceUpdated(workspaceId, ws.name, ws.slug)
          }
        })
      },

      deleteWorkspace: (workspaceId) => {
        const prev = get()
        const deleted = prev.workspaces.find((w) => w.id === workspaceId)
        const anchor = prev.workspaces.find((w) => w.id !== workspaceId)
        if (deleted) {
          if (anchor) {
            taskActivity.logWorkspaceDeleted(
              anchor.id,
              { id: deleted.id, name: deleted.name, slug: deleted.slug },
              { name: anchor.name, slug: anchor.slug }
            )
          } else {
            taskActivity.logWorkspaceDeleted(
              deleted.id,
              { id: deleted.id, name: deleted.name, slug: deleted.slug },
              null
            )
          }
        }
        set((s) => {
          const ws = s.workspaces.find((w) => w.id === workspaceId)
          if (!ws) return s
          const nextBoards = { ...s.boardsById }
          const nextTasks = { ...s.tasksByBoardId }
          for (const bid of ws.boardIds) {
            delete nextBoards[bid]
            delete nextTasks[bid]
          }
          return {
            workspaces: s.workspaces.filter((w) => w.id !== workspaceId),
            boardsById: nextBoards,
            tasksByBoardId: nextTasks,
          }
        })
        const { client } = getBoardsRemoteContext()
        if (!client) return
        void remoteSync.remoteDeleteWorkspace(client, workspaceId).then(({ error }) => {
          if (error) {
            toast.error(error.message)
            set({
              workspaces: prev.workspaces,
              boardsById: prev.boardsById,
              tasksByBoardId: prev.tasksByBoardId,
            })
          }
        })
      },

      toggleWorkspaceExpanded: (workspaceId) => {
        const prev = get()
        const ws = prev.workspaces.find((w) => w.id === workspaceId)
        const expanded = ws ? !ws.expanded : true
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === workspaceId ? { ...w, expanded: !w.expanded } : w
          ),
        }))
        const { client } = getBoardsRemoteContext()
        if (!client) return
        void remoteSync.remoteUpdateWorkspace(client, workspaceId, { expanded }).then(({ error }) => {
          if (error) {
            toast.error(error.message)
            set({ workspaces: prev.workspaces })
          }
        })
      },

      createBoard: (workspaceId, name) => {
        const trimmed = name.trim()
        if (!trimmed) return Promise.resolve(null)
        const ws = get().workspaces.find((w) => w.id === workspaceId)
        if (!ws) return Promise.resolve(null)
        const { client, userId } = getBoardsRemoteContext()
        if (!client || !userId) {
          const id = newLocalBoardId()
          set((s) => {
            const w = s.workspaces.find((x) => x.id === workspaceId)
            if (!w) return s
            return {
              boardsById: {
                ...s.boardsById,
                [id]: { id, workspaceId, name: trimmed },
              },
              tasksByBoardId: { ...s.tasksByBoardId, [id]: [] },
              workspaces: s.workspaces.map((x) =>
                x.id === workspaceId ? { ...x, boardIds: [...x.boardIds, id] } : x
              ),
            }
          })
          return Promise.resolve(id)
        }
        return (async () => {
          const sortOrder = await remoteSync.remoteNextBoardSortOrder(client, workspaceId)
          const { data: board, error } = await remoteSync.remoteInsertBoard(client, {
            workspaceId,
            name: trimmed,
            sortOrder,
          })
          if (error || !board) {
            toast.error(error?.message ?? "Could not create board.")
            return null
          }
          set((s) => {
            const w = s.workspaces.find((x) => x.id === workspaceId)
            if (!w) return s
            return {
              boardsById: { ...s.boardsById, [board.id]: board },
              tasksByBoardId: { ...s.tasksByBoardId, [board.id]: [] },
              workspaces: s.workspaces.map((x) =>
                x.id === workspaceId ? { ...x, boardIds: [...x.boardIds, board.id] } : x
              ),
            }
          })
          taskActivity.logBoardCreated(
            workspaceId,
            board,
            workspaceActivityCtx(get().workspaces, workspaceId)
          )
          return board.id
        })()
      },

      renameBoard: (boardId, name) => {
        const trimmed = name.trim()
        if (!trimmed) return
        const prev = get()
        set((s) => {
          const b = s.boardsById[boardId]
          if (!b) return s
          return {
            boardsById: { ...s.boardsById, [boardId]: { ...b, name: trimmed } },
          }
        })
        const { client } = getBoardsRemoteContext()
        if (!client) return
        void remoteSync.remoteRenameBoard(client, boardId, trimmed).then(({ error }) => {
          if (error) {
            toast.error(error.message)
            set({ boardsById: prev.boardsById })
            return
          }
          const b = get().boardsById[boardId]
          if (b) {
            taskActivity.logBoardUpdated(
              b.workspaceId,
              b,
              workspaceActivityCtx(get().workspaces, b.workspaceId)
            )
          }
        })
      },

      updateBoardMeta: (boardId, patch) => {
        const prev = get()
        set((s) => {
          const b = s.boardsById[boardId]
          if (!b) return s
          const next: BoardMeta = { ...b }
          if (typeof patch.name === "string") {
            const t = patch.name.trim()
            if (t) next.name = t
          }
          if (typeof patch.description === "string") {
            next.description = patch.description.trim() || undefined
          }
          return { boardsById: { ...s.boardsById, [boardId]: next } }
        })
        const b = get().boardsById[boardId]
        const { client } = getBoardsRemoteContext()
        if (!client || !b) return
        void remoteSync
          .remoteUpdateBoardMeta(client, boardId, {
            name: b.name,
            description: b.description ?? null,
          })
          .then(({ error }) => {
            if (error) {
              toast.error(error.message)
              set({ boardsById: prev.boardsById })
              return
            }
            const b = get().boardsById[boardId]
            if (b) {
              taskActivity.logBoardUpdated(
                b.workspaceId,
                b,
                workspaceActivityCtx(get().workspaces, b.workspaceId)
              )
            }
          })
      },

      updateBoardSettings: (boardId, patch) => {
        const prev = get()
        set((s) => {
          const b = s.boardsById[boardId]
          if (!b) return s
          const current = b.settings ?? DEFAULT_BOARD_SETTINGS
          const merged: BoardSettings = {
            ...current,
            ...patch,
            notifications: {
              ...current.notifications,
              ...(patch.notifications ?? {}),
            },
            automation: {
              ...current.automation,
              ...(patch.automation ?? {}),
            },
            labels: patch.labels ?? current.labels,
          }
          return {
            boardsById: { ...s.boardsById, [boardId]: { ...b, settings: merged } },
          }
        })
        const settings = get().boardsById[boardId]?.settings ?? DEFAULT_BOARD_SETTINGS
        const { client } = getBoardsRemoteContext()
        if (!client) return
        void remoteSync.remoteUpdateBoardSettings(client, boardId, settings).then(({ error }) => {
          if (error) {
            toast.error(error.message)
            set({ boardsById: prev.boardsById })
          }
        })
      },

      duplicateBoard: async (boardId) => {
        const state = get()
        const original = state.boardsById[boardId]
        if (!original) return null
        const sourceTasks = state.tasksByBoardId[boardId] ?? []
        const clonedPayloads = sourceTasks.map(({ id: _id, ...t }) => t)
        const { client, userId } = getBoardsRemoteContext()

        if (!client || !userId) {
          const newBoardId = newLocalBoardId()
          const clonedTasks = clonedPayloads.map((t) => ({ ...t, id: newTaskUuid() }))
          set((s) => ({
            boardsById: {
              ...s.boardsById,
              [newBoardId]: {
                id: newBoardId,
                workspaceId: original.workspaceId,
                name: `${original.name} (copy)`,
                description: original.description,
                settings: original.settings,
              },
            },
            tasksByBoardId: { ...s.tasksByBoardId, [newBoardId]: clonedTasks },
            workspaces: s.workspaces.map((w) =>
              w.id === original.workspaceId
                ? { ...w, boardIds: [...w.boardIds, newBoardId] }
                : w
            ),
          }))
          return newBoardId
        }

        const sortOrder = await remoteSync.remoteNextBoardSortOrder(client, original.workspaceId)
        const r1 = await remoteSync.remoteInsertBoard(client, {
          workspaceId: original.workspaceId,
          name: `${original.name} (copy)`,
          description: original.description,
          settings: original.settings,
          sortOrder,
        })
        if (r1.error || !r1.data) {
          toast.error(r1.error?.message ?? "Could not duplicate board.")
          return null
        }
        const board = r1.data
        const newBoardId = board.id
        const r2 = await remoteSync.remoteInsertTasks(client, userId, newBoardId, clonedPayloads)
        if (r2.error || !r2.data) {
          toast.error(r2.error?.message ?? "Could not copy tasks.")
          await remoteSync.remoteDeleteBoard(client, newBoardId)
          return null
        }
        set((s) => ({
          boardsById: { ...s.boardsById, [newBoardId]: board },
          tasksByBoardId: { ...s.tasksByBoardId, [newBoardId]: r2.data },
          workspaces: s.workspaces.map((w) =>
            w.id === original.workspaceId
              ? { ...w, boardIds: [...w.boardIds, newBoardId] }
              : w
          ),
        }))
        taskActivity.logBoardCreated(
          original.workspaceId,
          board,
          workspaceActivityCtx(get().workspaces, original.workspaceId)
        )
        return newBoardId
      },

      deleteBoard: (boardId) => {
        const prev = get()
        const deletedBoard = prev.boardsById[boardId]
        set((s) => {
          const b = s.boardsById[boardId]
          if (!b) return s
          const nextBoards = { ...s.boardsById }
          delete nextBoards[boardId]
          const nextTasks = { ...s.tasksByBoardId }
          delete nextTasks[boardId]
          return {
            boardsById: nextBoards,
            tasksByBoardId: nextTasks,
            workspaces: s.workspaces.map((w) =>
              w.id === b.workspaceId
                ? { ...w, boardIds: w.boardIds.filter((id) => id !== boardId) }
                : w
            ),
          }
        })
        const { client } = getBoardsRemoteContext()
        if (!client) return
        void remoteSync.remoteDeleteBoard(client, boardId).then(({ error }) => {
          if (error) {
            toast.error(error.message)
            set({
              workspaces: prev.workspaces,
              boardsById: prev.boardsById,
              tasksByBoardId: prev.tasksByBoardId,
            })
            return
          }
          if (deletedBoard) {
            taskActivity.logBoardDeleted(
              deletedBoard.workspaceId,
              deletedBoard.name,
              workspaceActivityCtx(get().workspaces, deletedBoard.workspaceId)
            )
          }
        })
      },

      moveTask: (boardId, taskId, columnId, beforeTaskId) => {
        const prev = get()
        const prevTask = prev.tasksByBoardId[boardId]?.find((t) => t.id === taskId)
        const now = Date.now()
        const list = prev.tasksByBoardId[boardId]
        if (!list) return

        const nextList = applyTaskMove(list, taskId, columnId, beforeTaskId).map((t) => {
          if (t.id !== taskId) return t
          const patched: BoardTask = { ...t, updatedAt: now }
          if (columnId === "completed") {
            if (typeof patched.completedAt !== "number") patched.completedAt = now
          } else if (typeof patched.completedAt === "number") {
            delete patched.completedAt
          }
          return patched
        })

        set((s) => ({
          tasksByBoardId: { ...s.tasksByBoardId, [boardId]: nextList },
        }))

        const moved = nextList.find((t) => t.id === taskId)
        const { client } = getBoardsRemoteContext()
        if (!client || !moved) return

        const updates = nextList
          .filter((t) => t.columnId === columnId)
          .map((t, i) => ({ id: t.id, columnId: t.columnId, sortOrder: i }))

        void remoteSync.remoteSyncTaskOrders(client, updates).then(({ error }) => {
          if (error) {
            toast.error(error.message)
            set({ tasksByBoardId: prev.tasksByBoardId })
            return
          }
          const board = get().boardsById[boardId]
          if (!board || !prevTask || !moved) return
          const wsCtx = workspaceActivityCtx(get().workspaces, board.workspaceId)
          if (columnId === "completed" && prevTask.columnId !== "completed") {
            taskActivity.logTaskCompleted(board.workspaceId, board, moved, wsCtx)
          } else if (prevTask.columnId !== columnId) {
            taskActivity.logTaskMoved(
              board.workspaceId,
              board,
              moved,
              prevTask.columnId,
              columnId,
              wsCtx
            )
          }
        })
      },

      updateTask: (boardId, taskId, patch) => {
        const prev = get()
        const prevTask = prev.tasksByBoardId[boardId]?.find((t) => t.id === taskId)
        const now = Date.now()
        set((s) => {
          const list = s.tasksByBoardId[boardId]
          if (!list) return s
          return {
            tasksByBoardId: {
              ...s.tasksByBoardId,
              [boardId]: list.map((t) => {
                if (t.id !== taskId) return t
                const next: BoardTask = { ...t, ...patch }
                // Keep `completedAt` consistent with the live `columnId`: stamp
                // it when entering the completed column and clear it when
                // leaving. This avoids stale timestamps lingering after a
                // task is reopened, which would otherwise inflate the
                // velocity chart.
                if (patch.columnId === "completed" && typeof next.completedAt !== "number") {
                  next.completedAt = now
                } else if (
                  patch.columnId !== undefined &&
                  patch.columnId !== "completed" &&
                  typeof next.completedAt === "number"
                ) {
                  delete next.completedAt
                }
                const withTs: BoardTask = { ...next, updatedAt: now }
                return withTs
              }),
            },
          }
        })
        const task = get().tasksByBoardId[boardId]?.find((t) => t.id === taskId)
        const { client, userId } = getBoardsRemoteContext()
        if (!client || !userId || !task) return
        void remoteSync.remoteUpdateTaskRow(client, userId, boardId, task).then(({ error }) => {
          if (error) {
            toast.error(error.message)
            set({ tasksByBoardId: prev.tasksByBoardId })
            return
          }
          const board = get().boardsById[boardId]
          if (!board || !prevTask) return
          taskActivity.logTaskChanges(
            board.workspaceId,
            board,
            prevTask,
            task,
            teamByIdMap(get().teamMembers),
            workspaceActivityCtx(get().workspaces, board.workspaceId)
          )
        })
      },

      addTask: (boardId, task) => {
        const now = Date.now()
        const prev = get()
        const list = prev.tasksByBoardId[boardId] ?? []
        const taskBody: Omit<BoardTask, "id"> = {
          ...task,
          sortOrder: nextSortOrder(list, task.columnId),
          createdAt: typeof task.createdAt === "number" ? task.createdAt : now,
          updatedAt: now,
          completedAt:
            task.columnId === "completed"
              ? typeof task.completedAt === "number"
                ? task.completedAt
                : now
              : undefined,
        }
        const { client, userId } = getBoardsRemoteContext()

        if (!client || !userId) {
          const nextTask: BoardTask = { ...taskBody, id: newTaskUuid() }
          set((s) => {
            const current = s.tasksByBoardId[boardId]
            if (!current) return s
            return {
              tasksByBoardId: {
                ...s.tasksByBoardId,
                [boardId]: [...current, nextTask],
              },
            }
          })
          return
        }

        const optimisticId = newTaskUuid()
        const optimisticTask: BoardTask = { ...taskBody, id: optimisticId }
        set((s) => {
          const current = s.tasksByBoardId[boardId]
          if (!current) return s
          return {
            tasksByBoardId: {
              ...s.tasksByBoardId,
              [boardId]: [...current, optimisticTask],
            },
          }
        })

        void remoteSync.remoteInsertTask(client, userId, boardId, taskBody).then(({ data, error }) => {
          if (error) {
            toast.error(error.message)
            set({ tasksByBoardId: prev.tasksByBoardId })
            return
          }
          if (!data) return
          set((s) => {
            const current = s.tasksByBoardId[boardId]
            if (!current) return s
            return {
              tasksByBoardId: {
                ...s.tasksByBoardId,
                [boardId]: current.map((t) => (t.id === optimisticId ? data : t)),
              },
            }
          })
          const board = get().boardsById[boardId]
          if (board) {
            taskActivity.logTaskCreated(
              board.workspaceId,
              board,
              data,
              workspaceActivityCtx(get().workspaces, board.workspaceId)
            )
          }
        })
      },

      removeTask: (boardId, taskId) => {
        const prev = get()
        const board = prev.boardsById[boardId]
        const task = prev.tasksByBoardId[boardId]?.find((t) => t.id === taskId)
        set((s) => {
          const list = s.tasksByBoardId[boardId]
          if (!list) return s
          return {
            tasksByBoardId: {
              ...s.tasksByBoardId,
              [boardId]: list.filter((t) => t.id !== taskId),
            },
          }
        })
        if (board && task) {
          taskActivity.logTaskDeleted(
            board.workspaceId,
            board,
            task,
            workspaceActivityCtx(prev.workspaces, board.workspaceId)
          )
        }
        const { client } = getBoardsRemoteContext()
        if (!client) return
        void remoteSync.remoteDeleteTask(client, taskId).then(({ error }) => {
          if (error) {
            toast.error(error.message)
            set({ tasksByBoardId: prev.tasksByBoardId })
          }
        })
      },
    }),
    {
      name: "syncdesk-boards",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        workspaces: s.workspaces,
        boardsById: s.boardsById,
        tasksByBoardId: s.tasksByBoardId,
      }),
      skipHydration: true,
      version: 2,
      migrate: (state, version) => {
        if (!state || typeof state !== "object") return state as never
        const next = state as { workspaces?: Partial<WorkspaceEntity>[] }
        // v1 → v2: backfill `slug` on persisted workspaces that predate the
        // slug-aware schema. The slug defaults to the existing id so legacy
        // URLs continue to resolve until the workspace is renamed.
        if (version < 2 && Array.isArray(next.workspaces)) {
          next.workspaces = next.workspaces.map((w) => ({
            ...w,
            slug: typeof w.slug === "string" && w.slug.length > 0 ? w.slug : (w.id as string),
          }))
        }
        return next as never
      },
    }
  )
)

/** Stable selector for a board's task list (avoids `?? []` in inline selectors). */
export function useBoardTasks(boardId: string) {
  const selector = useMemo(
    () => (s: BoardsState) => s.tasksByBoardId[boardId] ?? EMPTY_BOARD_TASKS,
    [boardId]
  )
  return useBoardsStore(selector)
}

export function getWorkspaceStats(
  ws: WorkspaceEntity,
  tasksByBoardId: Record<string, BoardTask[]>,
  teamById: Map<string, TeamMember>
) {
  let total = 0
  let overdue = 0
  let completed = 0
  for (const bid of ws.boardIds) {
    const tasks = tasksByBoardId[bid] ?? EMPTY_BOARD_TASKS
    for (const t of tasks) {
      total += 1
      if (t.overdue) overdue += 1
      if (t.columnId === "completed") completed += 1
    }
  }
  const progressPct = total === 0 ? 0 : Math.round((completed / total) * 100)
  const members = ws.memberIds.map((id) => teamById.get(id)).filter(Boolean) as TeamMember[]
  return {
    boardCount: ws.boardIds.length,
    totalTasks: total,
    overdueTasks: overdue,
    progressPct,
    members,
  }
}

export function rehydrateBoardsStore() {
  return useBoardsStore.persist.rehydrate()
}

/**
 * Resolve a workspace by either its URL slug (preferred) or its stable id. The
 * id fallback exists for legacy bookmarks that still embed the raw workspace id
 * in the URL — once they navigate through any new Link the route normalizes to
 * the slug form.
 */
export function mergeTeamMembers(
  existing: TeamMember[],
  incoming: TeamMember[]
): TeamMember[] {
  const map = new Map(existing.map((m) => [m.id, m]))
  for (const m of incoming) map.set(m.id, m)
  return Array.from(map.values())
}

export function getWorkspaceMembers(
  workspace: WorkspaceEntity,
  teamMembers: TeamMember[]
): TeamMember[] {
  const byId = new Map(teamMembers.map((m) => [m.id, m]))
  return workspace.memberIds
    .map((id) => byId.get(id))
    .filter((m): m is TeamMember => Boolean(m))
}

export function getWorkspaceByIdOrSlug(
  workspaces: WorkspaceEntity[],
  slugOrId: string | null | undefined
): WorkspaceEntity | null {
  if (!slugOrId) return null
  const normalized = slugOrId.toLowerCase()
  const bySlug = workspaces.find((w) => w.slug.toLowerCase() === normalized)
  if (bySlug) return bySlug
  return workspaces.find((w) => w.id === slugOrId) ?? null
}

export function getBoardHealth(tasks: BoardTask[], teamById: Map<string, TeamMember>) {
  const total = tasks.length
  let completed = 0
  let overdue = 0
  const tally = new Map<string, number>()
  for (const t of tasks) {
    if (t.columnId === "completed") completed += 1
    if (t.overdue) overdue += 1
    for (const a of t.assignees) {
      tally.set(a.id, (tally.get(a.id) ?? 0) + 1)
    }
  }
  let topId: string | null = null
  let topCount = 0
  for (const [id, count] of tally) {
    if (count > topCount) {
      topId = id
      topCount = count
    }
  }
  const completionPct = total === 0 ? 0 : Math.round((completed / total) * 100)
  return {
    total,
    completed,
    overdue,
    completionPct,
    mostActive: topId ? (teamById.get(topId) ?? null) : null,
    mostActiveCount: topCount,
  }
}
