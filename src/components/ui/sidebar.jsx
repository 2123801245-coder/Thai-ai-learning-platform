import React from "react";
import {
Home,
BookOpen,
Mic,
Trophy,
User
} from "lucide-react";

import { useNavigate } from "react-router-dom";


export default function Sidebar(){


const navigate = useNavigate();



const menus=[

{
name:"首页",
icon:Home,
path:"/"
},

{
name:"课程学习",
icon:BookOpen,
path:"#"
},

{
name:"口语练习",
icon:Mic,
path:"#"
},

{
name:"学习排行",
icon:Trophy,
path:"#"
}

];



return (

<aside

className="

w-72

min-h-screen

relative

flex

flex-col

p-6


bg-black/40

border-r

border-white/10

backdrop-blur-3xl


"


>


{/* 背景光 */}

<div

className="

absolute

top-0

left-0

w-full

h-64

bg-gradient-to-b

from-yellow-400/20

to-transparent

blur-3xl

pointer-events-none

"

/>



<div

className="

relative

z-10

"

>



{/* Logo */}


<div className="mb-12">


<div

className="

text-4xl

font-black

bg-gradient-to-r

from-yellow-300

via-white

to-emerald-400

bg-clip-text

text-transparent

"

>

ThaiAI

</div>



<p

className="

text-white/40

text-xs

tracking-[0.35em]

mt-2

"

>

AI THAI TEACHER

</p>



</div>






{/* 菜单 */}

<nav

className="

space-y-3

"

>


{

menus.map((item)=>{


const Icon=item.icon;


return (

<button

key={item.name}

onClick={()=>{

if(item.path!=="#"){

navigate(item.path)

}

}}


className="

group

w-full

flex

items-center

gap-4


px-4

py-3.5


rounded-2xl


text-white/70


hover:text-white


hover:bg-white/10


border

border-transparent


hover:border-white/20


transition-all

"


>


<Icon


className="

w-5

h-5

text-emerald-300

group-hover:scale-110

transition

"

/>


<span>

{item.name}

</span>



</button>


)


})

}



</nav>




</div>





{/* 用户区域 */}

<div

className="

mt-auto

relative

z-10

"

>



<button

onClick={()=>navigate("/profile")}


className="


w-full


flex

items-center

gap-4


p-4


rounded-3xl


bg-white/10


border

border-white/20


backdrop-blur-xl


hover:bg-white/20


transition-all


"

>


<img


src="/avatar.png"


className="

w-14

h-14


rounded-full


object-cover


border-2


border-emerald-300


shadow-[0_0_30px_rgba(16,185,129,.5)]

"

/>




<div className="text-left">


<p

className="

text-white

font-bold

"

>

Zhong Hua

</p>



<p

className="

text-xs

text-emerald-300

"

>

个人中心 →

</p>



</div>



</button>



</div>




</aside>


)

}