"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, RotateCcw, Filter, Phone, Star, X, Ban, AlertTriangle, HelpCircle } from "lucide-react"
import { getUserFromStorage, getUserTypeFromStorage } from "@/lib/utils"

interface User {
  id?: number
  username?: string
  role?: string
  name?: string
  extension?: string
}

const callOutcomes = [
  {
    id: "answering-machine",
    title: "Answering Machine",
    icon: Phone,
    iconColor: "text-blue-500",
    count: 1309,
  },
  {
    id: "interested",
    title: "Interested",
    icon: Star,
    iconColor: "text-green-500",
    count: 743,
  },
  {
    id: "not-interested",
    title: "Not Interested",
    icon: X,
    iconColor: "text-red-500",
    count: 566,
  },
  {
    id: "do-not-call",
    title: "Do Not Call",
    icon: Ban,
    iconColor: "text-pink-500",
    count: 284,
  },
  {
    id: "do-not-qualify",
    title: "Do Not Qualify",
    icon: AlertTriangle,
    iconColor: "text-yellow-500",
    count: 156,
  },
  {
    id: "unknown",
    title: "Unknown",
    icon: HelpCircle,
    iconColor: "text-gray-500",
    count: 89,
  },
]

export function FilterSection() {
  const [selectedOutcomes, setSelectedOutcomes] = useState<string[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [userType, setUserType] = useState<string | null>(null)

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

  if (!userType) {
    return (
      <div className="animate-pulse">
        <div className="h-24 bg-gray-200 rounded-lg"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Filter Calls</h2>
          {userType === 'client' && user?.name && (
            <p className="text-sm text-gray-500 mt-1">
              Filtering your call records
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Date</span>
            <Input type="date" defaultValue="2025-08-18" className="w-40" />
          </div>

          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Time</span>
            <Input type="time" defaultValue="10:00" className="w-24" />
            <span className="text-sm text-gray-500">to</span>
            <Input type="time" defaultValue="18:00" className="w-24" />
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <Button variant="outline" size="sm">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button className="bg-blue-500 hover:bg-blue-600 text-white" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
          </div>
        </div>

        {selectedOutcomes.length > 0 && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <span className="text-sm font-medium text-blue-900">Active Filters:</span>
            <div className="flex flex-wrap gap-1">
              {selectedOutcomes.map((outcomeId) => {
                const outcome = callOutcomes.find((o) => o.id === outcomeId)
                return outcome ? (
                  <Badge key={outcomeId} variant="secondary" className="bg-blue-100 text-blue-800">
                    {outcome.title}
                  </Badge>
                ) : null
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function CallOutcomesFilter() {
  const [selectedOutcomes, setSelectedOutcomes] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [userType, setUserType] = useState<string | null>(null)

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

  const handleOutcomeChange = (outcomeId: string, checked: boolean) => {
    if (checked) {
      setSelectedOutcomes([...selectedOutcomes, outcomeId])
    } else {
      setSelectedOutcomes(selectedOutcomes.filter((id) => id !== outcomeId))
      setSelectAll(false)
    }
  }

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked)
    if (checked) {
      setSelectedOutcomes(callOutcomes.map((outcome) => outcome.id))
    } else {
      setSelectedOutcomes([])
    }
  }

  if (!userType) {
    return (
      <Card className="w-80">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-80">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-gray-700">
          Call Outcomes
          {userType === 'client' && (
            <span className="block text-xs font-normal text-gray-500 mt-1">
              Filter your calls
            </span>
          )}
        </CardTitle>
        <div className="flex items-center space-x-2">
          <Checkbox id="select-all" checked={selectAll} onCheckedChange={handleSelectAll} />
          <label htmlFor="select-all" className="text-xs text-gray-600 cursor-pointer">
            Select All
          </label>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {callOutcomes.map((outcome) => (
          <div key={outcome.id} className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={outcome.id}
                checked={selectedOutcomes.includes(outcome.id)}
                onCheckedChange={(checked) => handleOutcomeChange(outcome.id, checked as boolean)}
              />
              <div className="flex items-center gap-2">
                <outcome.icon className={`h-3 w-3 ${outcome.iconColor}`} />
                <label htmlFor={outcome.id} className="text-xs font-medium text-gray-700 cursor-pointer">
                  {outcome.title}
                </label>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">
              {outcome.count}
            </Badge>
          </div>
        ))}

        <div className="pt-3 border-t">
          <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white" size="sm">
            Apply Filters
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}