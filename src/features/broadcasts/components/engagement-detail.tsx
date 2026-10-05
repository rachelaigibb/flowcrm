import { safeLink, type Engagement } from "../engagement"
export function EngagementDetail({ engagement: e, timezone = "UTC" }: { engagement: Engagement; timezone?: string }) {
 const time = (value: string) => new Date(value).toLocaleString(undefined, {timeZone:timezone}) + ` (${timezone})`
 return <div className="space-y-1 text-xs min-w-48 max-w-lg">
  <div>{e.deliveredAt ? `Delivered to receiving server: ${time(e.deliveredAt)}` : "Delivery unknown"}</div>
  {e.issue && <div className="text-destructive">{e.issue.replace("email.", "").replaceAll("_", " ")}: {time(e.issueAt!)}</div>}
  <div>{e.clicks ? `${e.clicks} click events · ${e.links.length} unique links` : "No clicks recorded; reading/interest unknown"}</div>
  {!!e.clicks && <details><summary className="cursor-pointer underline">Clicked links and times</summary>
   <p>First: {time(e.firstClickedAt!)}<br/>Latest: {time(e.lastClickedAt!)}</p>
   <ul className="space-y-2 mt-2">{e.links.map(l=><li key={l.url} className="break-all">{safeLink(l.url)?<a href={safeLink(l.url)} target="_blank" rel="noreferrer" className="underline">{l.url}</a>:<span>{l.url}</span>}<br/>{l.clicks} events · first {time(l.firstAt)} · latest {time(l.lastAt)}</li>)}</ul>
  </details>}
 </div>
}
