// @ts-nocheck — vendored shadcn-style component; see eslint.config.js
import * as React from "react"

import { cn } from "@/lib/utils"


const Input = React.forwardRef(
({ className, type, ...props }, ref) => {

return (

<input

type={type}

className={cn(

`
flex
h-12
w-full
rounded-xl

border
border-white/20

bg-white/10

px-4
py-2

text-white

placeholder:text-white/40

backdrop-blur-xl

shadow-inner

transition-all
duration-300


focus:outline-none

focus:border-emerald-400

focus:ring-4

focus:ring-emerald-400/20


disabled:cursor-not-allowed

disabled:opacity-50

`,

className

)}

ref={ref}

{...props}

/>

)

})


Input.displayName="Input"


export {Input}
