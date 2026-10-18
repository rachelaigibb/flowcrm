import Image from "next/image"
import icon from "@/app/icon.png"

// Use the approved app artwork so the in-app mark and installed icon stay aligned.
// Decorative: each placement includes the visible FlowCRM name alongside it.
export function FlowCRMMark({ size = 32 }: { size?: number }) {
  return (
    <Image
      src={icon}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-md"
    />
  )
}
