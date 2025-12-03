// components/category-change-cards.tsx
"use client"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Phone,
  Star,
  X,
  Ban,
  AlertTriangle,
  HelpCircle,
  Shield,
  MicOff,
  VolumeX,
  Circle,
  Minus,
  PhoneOff,
  Clock,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface CategoryChanges {
  [key: string]: string | number
}

interface CategoryChangeCardsProps {
  fiveMinChanges: CategoryChanges
  tenMinChanges: CategoryChanges
  thirtyMinChanges: CategoryChanges
  oneHourChanges: CategoryChanges
  oneDayChanges: CategoryChanges
}

const callOutcomes = [
  { id: "interested", title: "Qualified", icon: Star, iconColor: "text-green-500" },
  { id: "neutral", title: "Neutral", icon: Circle, iconColor: "text-gray-400" },
  { id: "unknown", title: "Unclear Response", icon: HelpCircle, iconColor: "text-gray-500" },
  { id: "INAUDIBLE", title: "Inaudible", icon: VolumeX, iconColor: "text-orange-500" },
  { id: "answering-machine", title: "Answering Machine", icon: Phone, iconColor: "text-blue-500" },
  { id: "NA", title: "DAIR", icon: Minus, iconColor: "text-gray-600" },
  { id: "Honeypot", title: "Honeypot", icon: Shield, iconColor: "text-purple-500" },
  { id: "do-not-call", title: "DNC", icon: Ban, iconColor: "text-pink-500" },
  { id: "do-not-qualify", title: "DNQ", icon: AlertTriangle, iconColor: "text-yellow-500" },
  { id: "not-interested", title: "Not Interested", icon: X, iconColor: "text-red-500" },
  { id: "User_Silent", title: "User Silent", icon: MicOff, iconColor: "text-slate-500" },
  { id: "USER-HUNGUP", title: "User Hang Up", icon: PhoneOff, iconColor: "text-red-600" },
]

type IntervalType = "5" | "10" | "30" | "60" | "1440"

