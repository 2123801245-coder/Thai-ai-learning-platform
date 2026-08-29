// @ts-nocheck — vendored shadcn-style component; see eslint.config.js
import * as React from "react";

import { Slot } from "@radix-ui/react-slot";

import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";



const buttonVariants = cva(

`

inline-flex

items-center

justify-center

gap-2


whitespace-nowrap


rounded-xl


text-sm

font-bold


transition-all

duration-300


focus-visible:outline-none

focus-visible:ring-2

focus-visible:ring-emerald-400


disabled:pointer-events-none

disabled:opacity-50


relative

overflow-hidden


`,

{

variants:{


variant:{


default:

`

text-white

bg-gradient-to-r

from-emerald-500

via-teal-400

to-emerald-600


shadow-lg

shadow-emerald-500/30


hover:scale-[1.03]


hover:shadow-emerald-500/50

`,





secondary:

`

bg-white/10

text-white

border

border-white/20

backdrop-blur-xl


hover:bg-white/20

`,






outline:

`

border

border-white/30

text-white

bg-white/5


hover:bg-white/10

`,





ghost:

`

text-white/80

hover:bg-white/10

`,





destructive:

`

bg-red-500

text-white

hover:bg-red-600

`



},






size:{


default:

`

h-12

px-6

`,



sm:

`

h-9

px-4

`,



lg:

`

h-14

px-8

text-base

`,



icon:

`

h-10

w-10

`

}


},



defaultVariants:{


variant:"default",

size:"default"


}


}

);










const Button = React.forwardRef(

({

className,

variant,

size,

asChild=false,

children,

...props

},ref)=>{


const Comp = asChild ? Slot : "button";




return (

<Comp


className={cn(

buttonVariants({

variant,

size,

className

})


)}


ref={ref}


{...props}


>



{/* 光效层 */}

<span

className="

absolute

inset-0

bg-gradient-to-r

from-transparent

via-white/30

to-transparent


translate-x-[-120%]


hover:translate-x-[120%]


transition-transform

duration-700

"

>

</span>



<span

className="

relative

z-10

flex

items-center

gap-2

"

>

{children}

</span>



</Comp>

);



}

);



Button.displayName="Button";



export {

Button,

buttonVariants

};
