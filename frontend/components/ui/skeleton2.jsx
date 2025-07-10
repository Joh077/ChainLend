import Image from "next/image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function SkeletonDemo() {
  return (
    <div className="flex items-center space-x-8 m-5">
      <div className="h-8 w-12 rounded-full">
      <Avatar>
        <AvatarImage src="/Logo_CL.png" />
        <AvatarFallback>CL</AvatarFallback>
      </Avatar>
      </div>      
      <div className="space-y-2">
        <div className="h-4 w-[200px] flex items-center">ChainLend</div>
      </div>
    </div>
  )
}