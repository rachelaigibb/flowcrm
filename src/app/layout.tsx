import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { Providers } from "@/components/shared/providers"
import "./globals.css"

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "FlowCRM",
  description: "AI-first CRM and business operating system",
  // Launches full-screen (no browser chrome) when added to an iOS home screen
  appleWebApp: {
    capable: true,
    title: "FlowCRM",
    statusBarStyle: "default",
  },
}

// themeColor lives on the viewport export, not metadata, in this Next.js version
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#18181B" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-sans">
        <Providers>
          <TooltipProvider>
            {children}
          </TooltipProvider>
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
