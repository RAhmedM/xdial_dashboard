import { Card, CardContent } from "@/components/ui/card"
import { Phone, PhoneForwarded, PhoneOff } from "lucide-react"

const stats = [
  {
    title: "Total Calls",
    value: "1,309",
    subtitle: "Initial stage interactions",
    icon: Phone,
    color: "text-blue-500",
    bgColor: "bg-blue-50",
  },
  {
    title: "Calls Forwarded",
    value: "743",
    subtitle: "56.8% of initial calls",
    icon: PhoneForwarded,
    color: "text-green-500",
    bgColor: "bg-green-50",
  },
  {
    title: "Calls Dropped",
    value: "566",
    subtitle: "43.2% of initial calls",
    icon: PhoneOff,
    color: "text-red-500",
    bgColor: "bg-red-50",
  },
]

export function StatsCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {stats.map((stat) => (
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
  )
}
