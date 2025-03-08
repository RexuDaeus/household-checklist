import { redirect } from "next/navigation"
import { cookies } from "next/headers"

export default function Home() {
  const cookieStore = cookies()
  const isLoggedIn = cookieStore.get("user")

  if (!isLoggedIn) {
    redirect("/login")
  } else {
    redirect("/dashboard")
  }

  return null
}

