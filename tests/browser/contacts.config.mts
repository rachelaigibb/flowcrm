import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('../../',import.meta.url))
const fixture=fileURLToPath(new URL('./',import.meta.url))
export default defineConfig({root:fixture,plugins:[{name:'isolated-contact-fixture',enforce:'pre',resolveId(id){
 if(/contact-audience-actions$/.test(id))return fixture+'contact-broadcast-actions.ts'
 if(id==='../actions' || /features\/contacts\/actions$/.test(id))return '\0contacts-actions'
 if(/\/(?:create-contact-dialog|import-csv-dialog)$/.test(id))return '\0contacts-dialogs'
},load(id){
 if(id==='\0contacts-actions')return 'export async function deleteContact(){ throw new Error("Fixture writes disabled") }'
 if(id==='\0contacts-dialogs')return 'export function CreateContactDialog(){return null};export function ImportCSVDialog(){return null}'
}},react()],resolve:{alias:{'@':root+'src','next/navigation':fixture+'navigation.ts','next/link':fixture+'link.tsx'}},server:{host:'127.0.0.1',port:4174,fs:{allow:[root]}}})
