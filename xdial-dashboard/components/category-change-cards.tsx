// components/category-change-cards.tsx
"use client"
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

interface CategoryChanges {
  [key: string]: string | number
}

interface CategoryChangeCardsProps {
  fiveMinChanges: CategoryChanges
  tenMinChanges: CategoryChanges
}

const callOutcomes = [
  { id: "qualified", title: "Qualified", icon: Star, iconColor: "text-green-500" },
  { id: "neutral", title: "Neutral", icon: Circle, iconColor: "text-gray-400" },
  { id: "unknown", title: "Unknown", icon: HelpCircle, iconColor: "text-gray-500" },
  { id: "inaudible", title: "Inaudible", icon: VolumeX, iconColor: "text-orange-500" },
  { id: "answering-machine", title: "Answering Machine", icon: Phone, iconColor: "text-blue-500" },
  { id: "not-interested", title: "Not Interested", icon: X, iconColor: "text-red-500" },
  { id: "do-not-call", title: "DNC", icon: Ban, iconColor: "text-pink-500" },
  { id: "do-not-qualify", title: "DNQ", icon: AlertTriangle, iconColor: "text-yellow-500" },
  { id: "honeypot", title: "Honeypot", icon: Shield, iconColor: "text-purple-500" },
  { id: "user-silent", title: "User Silent", icon: MicOff, iconColor: "text-slate-500" },
  { id: "na", title: "NA", icon: Minus, iconColor: "text-gray-600" },
  { id: "user-hungup", title: "User Hung Up", icon: PhoneOff, iconColor: "text-red-600" },
]

export function CategoryChangeCards({ fiveMinChanges, tenMinChanges }: CategoryChangeCardsProps) {
  const renderCompactChanges = (changes: CategoryChanges) => {
  const changedOutcomes = callOutcomes.filter(outcome => {
    const changeValue = changes[outcome.id]
    if (changeValue === undefined || changeValue === null) return false

    const numValue =
      typeof changeValue === "string"
        ? parseFloat(changeValue.replace("%", "").replace("+", ""))
        : changeValue

    return numValue !== 0
  })

  if (changedOutcomes.length === 0) {
    return <span className="text-xs text-gray-500">No changes</span>
  }

  const leftSideIds = ["qualified", "unknown", "neutral", "inaudible"]
  const leftSide = changedOutcomes.filter(o => leftSideIds.includes(o.id))
  const rightSide = changedOutcomes.filter(o => !leftSideIds.includes(o.id))

  // Helper: compute average for a set of outcomes
  const calcAverage = (list: typeof changedOutcomes) => {
    if (list.length === 0) return 0
    const total = list.reduce((sum, outcome) => {
      const val = changes[outcome.id]
      const numeric =
        typeof val === "string"
          ? parseFloat(val.replace("%", "").replace("+", ""))
          : val || 0
      return sum + numeric
    }, 0)
    return total / list.length
  }

  const leftAvg = calcAverage(leftSide)
  const rightAvg = calcAverage(rightSide)

  const renderChangeItem = (outcome: typeof changedOutcomes[0], isPositive: boolean) => {
    const changeValue = changes[outcome.id]
    const displayValue =
      typeof changeValue === "string"
        ? changeValue
        : isPositive
        ? `+${changeValue}`
        : `${changeValue}`
    const Icon = outcome.icon

    return (
      <div
        key={outcome.id}
        className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium shadow-sm ${
          isPositive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
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
    <div className="grid grid-cols-2 gap-4">
      {/* Left column (Positive / Primary Outcomes) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-2">
          <span>Engaged Outcomes</span>
          <span className="text-gray-500">
            {leftAvg > 0 ? "+" : ""}
            {leftAvg.toFixed(1)}%
          </span>
        </div>
        {leftSide.length > 0 ? (
          leftSide.map(outcome => {
            const value = changes[outcome.id]
            const numeric =
              typeof value === "string"
                ? parseFloat(value.replace("%", "").replace("+", ""))
                : value
            return renderChangeItem(outcome, numeric > 0)
          })
        ) : (
          <span className="text-xs text-gray-400 italic">No data</span>
        )}
      </div>

      {/* Right column (Negative / Other Outcomes) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-2">
          <span>Drop-Off Outcomes</span>
          <span className="text-gray-500">
            {rightAvg > 0 ? "+" : ""}
            {rightAvg.toFixed(1)}%
          </span>
        </div>
        {rightSide.length > 0 ? (
          rightSide.map(outcome => {
            const value = changes[outcome.id]
            const numeric =
              typeof value === "string"
                ? parseFloat(value.replace("%", "").replace("+", ""))
                : value
            return renderChangeItem(outcome, numeric > 0)
          })
        ) : (
          <span className="text-xs text-gray-400 italic">No data</span>
        )}
      </div>
    </div>
  )
}


  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      {/* 5 Minute Changes */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-blue-500" />
            Last 5 Minutes
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">{renderCompactChanges(fiveMinChanges)}</CardContent>
      </Card>

      {/* 10 Minute Changes */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-purple-500" />
            Last 10 Minutes
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">{renderCompactChanges(tenMinChanges)}</CardContent>
      </Card>
    </div>
  )
}
