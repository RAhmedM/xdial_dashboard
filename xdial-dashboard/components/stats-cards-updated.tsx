"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Phone, PhoneForwarded, PhoneOff } from "lucide-react"
import { getUserFromStorage, getUserTypeFromStorage } from "@/lib/utils"

interface CallStats {
  totalCalls: number
  callsForwarded: number
  callsDropped: number
  categories: Array<{ name: string; count: number }>
}

interface User {
  id?: number
  username?: string
  role?: string
  name?: string
  extension?: string
}

export function StatsCardsUpdated() {
  const [stats, setStats] = useState<CallStats>({
    totalCalls: 0,
    callsForwarded: 0,
    callsDropped: 0,
    categories: []
  })
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [userType, setUserType] = useState<string | null>(null)

  // Get user info on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Use utility functions that check both localStorage and sessionStorage
      const storedUser = getUserFromStorage()
      const storedUserType = getUserTypeFromStorage()
      
      if (storedUser) {
        setUser(storedUser)
      }
      if (storedUserType) {
        setUserType(storedUserType)
      }
    }
  }, [])

  useEffect(() => {
    const fetchStats = async () => {
      if (!userType) return
      
      try {
        const params = new URLSearchParams()
        
        // Add client_id filter for non-admin users
        if (userType === 'client' && user?.id) {
          params.append('client_id', user.id.toString())
        }

        const response = await fetch(`/api/calls/stats?${params}`)
        if (!response.ok) throw new Error('Failed to fetch stats')
        
        const data = await response.json()
        setStats(data)
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [userType, user])

  const formatNumber = (num: number) => {
    return num.toLocaleString()
  }

  const getPercentage = (value: number, total: number) => {
    return total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
  }

  const statsCards = [
    {
      title: "Total Calls",
      value: formatNumber(stats.totalCalls),
      subtitle: userType === 'client' ? "Your total interactions" : "All recorded interactions",
      icon: Phone,
      color: "text-blue-500",
      bgColor: "bg-blue-50",
    },
    {
      title: "Calls Forwarded",
      value: formatNumber(stats.callsForwarded),
      subtitle: `${getPercentage(stats.callsForwarded, stats.totalCalls)}% of total calls`,
      icon: PhoneForwarded,
      color: "text-green-500",
      bgColor: "bg-green-50",
    },
    {
      title: "Calls Dropped",
      value: formatNumber(stats.callsDropped),
      subtitle: `${getPercentage(stats.callsDropped, stats.totalCalls)}% of total calls`,
      icon: PhoneOff,
      color: "text-red-500",
      bgColor: "bg-red-50",
    },
  ]

  if (loading || !userType) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="relative overflow-hidden">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {userType === 'client' && user?.name && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900">Dashboard for {user.name}</h3>
          <p className="text-xs text-blue-700 mt-1">Extension: {user.extension}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statsCards.map((stat) => (
          <Card key={stat.title} className="relative overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mb-2">{stat.value}</p>
                  <p className="text-sm text-gray-500">{stat.subtitle}</p>
                </div>
                <div className={`p-3 rounded-full ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}