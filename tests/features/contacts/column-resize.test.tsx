import { useState } from 'react'
import { expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContactColumnHeader } from '@/features/contacts/components/contact-column-header'
function Fixture({onSort=()=>{}}:{onSort?:()=>void}) {
 const [width,setWidth]=useState(220)
 return <table><thead><tr><ContactColumnHeader label="Name" width={width} sort={null} onSort={onSort} onWidth={setWidth}/></tr></thead></table>
}
it('resizes by keyboard with bounds and never sorts through the handle',()=>{
 const sort=vi.fn()
 render(<Fixture onSort={sort}/>)
 const handle=screen.getByRole('separator',{name:'Resize Name column'})
 fireEvent.keyDown(handle,{key:'ArrowRight'})
 expect(handle).toHaveAttribute('aria-valuenow','230')
 fireEvent.keyDown(handle,{key:'ArrowLeft',shiftKey:true})
 expect(handle).toHaveAttribute('aria-valuenow','180')
 for(let i=0;i<20;i++) fireEvent.keyDown(handle,{key:'ArrowLeft',shiftKey:true})
 expect(handle).toHaveAttribute('aria-valuenow','100')
 for(let i=0;i<20;i++) fireEvent.keyDown(handle,{key:'ArrowRight',shiftKey:true})
 expect(handle).toHaveAttribute('aria-valuenow','800')
 fireEvent.click(handle)
 expect(sort).not.toHaveBeenCalled()
})
it('tracks pointer drag outside its starting position, stops on release and cancellation',()=>{
 vi.stubGlobal('PointerEvent',MouseEvent)
 render(<Fixture/>)
 const handle=screen.getByRole('separator')
 handle.setPointerCapture=vi.fn()
 handle.releasePointerCapture=vi.fn()
 fireEvent.pointerDown(handle,{button:0,clientX:200})
 fireEvent.pointerMove(handle,{clientX:300})
 expect(handle).toHaveAttribute('aria-valuenow','320')
 fireEvent.pointerUp(handle)
 fireEvent.pointerMove(handle,{clientX:400})
 expect(handle).toHaveAttribute('aria-valuenow','320')
 fireEvent.pointerDown(handle,{button:0,clientX:300})
 fireEvent.pointerCancel(handle)
 fireEvent.pointerMove(handle,{clientX:400})
 expect(handle).toHaveAttribute('aria-valuenow','320')
 vi.unstubAllGlobals()
})
