'use client'

import { Calendar, Home, Inbox, Search, Settings, Plus, History, FileText, Briefcase, BarChart3, ShoppingCart } from "lucide-react"
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
 
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { SkeletonDemo } from "@/components/ui/skeleton2"
 
// Menu items.
const items = [
  {
    title: "DashBoard",
    url: "/dashboard",
    icon: Home,
  },
  {
    title: "MarketPlace",
    url: "/marketplace",
    icon: ShoppingCart,
  },
  {
    title: "Portfolio",
    url: "/portfolio",
    icon: Briefcase,
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: BarChart3,
  },
]
 
// Menu items.
const prets = [
  {
    title: "Creer demande",
    url: "/creer-demande",
    icon: Plus,
  },
  {
    title: "Mes Prêts actifs",
    url: "/mes-prets-actifs",
    icon: FileText,
  },
  {
    title: "Historique",
    url: "/historique",
    icon: History,
  },
]

// Menu items.
const gouvernances = [
  {
    title: "Propositions",
    url: "/propositions",
    icon: FileText,
  },
  {
    title: "Mes Tokens",
    url: "/mes-tokens",
    icon: Settings,
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="offcanvas | icon | none">
      <SidebarHeader className="border-b-1 border-white-500">
        <SkeletonDemo className="h-[20px] w-[100px] rounded-full"/>
      </SidebarHeader>
      <SidebarContent className="">
        <SidebarGroup>
          <SidebarGroupLabel>APPLICATION</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="">
              {items.map((item) => (
                <SidebarMenuItem key={item.title} className="mt-2">
                  <SidebarMenuButton 
                    asChild 
                    className={cn(
                      "transition-colors",
                      pathname === item.url && "bg-cyan-600 text-white hover:bg-cyan-700"
                    )}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span className="ml-5">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>PRÊTS</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {prets.map((pret) => (
                <SidebarMenuItem key={pret.title} className="mt-2">
                  <SidebarMenuButton 
                    asChild
                    className={cn(
                      "transition-colors",
                      pathname === pret.url && "bg-cyan-600 text-white hover:bg-cyan-700"
                    )}
                  >
                    <Link href={pret.url}>
                      <pret.icon />
                      <span className="ml-5">{pret.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>GOUVERNANCE</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {gouvernances.map((gouvernance) => (
                <SidebarMenuItem key={gouvernance.title} className="pt-2">
                  <SidebarMenuButton 
                    asChild
                    className={cn(
                      "transition-colors",
                      pathname === gouvernance.url && "bg-cyan-600 text-white hover:bg-cyan-700"
                    )}
                  >
                    <Link href={gouvernance.url}>
                      <gouvernance.icon />
                      <span className="ml-5">{gouvernance.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton>
                    <span>Account</span>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  className="w-[--radix-popper-anchor-width]"
                >
                  <DropdownMenuItem>
                    <span>Account</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <span>Billing</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
    </Sidebar>
  )
}