export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              F
            </div>
            <span className="text-xl font-semibold tracking-tight">
              FlowCRM
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            AI-first CRM and business operating system
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
