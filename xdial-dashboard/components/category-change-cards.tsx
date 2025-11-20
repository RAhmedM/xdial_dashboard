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
}

const callOutcomes = [
  { id: "interested", title: "Interested", icon: Star, iconColor: "text-green-500" },
  { id: "neutral", title: "Neutral", icon: Circle, iconColor: "text-gray-400" },
  { id: "unknown", title: "Unknown", icon: HelpCircle, iconColor: "text-gray-500" },
  { id: "INAUDIBLE", title: "Inaudible", icon: VolumeX, iconColor: "text-orange-500" },
  { id: "do-not-call", title: "DNC", icon: Ban, iconColor: "text-pink-500" },
  { id: "do-not-qualify", title: "DNQ", icon: AlertTriangle, iconColor: "text-yellow-500" },
  { id: "answering-machine", title: "Answering Machine", icon: Phone, iconColor: "text-blue-500" },
  { id: "not-interested", title: "Not Interested", icon: X, iconColor: "text-red-500" },
  { id: "Honeypot", title: "Honeypot", icon: Shield, iconColor: "text-purple-500" },
  { id: "User_Silent", title: "User Silent", icon: MicOff, iconColor: "text-slate-500" },
  { id: "NA", title: "NA", icon: Minus, iconColor: "text-gray-600" },
  { id: "USER-HUNGUP", title: "User Hung Up", icon: PhoneOff, iconColor: "text-red-600" },
]

export function CategoryChangeCards({ fiveMinChanges, tenMinChanges }: CategoryChangeCardsProps) {
  const [selectedInterval, setSelectedInterval] = useState<"5" | "10">("5")

  const renderCompactChanges = (changes: CategoryChanges) => {
    const changedOutcomes = callOutcomes.filter(outcome => {
      const c = changes[outcome.id]
      return c !== undefined && c !== null
    })

    if (changedOutcomes.length === 0) {
      return <span className="text-xs text-gray-500">No changes</span>
    }

    const leftSideIds = ["interested", "unknown", "neutral", "INAUDIBLE"]
    const leftSide = changedOutcomes.filter(o => leftSideIds.includes(o.id))
    const rightSide = changedOutcomes.filter(o => !leftSideIds.includes(o.id))

    const calcWeightedAverage = (list: typeof changedOutcomes) => {
      if (list.length === 0) return 0
      let total = 0
      let weightSum = 0
      list.forEach(o => {
        const val = changes[o.id]
        const numeric =
          typeof val === "string"
            ? parseFloat(val.replace("%", "").replace("↑", "").replace("↓", "-"))
            : val || 0

        const weight = o.id === "interested" ? 3 : 1
        total += numeric * weight
        weightSum += weight
      })
      return total / weightSum
    }

    const calcAverage = (list: typeof changedOutcomes) => {
      if (list.length === 0) return 0
      let total = 0
      list.forEach(o => {
        const val = changes[o.id]
        const numeric =
          typeof val === "string"
            ? parseFloat(val.replace("%", "").replace("↑", "").replace("↓", "-"))
            : val || 0
        total += numeric
      })
      return total / list.length
    }

    const leftAvg = calcWeightedAverage(leftSide)
    const rightAvg = calcAverage(rightSide)

    const renderChangeItem = (outcome: typeof changedOutcomes[0], isPositive: boolean) => {
      const val = changes[outcome.id]
      const numeric =
        typeof val === "string"
          ? parseFloat(val.replace("%", "").replace("↑", "").replace("↓", "-"))
          : val

      const displayValue =
        numeric > 0
          ? `↑${numeric}%`
          : numeric < 0
          ? `↓${Math.abs(numeric)}%`
          : `0%`

      const Icon = outcome.icon

      return (
        <div
          key={outcome.id}
          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium shadow-sm ${
            numeric > 0 ? "bg-green-50 text-green-700" : numeric < 0 ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-700"
          }`}
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
            {leftSide.length > 0
              ? leftSide.map(o => {
                  const val = changes[o.id]
                  const numeric =
                    typeof val === "string"
                      ? parseFloat(val.replace("%", "").replace("↑", "").replace("↓", "-"))
                      : val
                  return renderChangeItem(o, numeric > 0)
                })
              : <span className="text-xs text-gray-400 italic">No data</span>}
          </div>

          {/* Right column */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-2">
              <span>Drop-Off Outcomes</span>
              <span className="text-gray-500">
                {rightAvg > 0 ? `↑${rightAvg.toFixed(1)}%` : rightAvg < 0 ? `↓${Math.abs(rightAvg).toFixed(1)}%` : "0%"}
              </span>
            </div>
            {rightSide.length > 0
              ? rightSide.map(o => {
                  const val = changes[o.id]
                  const numeric =
                    typeof val === "string"
                      ? parseFloat(val.replace("%", "").replace("↑", "").replace("↓", "-"))
                      : val
                  return renderChangeItem(o, numeric > 0)
                })
              : <span className="text-xs text-gray-400 italic">No data</span>}
          </div>
        </div>
      </div>
    )
  }

  const currentChanges = selectedInterval === "5" ? fiveMinChanges : tenMinChanges

  const calculateNetPerformance = (changes: CategoryChanges) => {
    const changedOutcomes = callOutcomes.filter(o => changes[o.id] !== undefined && changes[o.id] !== null)

    const leftSideIds = ["interested", "unknown", "neutral", "INAUDIBLE"]
    const leftSide = changedOutcomes.filter(o => leftSideIds.includes(o.id))
    const rightSide = changedOutcomes.filter(o => !leftSideIds.includes(o.id))

    const calcWeightedAverage = (list: typeof changedOutcomes) => {
      if (list.length === 0) return 0
      let total = 0
      let weightSum = 0
      list.forEach(o => {
        const val = changes[o.id]
        const numeric = typeof val === "string" ? parseFloat(val.replace("%", "").replace("↑", "").replace("↓", "-")) : val
        const weight = o.id === "interested" ? 3 : 1
        total += numeric * weight
        weightSum += weight
      })
      return total / weightSum
    }

    const calcAverage = (list: typeof changedOutcomes) => {
      if (list.length === 0) return 0
      const total = list.reduce((sum, o) => {
        const val = changes[o.id]
        const numeric = typeof val === "string" ? parseFloat(val.replace("%", "").replace("↑", "").replace("↓", "-")) : val
        return sum + numeric
      }, 0)
      return total / list.length
    }

    const leftAvg = calcWeightedAverage(leftSide)
    const rightAvg = calcAverage(rightSide)
    return leftAvg - rightAvg
  }

  const netPerformance = calculateNetPerformance(currentChanges)

  return (
    <div className="grid grid-cols-1 gap-4 mb-6">
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Select value={selectedInterval} onValueChange={(value: "5" | "10") => setSelectedInterval(value)}>
              <SelectTrigger className="w-[180px]">
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
              </SelectContent>
            </Select>

            <div
              className={`px-4 py-2 rounded-lg font-bold text-lg ${
                netPerformance > 0
                  ? "bg-green-100 text-green-800"
                  : netPerformance < 0
                  ? "bg-red-100 text-red-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {netPerformance > 0
                ? `↑${netPerformance.toFixed(1)}%`
                : netPerformance < 0
                ? `↓${Math.abs(netPerformance).toFixed(1)}%`
                : "0%"}
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