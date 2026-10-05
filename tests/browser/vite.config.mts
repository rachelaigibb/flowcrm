import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
const root=fileURLToPath(new URL('../../',import.meta.url))
const fixture=fileURLToPath(new URL('./',import.meta.url))
export default defineConfig({root:fixture,plugins:[{name:'isolated-actions',enforce:'pre',resolveId(id){if(/(?:recipient-actions|features\/broadcasts\/actions)(?:\.ts)?$/.test(id))return fixture+'actions.ts'}},react()],resolve:{alias:{'@':root+'src','next/navigation':fixture+'navigation.ts','next/link':fixture+'link.tsx'}},server:{host:'127.0.0.1',port:4173,fs:{allow:[root]}}})