export function CategoryChangeCards({ 
  fiveMinChanges, 
  tenMinChanges, 
  thirtyMinChanges, 
  oneHourChanges, 
  oneDayChanges 
}: CategoryChangeCardsProps) {
  const [selectedInterval, setSelectedInterval] = useState<IntervalType>("5")

  const renderCompactChanges = (changes: CategoryChanges) => {
    // Show ALL outcomes, regardless of whether they have changes
    const allOutcomes = callOutcomes

    const leftSideIds = ["interested", "neutral", "unknown", "INAUDIBLE"]
    const leftSide = allOutcomes.filter(o => leftSideIds.includes(o.id))
    const rightSide = allOutcomes.filter(o => !leftSideIds.includes(o.id))

    const calcWeightedAverage = (list: typeof allOutcomes) => {
      if (list.length === 0) return 0
      let total = 0
      let weightSum = 0
      list.forEach(o => {
        const val = changes[o.id]
        const numeric =
          typeof val === "string"
            ? parseFloat(val.replace("%", "").replace("↑", "").replace("↓", "").replace("+", ""))
            : val || 0

        const weight = o.id === "interested" ? 3 : 1
        total += numeric * weight
        weightSum += weight
      })
      return total / weightSum
    }

    const calcAverage = (list: typeof allOutcomes) => {
      if (list.length === 0) return 0
      let total = 0
      list.forEach(o => {
        const val = changes[o.id]
        const numeric =
          typeof val === "string"
            ? parseFloat(val.replace("%", "").replace("↑", "").replace("↓", "").replace("+", ""))
            : val || 0
        total += numeric
      })
      return total / list.length
    }

    const leftAvg = calcWeightedAverage(leftSide)
    const rightAvg = calcAverage(rightSide)

    const renderChangeItem = (outcome: typeof allOutcomes[0]) => {
      const val = changes[outcome.id]
      const numeric =
        typeof val === "string"
          ? parseFloat(val.replace("%", "").replace("↑", "").replace("↓", "").replace("+", ""))
          : val || 0

      const displayValue =
        numeric > 0
          ? `↑${numeric.toFixed(1)}%`
          : numeric < 0
          ? `↓${Math.abs(numeric).toFixed(1)}%`
          : `0%`

      const Icon = outcome.icon

      return (
        <div
          key={outcome.id}
          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium shadow-sm bg-gray-50 text-gray-700`}
        >
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${outcome.iconColor}`} />
            <span>{outcome.title}</span>
          </div>
          <span className="font-bold">{displayValue}</span>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Left column */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-2">
              <span>Engaged Outcomes</span>
              <span className="text-gray-500">
                {leftAvg > 0 ? `↑${leftAvg.toFixed(1)}%` : leftAvg < 0 ? `↓${Math.abs(leftAvg).toFixed(1)}%` : "0%"}
              </span>
            </div>
            {leftSide.map(o => renderChangeItem(o))}
          </div>

          {/* Right column */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-2">
              <span>Drop-Off Outcomes</span>
              <span className="text-gray-500">
                {rightAvg > 0 ? `↑${rightAvg.toFixed(1)}%` : rightAvg < 0 ? `↓${Math.abs(rightAvg).toFixed(1)}%` : "0%"}
              </span>
            </div>
            {rightSide.map(o => renderChangeItem(o))}
          </div>
        </div>
      </div>
    )
  }

  const getCurrentChanges = () => {
    switch (selectedInterval) {
      case "5": return fiveMinChanges
      case "10": return tenMinChanges
      case "30": return thirtyMinChanges
      case "60": return oneHourChanges
      case "1440": return oneDayChanges
      default: return fiveMinChanges
    }
  }

  const currentChanges = getCurrentChanges()

  const calculateNetPerformance = (changes: CategoryChanges) => {
    const leftSideIds = ["interested", "neutral", "unknown", "INAUDIBLE"]
    const leftSide = callOutcomes.filter(o => leftSideIds.includes(o.id))
    const rightSide = callOutcomes.filter(o => !leftSideIds.includes(o.id))

    const calcWeightedAverage = (list: typeof callOutcomes) => {
      if (list.length === 0) return 0
      let total = 0
      let weightSum = 0
      list.forEach(o => {
        const val = changes[o.id]
        const numeric = typeof val === "string" 
          ? parseFloat(val.replace("%", "").replace("↑", "").replace("↓", "").replace("+", "")) 
          : val || 0
        const weight = o.id === "interested" ? 3 : 1
        total += numeric * weight
        weightSum += weight
      })
      return total / weightSum
    }

    const calcAverage = (list: typeof callOutcomes) => {
      if (list.length === 0) return 0
      const total = list.reduce((sum, o) => {
        const val = changes[o.id]
        const numeric = typeof val === "string" 
          ? parseFloat(val.replace("%", "").replace("↑", "").replace("↓", "").replace("+", "")) 
          : val || 0
        return sum + numeric
      }, 0)
      return total / list.length
    }

    const engagedAvg = calcWeightedAverage(leftSide)
    const dropoffAvg = calcAverage(rightSide)
    
    // Use absolute values in denominator to handle negatives properly
    const denominator = Math.abs(engagedAvg) + Math.abs(dropoffAvg)
    
    // If no change at all, return 50 (neutral)
    if (denominator === 0) return 50
    
    // Calculate ratio and normalize to 0-100% scale
    // Engaged positive = good (> 50%), Dropoff positive = bad (< 50%)
    const ratio = engagedAvg / denominator
    return ratio * 50 + 50
  }

  const netPerformance = calculateNetPerformance(currentChanges)

  return (
    <div className="grid grid-cols-1 gap-4 mb-6">
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Select value={selectedInterval} onValueChange={(value: IntervalType) => setSelectedInterval(value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span>Last 5 Minutes</span>
                  </div>
                </SelectItem>
                <SelectItem value="10">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-purple-500" />
                    <span>Last 10 Minutes</span>
                  </div>
                </SelectItem>
                <SelectItem value="30">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-indigo-500" />
                    <span>Last 30 Minutes</span>
                  </div>
                </SelectItem>
                <SelectItem value="60">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-teal-500" />
                    <span>Last 1 Hour</span>
                  </div>
                </SelectItem>
                <SelectItem value="1440">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-500" />
                    <span>Last 24 Hours</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <div
              className={`px-4 py-2 rounded-lg font-bold text-lg ${
                netPerformance > 50
                  ? "bg-green-100 text-green-800"
                  : netPerformance < 50
                  ? "bg-red-100 text-red-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {netPerformance.toFixed(1)}%
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {renderCompactChanges(currentChanges)}
        </CardContent>
      </Card>
    </div>
  )
}