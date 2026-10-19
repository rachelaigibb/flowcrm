import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { COLUMN_WIDTHS_KEY, parseColumnWidths, useContactColumnWidths } from '@/features/contacts/use-contact-column-widths'
beforeEach(()=>{
 localStorage.clear()
 window.dispatchEvent(new StorageEvent('storage',{key:COLUMN_WIDTHS_KEY}))
})
it('validates stored widths, bounds values and keeps defaults for missing or invalid columns',()=>{
 expect(parseColumnWidths('broken').name).toBe(220)
 expect(parseColumnWidths('[]').email).toBe(260)
 const widths=parseColumnWidths('{"name":9999,"email":-5,"phone":"200","source":null,"unknown":300}')
 expect(widths).toMatchObject({name:800,email:100,phone:160,source:160,tags:220})
 expect(widths).not.toHaveProperty('unknown')
})
it('restores preferences, persists multiple resizes and retains them after remount',()=>{
 localStorage.setItem(COLUMN_WIDTHS_KEY,'{"name":333}')
 const view=renderHook(()=>useContactColumnWidths())
 expect(view.result.current.columnWidths.name).toBe(333)
 act(()=>view.result.current.resizeColumn('email',420))
 expect(JSON.parse(localStorage.getItem(COLUMN_WIDTHS_KEY)!)).toMatchObject({name:333,email:420})
 act(()=>view.result.current.resizeColumn('name',350))
 view.unmount()
 const next=renderHook(()=>useContactColumnWidths())
 expect(next.result.current.columnWidths).toMatchObject({name:350,email:420})
})
it('keeps resizing usable when browser storage is unavailable',()=>{
 const get=vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('blocked')})
 const set=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota')})
 const view=renderHook(()=>useContactColumnWidths())
 expect(view.result.current.columnWidths.name).toBe(220)
 act(()=>view.result.current.resizeColumn('name',375))
 expect(view.result.current.columnWidths.name).toBe(375)
 get.mockRestore();set.mockRestore()
})
