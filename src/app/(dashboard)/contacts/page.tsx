import { attachEngagement } from "@/features/broadcasts/engagement-store"
import { matchesEngagement } from "@/features/broadcasts/engagement"
import type { BroadcastRecipient } from "@/types/database"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getSubAccountId } from "@/lib/supabase/get-sub-account"
import { getUserContext } from "@/lib/supabase/get-user-context"
import { ContactsPage } from "@/features/contacts/components/contacts-page"
import type { Contact } from "@/types/database"

export default async function ContactsRoute({searchParams}:{searchParams:Promise<{broadcast?:string;status?:string;engagement?:string;link?:string}>}) {
  const filter=await searchParams
  const {orgId}=await getUserContext()
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const subAccountId = await getSubAccountId()
  if (!subAccountId) redirect("/settings")

  const [{ data: contacts, error }, { data: subAccount }] = await Promise.all([
    supabase
      .from("contacts")
      .select("*")
      .eq("sub_account_id", subAccountId)
      .order("created_at", { ascending: false }),
    supabase
      .from("sub_accounts")
      .select("settings")
      .eq("id", subAccountId)
      .single(),
  ])

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">
          Failed to load contacts. Please try again.
        </p>
      </div>
    )
  }

  const tagColors = ((subAccount?.settings as Record<string, unknown>)?.tags as Array<{ id: string; name: string; color: string }>) ?? []

  const {data:broadcasts}=await supabase.from("broadcasts").select("id,name").eq("org_id",orgId).eq("sub_account_id",subAccountId).in("status",["sent","failed","sending"]).order("created_at",{ascending:false})
  let filteredContacts=contacts??[]
  let historyError:string|undefined
  if(filter.broadcast){
    try {
      const rows: BroadcastRecipient[]=[]
      for(let offset=0;;offset+=500){
        let query=supabase.from("broadcast_recipients").select("*").eq("org_id",orgId).eq("sub_account_id",subAccountId).eq("broadcast_id",filter.broadcast).order("id").range(offset,offset+499)
        if(["sent","failed","pending"].includes(filter.status??""))query=query.eq("status",filter.status!)
        const {data,error}=await query
        if(error)throw error
        rows.push(...(data??[]));if((data?.length??0)<500)break
      }
      const enriched=await attachEngagement(supabase,rows)
      const ids=new Set(enriched.filter(r=>matchesEngagement(r.engagement,filter.engagement??"all")&&(!filter.link||r.engagement.links.some(l=>l.url.toLowerCase().includes(filter.link!.toLowerCase())))).map(r=>r.contact_id))
      filteredContacts=filteredContacts.filter(c=>ids.has(c.id))
    } catch { historyError="Could not load engagement"; filteredContacts=[] }

  }
  return <ContactsPage broadcastEngagement={filter.engagement??"all"} broadcastLink={filter.link??""} broadcasts={broadcasts??[]} broadcastFilter={filter.broadcast??""} broadcastStatus={filter.status??"all"} historyError={historyError} contacts={filteredContacts as Contact[]} tagColors={tagColors} />
}
