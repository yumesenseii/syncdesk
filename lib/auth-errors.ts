export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("Failed to fetch")) {
      return "Unable to reach Supabase. Check your internet connection and Supabase URL/key."
    }
    return error.message
  }

  return "Something went wrong. Please try again."
}
