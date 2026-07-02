"use client"

import { createContext, useContext } from "react"
import type { OrgRole } from "@/types/database"

interface RoleContextValue {
  orgRole: OrgRole
  userId: string
  isAdmin: boolean // owner or admin
}

const RoleContext = createContext<RoleContextValue>({
  orgRole: "member",
  userId: "",
  isAdmin: false,
})

export function RoleProvider({
  orgRole,
  userId,
  children,
}: {
  orgRole: OrgRole
  userId: string
  children: React.ReactNode
}) {
  const isAdmin = orgRole === "owner" || orgRole === "admin"
  return (
    <RoleContext value={{ orgRole, userId, isAdmin }}>
      {children}
    </RoleContext>
  )
}

export function useRole() {
  return useContext(RoleContext)
}
