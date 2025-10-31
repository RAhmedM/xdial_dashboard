"use client"

import { Button } from "@/components/ui/button"
import { Shield, User, BarChart } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { clearUserFromStorage } from "@/lib/utils"

export function AdminHeader() {
  const router = useRouter()

  const handleLogout = () => {
    // Clear user data from both localStorage and sessionStorage
    clearUserFromStorage()
    router.push('/login')
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-purple-500" />
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">XDialNetworks Admin</h1>
            <span className="bg-purple-500 text-white px-2 py-1 rounded text-sm font-medium">Admin Panel</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="outline">
              <BarChart className="h-4 w-4 mr-2" />
              Reports
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <User className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  )
}