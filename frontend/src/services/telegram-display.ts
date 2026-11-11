export interface TelegramGreetingUser {
  first_name: string
  username?: string
}

export function telegramGreetingName(
  user: TelegramGreetingUser | null,
  maxUsernameLength = 12,
): string | null {
  if (!user) return null
  if (!user.username) return user.first_name

  const username = user.username.length > maxUsernameLength
    ? `${user.username.slice(0, maxUsernameLength)}…`
    : user.username

  return `@${username}`
}
