import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Volume2, Star, HelpCircle, Phone, X, Ban, AlertTriangle } from "lucide-react"

const categories = [
  {
    name: "User Silent_hello",
    count: 458,
    icon: Volume2,
    color: "bg-blue-500",
    iconColor: "text-blue-500",
  },
  {
    name: "INTERESTED hello",
    count: 393,
    icon: Star,
    color: "bg-green-500",
    iconColor: "text-green-500",
  },
  {
    name: "UNKNOWN hello",
    count: 350,
    icon: HelpCircle,
    color: "bg-gray-500",
    iconColor: "text-gray-500",
  },
  {
    name: "ANSWER MACHINE_hello",
    count: 89,
    icon: Phone,
    color: "bg-blue-400",
    iconColor: "text-blue-400",
  },
  {
    name: "Not Responding_hello",
    count: 19,
    icon: X,
    color: "bg-red-500",
    iconColor: "text-red-500",
  },
]

const callOutcomes = [
  {
    id: "answering-machine",
    title: "Answering Machine",
    icon: Phone,
    iconColor: "text-blue-500",
    selected: true,
  },
  {
    id: "interested",
    title: "Interested",
    icon: Star,
    iconColor: "text-green-500",
  },
  {
    id: "not-interested",
    title: "Not Interested",
    icon: X,
    iconColor: "text-red-500",
  },
  {
    id: "do-not-call",
    title: "Do Not Call",
    icon: Ban,
    iconColor: "text-pink-500",
  },
  {
    id: "do-not-qualify",
    title: "Do Not Qualify",
    icon: AlertTriangle,
    iconColor: "text-yellow-500",
  },
  {
    id: "unknown",
    title: "Unknown",
    icon: HelpCircle,
    iconColor: "text-gray-500",
  },
]

export function CallCategories() {
  return (
    <div className="space-y-4">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Call Categories</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {categories.map((category) => (
            <div key={category.name} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-full bg-gray-50">
                  <category.icon className={`h-4 w-4 ${category.iconColor}`} />
                </div>
                <span className="text-sm font-medium text-gray-700">{category.name}</span>
              </div>
              <Badge className={`${category.color} text-white`}>{category.count}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-700">Call Outcomes</CardTitle>
            <span className="text-xs text-gray-500">1 selected</span>
          </div>
        </CardHeader>

        <CardContent className="space-y-2">
          {callOutcomes.map((outcome) => (
            <div
              key={outcome.id}
              className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-all hover:bg-gray-50 ${
                outcome.selected ? "bg-blue-50 border border-blue-200" : ""
              }`}
            >
              <div className="p-1 rounded-full bg-white">
                <outcome.icon className={`h-3 w-3 ${outcome.iconColor}`} />
              </div>
              <span className="text-xs font-medium text-gray-700">{outcome.title}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
