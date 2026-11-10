export interface MeUser {
  id: number
  telegram_id: number
  username: string | null
  first_name: string
  last_name: string | null
  photo_url: string | null
  role: 'student' | 'admin'
}

export interface MeProfile {
  college: string | null
  specialty: string | null
  course: number | null
  group_name: string | null
  timezone: string
}

export interface MeResponse {
  user: MeUser
  profile: MeProfile | null
}