import RainbowKitAndWagmiProvider from "./RainbowKitAndWagmiProvider"
import "./globals.css"
import { Inter as FontSans } from "next/font/google";
import Layout from "@/components/shared/Layout";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/shared/app-sidebar"
import { cookies } from "next/headers"
import { cn } from "@/lib/utils"
import { Toaster } from 'sonner';

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
})

export const metadata = {
  title: "ChainLend - Lending Protocol",
  description: "Decentralized P2P lending with ETH collateral",
};

export default async function RootLayout ({ children }) {

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  return (
    <html lang="eng" suppressHydrationWarning>
      <head />
      <body 
        className={cn("min-h-screen bg-background font-sans antialiased dark w-full",
        fontSans.variable)}
        suppressHydrationWarning={true}
      >
        <RainbowKitAndWagmiProvider>
          <Layout>
            <SidebarProvider defaultOpen={defaultOpen}>
              <AppSidebar />
              <main>
                <SidebarTrigger />
                {children}
              </main>
            </SidebarProvider>
          </Layout>
        </RainbowKitAndWagmiProvider>
        
        {/* Toaster pour les notifications */}
        <Toaster 
          theme="dark" 
          position="bottom-right"
          richColors
          toastOptions={{
            style: {
              background: '#18181b',
              border: '1px solid #3f3f46',
              color: '#f4f4f5',
            },
          }}
        />
      </body>
    </html>
  )
}