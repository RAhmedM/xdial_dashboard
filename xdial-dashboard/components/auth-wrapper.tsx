"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { getUserFromStorage, getUserTypeFromStorage } from "@/lib/utils"

interface AuthWrapperProps {
  children: React.ReactNode
  requiredRole?: 'admin' | 'client' | 'any'
}

export function AuthWrapper({ children, requiredRole = 'any' }: AuthWrapperProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [userType, setUserType] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Skip auth check for login page
    if (pathname === '/login') {
      setIsAuthenticated(true)
      return
    }

    // Use utility functions that check both localStorage and sessionStorage
    const user = getUserFromStorage()
    const storedUserType = getUserTypeFromStorage()

    if (!user || !storedUserType) {
      router.push('/login')
      return
    }

    setUserType(storedUserType)

    // Check role permissions
    if (requiredRole !== 'any') {
      if (requiredRole === 'admin' && storedUserType !== 'admin') {
        router.push('/dashboard') // Redirect non-admin to dashboard
        return
      }
      if (requiredRole === 'client' && storedUserType !== 'client') {
        router.push('/admin') // Redirect non-client to admin
        return
      }
    }

    setIsAuthenticated(true)
  }, [pathname, router, requiredRole])

  // Show loading while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect to login
  }

  return <>{children}</>
}


