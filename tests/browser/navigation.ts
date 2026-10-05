export const useRouter = () => ({push:(url:string)=>{document.querySelector('#navigation')!.textContent=url},refresh:()=>{}})
