import { useLiveQuery } from 'dexie-react-hooks'
import { tasksDueToday, taskViews, type TaskView } from '@/services/tasks'

/** Every daily task with its progress, newest first, kept live. */
export function useTaskViews(): TaskView[] | undefined {
  return useLiveQuery(() => taskViews(), [])
}

/** The tasks due today, oldest first, kept live. */
export function useTodayTasks(): TaskView[] | undefined {
  return useLiveQuery(() => tasksDueToday(), [])
}
