// components/ui/simple-slider.tsx
"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SimpleSliderProps {
  value: number[]
  onValueChange?: (value: number[]) => void
  max?: number
  step?: number
  className?: string
}

export function SimpleSlider({
  value,
  onValueChange,
  max = 100,
  step = 1,
  className
}: SimpleSliderProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value)
    onValueChange?.([newValue])
  }

  return (
    <div className={cn("relative w-full", className)}>
      <input
        type="range"
        min={0}
        max={max}
        step={step}
        value={value[0] || 0}
        onChange={handleChange}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
        style={{
          background: `linear-gradient(to right, rgb(59 130 246) ${(value[0] / max) * 100}%, rgb(229 231 235) ${(value[0] / max) * 100}%)`
        }}
      />
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          background: rgb(59 130 246);
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          background: rgb(59 130 246);
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .slider:hover::-webkit-slider-thumb {
          background: rgb(37 99 235);
        }
        
        .slider:hover::-moz-range-thumb {
          background: rgb(37 99 235);
        }
      `}</style>
    </div>
  )
}
