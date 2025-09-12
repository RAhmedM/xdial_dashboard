// components/dashboard-header.tsx
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Phone, User, Building2, FileAudio, BarChart } from "lucide-react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"

interface UserData {
  id?: number
  username?: string
  role?: string
  name?: string
  extension?: string
}

export function DashboardHeader() {
  const [user, setUser] = useState<UserData | null>(null)
  const [userType, setUserType] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUser = sessionStorage.getItem('user')
      const storedUserType = sessionStorage.getItem('userType')
      
      if (storedUser) {
        setUser(JSON.parse(storedUser))
      }
      if (storedUserType) {
        setUserType(storedUserType)
      }
    }
  }, [])

  const handleLogout = () => {
    sessionStorage.clear()
    router.push('/login')
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Phone className="h-6 w-6 text-blue-500" />
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">XDialNetworks</h1>
              {user?.name && (
                <p className="text-sm text-gray-500">
                  Welcome back, {user.name}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {user?.extension && (
                <span className="bg-blue-500 text-white px-2 py-1 rounded text-sm font-medium">
                  Ext: {user.extension}
                </span>
              )}
              {userType === 'client' && (
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-medium flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  Client View
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button 
              variant={pathname === '/dashboard' ? 'default' : 'outline'}
              className={pathname === '/dashboard' ? 'bg-blue-500 hover:bg-blue-600 text-white' : ''}
            >
              <BarChart className="h-4 w-4 mr-2" />
              Reports
            </Button>
          </Link>
          
          <Link href="/recordings">
            <Button 
              variant={pathname === '/recordings' ? 'default' : 'outline'}
              className={pathname === '/recordings' ? 'bg-blue-500 hover:bg-blue-600 text-white' : ''}
            >
              <FileAudio className="h-4 w-4 mr-2" />
              Recordings
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
