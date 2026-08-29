import React, { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Volume2,
  BookOpen,
  Trophy
} from "lucide-react";

import {
  ThaiPatternBand,
  ThaiDivider,
  ThaiPatternOverlay,
  LotusSilhouette,
} from "./common/ThaiMotifs";


export default function AuthLayout({
  icon: Icon,
  title,
  subtitle = "",
  footer = null,
  children = null
}) {
const welcomeText = "สวัสดีค่ะ 👋 我是你的泰语AI老师";


const [typedText,setTypedText] = useState("");


const contentRef = useRef(null);

const [fitScale,setFitScale] = useState(1);


/* 视口高度自适应缩放：内容超出视口时整体轻微缩小，保证一屏显示 */

useEffect(()=>{

let natural = 0;


const compute = ()=>{

const el = contentRef.current;

if(!el) return;


if(natural === 0){

el.style.height = "auto";


requestAnimationFrame(()=>{

natural = el.offsetHeight || el.scrollHeight || 0;

apply();

});

}else{

apply();

}


function apply(){

if (window.innerWidth < 768) {

setFitScale(1);

el.style.height = "auto";

return;

}

const maxH = window.innerHeight * 0.97;

const s = natural > maxH ? Math.max(0.66, maxH / natural) : 1;

setFitScale(s);

el.style.height = s < 1 ? `${Math.round(natural * s)}px` : "auto";

}

};


compute();


const t = setTimeout(compute, 500);


const onResize = ()=>{

requestAnimationFrame(compute);

};


window.addEventListener("resize", onResize);


return ()=>{

clearTimeout(t);

window.removeEventListener("resize", onResize);

};


},[]);



useEffect(()=>{

let index = 0;


const timer = setInterval(()=>{

setTypedText(
welcomeText.slice(0,index)
);


index++;


if(index > welcomeText.length){

clearInterval(timer);

}


},120);



return ()=>clearInterval(timer);


},[]);

return (

<div
className="
relative
min-h-screen
overflow-x-hidden
overflow-y-auto
flex
items-start
bg-black
md:items-center
"
>


{/* 顶部泰式纹样带（外包绝对容器，避免 relative 参与 flex 布局挤压内容） */}

<div

className="
absolute
left-0

top-0

z-[5]

w-full
"

>


<ThaiPatternBand
opacity={0.16}
height={16}
/>


</div>


{/* 星空视频 */}

<video

className="
absolute
inset-0
w-full
h-full
object-cover
scale-110
animate-[spaceMove_30s_linear_infinite]
"

autoPlay
muted
loop
playsInline
preload="auto"

>

<source
src="/starry-sky.mp4"
type="video/mp4"
/>

</video>


{/* 泰语透明文字漂浮层 */}

<div

className="

absolute

inset-0

overflow-hidden

pointer-events-none

z-[1]

"

>


<div

className="

absolute

text-[180px]

font-black

text-yellow-200/[0.06]

whitespace-nowrap

rotate-[-18deg]

animate-[thaiMove_25s_linear_infinite]

"

>

ภาษาไทย ภาษาไทย ปรีชา ปรีชา

</div>


<div

className="

absolute

top-[35%]

left-[-20%]

text-[140px]

font-black

text-emerald-200/[0.05]

whitespace-nowrap

rotate-[-18deg]

animate-[thaiMove_35s_linear_infinite]

"

>

เรียนรู้ภาษาไทย

</div>
<div

className="

absolute

top-[10%]

left-[-50%]

text-[140px]

font-black

text-emerald-200/[0.05]

whitespace-nowrap

rotate-[-18deg]

animate-[thaiMove_35s_linear_infinite]

"

>

ปรีชา ปรีชา

</div>

<div

className="

absolute

top-[70%]

left-[-30%]

text-[120px]

font-black

text-white/[0.04]

whitespace-nowrap

rotate-[-18deg]

animate-[thaiMove_40s_linear_infinite]

"

>

สวัสดี ยินดีต้อนรับ

</div>


</div>


{/* AI金色粒子 */}

<div

className="

absolute

inset-0

overflow-hidden

pointer-events-none

z-[3]

"

>


<span

className="

absolute

top-[18%]

left-[20%]


w-2

h-2


rounded-full


bg-yellow-300/70


shadow-[0_0_30px_rgba(250,204,21,.8)]


animate-ping

"

/>



<span

className="

absolute

top-[35%]

left-[65%]


w-3

h-3


rounded-full


bg-emerald-300/70


shadow-[0_0_40px_rgba(16,185,129,.8)]


animate-pulse

"

/>



<span

className="

absolute

top-[70%]

left-[30%]


w-1.5

h-1.5


rounded-full


bg-white/80


shadow-[0_0_25px_rgba(255,255,255,.8)]


animate-ping

"

/>



<span

className="

absolute

top-[55%]

left-[85%]


w-2

h-2


rounded-full


bg-yellow-200/60


shadow-[0_0_30px_rgba(250,204,21,.6)]


animate-pulse

"

/>


</div>
<div

className="

absolute

inset-0

z-[3]

pointer-events-none

"

>

<div

className="

absolute

top-[25%]

left-[45%]

w-24

h-24

rounded-full

bg-yellow-400/10

blur-3xl

animate-pulse

"

/>


<div

className="

absolute

bottom-[20%]

right-[20%]

w-32

h-32

rounded-full

bg-emerald-400/10

blur-3xl

animate-pulse

"

/>


</div>

{/* 黑色遮罩 */}

<div

className="
absolute
inset-0

bg-gradient-to-r

from-black/75

via-black/40

to-black/70

"

/>





{/* 金色泰式光 */}

<div

className="
absolute
inset-0

bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,.30),transparent_35%)]

animate-pulse

"

/>





{/* 绿色AI光 */}

<div

className="
absolute
inset-0

bg-[radial-gradient(circle_at_bottom_left,rgba(16,185,129,.18),transparent_38%)]

animate-pulse

"

/>








{/* 星空粒子 */}

<div
className="
absolute
inset-0
pointer-events-none
"
>


<div
className="
absolute
top-[20%]
left-[25%]

w-2
h-2

rounded-full

bg-yellow-200

animate-ping
"
/>


<div
className="
absolute
top-[40%]
right-[25%]

w-1.5
h-1.5

rounded-full

bg-emerald-300

animate-pulse
"
/>


<div
className="
absolute
bottom-[20%]
left-[45%]

w-1
h-1

rounded-full

bg-white

animate-ping
"
/>


</div>







<div

ref={contentRef}

className="
relative
z-10
flex
w-full
flex-col
self-start
pt-14
pb-8
md:flex-row
md:items-center
md:self-auto
md:pt-0
md:pb-0
"

style={{
transform: fitScale < 1 ? `scale(${fitScale})` : undefined,
transformOrigin: "center center",
transition: "transform 300ms ease",
}}

>



{/* 移动端精简品牌条 */}

<div

className="

md:hidden

absolute

top-0

left-0

right-0

z-20


flex

items-center

justify-center

gap-3


px-4

py-3


bg-black/50

backdrop-blur-xl

border-b

border-white/10

"

>


<div

className="
relative

w-9
h-9

rounded-xl

bg-gradient-to-br

from-yellow-300

via-yellow-500

to-emerald-500


flex

items-center

justify-center


shadow-[0_0_24px_rgba(250,204,21,.4)]

"

>


<span

className="
relative
z-10

text-white

font-black

text-sm

"

>
ไทย
</span>


</div>


<span

className="

text-lg

font-black

tracking-tight


bg-gradient-to-r

from-yellow-200

via-white

to-emerald-300


bg-clip-text

text-transparent

"

>

ThaiAI

</span>


<span

className="

w-px

h-4

bg-white/20

"

/>


<span

className="

text-emerald-200/80

text-xs

tracking-[0.2em]

"

>

เรียนภาษาไทย

</span>


</div>







{/* 左侧品牌 */}

<div

className="
relative

hidden
md:flex

w-1/2

items-center

justify-center

px-10

xl:px-16

"

>


{/* 泰丝纹样底纹（低透明度） */}

<ThaiPatternOverlay
opacity={0.05}
patternId="auth-brand-pattern"
className="opacity-40"
/>


{/* 金色纵向分隔线 */}

<div

className="
absolute

right-0

top-8

bottom-8

w-px

bg-gradient-to-b

from-transparent

via-yellow-300/50

to-transparent

"

/>


{/* 莲花剪影（右下角） */}

<LotusSilhouette
className="
absolute

bottom-6

right-8

w-24

xl:w-28

opacity-60
"
/>


<div

className="
max-w-xl
"

>





{/* Logo */}

<div
style={{ animationDelay: "0s" }}

className="
flex
items-center
gap-5
mb-6

xl:mb-8

brand-enter
"

>


<div

className="
relative

w-20
h-20

rounded-[30px]

bg-gradient-to-br

from-yellow-300

via-yellow-500

to-emerald-500


flex
items-center
justify-center


shadow-[0_0_70px_rgba(250,204,21,.55)]

"

>


<div

className="
absolute

inset-[-12px]

rounded-[35px]

border

border-yellow-300/40

animate-spin

[animation-duration:12s]

"

/>


<span

className="
relative
z-10

text-white

font-black

text-3xl

"

>
ไทย
</span>



<Sparkles

className="
absolute

-top-2

-right-2

w-7

h-7

text-yellow-100

animate-pulse

"

/>


</div>





<div>


<h3

className="

text-4xl

font-black

tracking-tight


bg-gradient-to-r

from-yellow-200

via-white

to-emerald-300


bg-clip-text

text-transparent


drop-shadow-[0_0_20px_rgba(250,204,21,.35)]

"

>

ThaiAI

</h3>


<p

className="
text-white/60

text-xs

tracking-[0.35em]
"

>
泰语AI学习平台
</p>


<p

className="
text-emerald-300/70

text-[10px]

tracking-widest

mt-1
"

>
AI POWERED THAI LEARNING
</p>


</div>


</div>


<div
className="
absolute

w-2
h-2

rounded-full

bg-yellow-300

blur-sm

animate-ping

left-[-20px]

top-[40%]

"
/>


<h2
style={{ animationDelay: "0.12s" }}

className="

text-2xl

lg:text-4xl

xl:text-5xl

2xl:text-[58px]

font-black

brand-enter

leading-[1.18]

tracking-wide

mb-6

xl:mb-8


bg-gradient-to-r

from-yellow-200

via-white

to-emerald-300


bg-[length:200%_auto]

animate-[gradientMove_5s_linear_infinite]


bg-clip-text

text-transparent


drop-shadow-[0_0_40px_rgba(255,255,255,.25)]

"

>
    <p

className="

flex

items-center

gap-2

text-emerald-300/80

text-xs

tracking-[0.35em]

mb-8

"

>

<span>

✦

</span>

AI LANGUAGE COMPANION

</p>

เรียนภาษาไทย

<br/>

กับ AI ครูใจดี

</h2>



<p
style={{ animationDelay: "0.24s" }}

className="

hidden

lg:block

text-white/75

text-base

xl:text-lg

leading-loose

brand-enter

tracking-[0.08em]

font-light

mb-6

xl:mb-8

"

>

探索泰语世界

<br/>

从发音、词汇到真实交流

<br/>

让 AI 成为你的私人语言伙伴

</p>
<p
style={{ animationDelay: "0.36s" }}

className="

hidden

lg:block

mt-5

text-emerald-300/80

brand-enter

text-xs

tracking-[0.45em]

uppercase

"

>

DISCOVER THAI WITH AI

</p>








{/* 功能展示 */}

<div
style={{ animationDelay: "0.48s" }}

className="

hidden

lg:block

relative

space-y-4

brand-enter


before:absolute

before:left-5

before:top-8

before:bottom-8

before:w-px


before:bg-gradient-to-b

before:from-yellow-300/70

before:via-emerald-300/50

before:to-transparent


before:animate-pulse

"

>



{/* 发音 */}

<div

className="

group

relative

flex

items-center

gap-4

px-5

py-3

xl:py-4

rounded-2xl


bg-transparent


border

border-white/15


backdrop-blur-sm


shadow-[0_8px_30px_rgba(0,0,0,.12)]


transition-all

duration-300


hover:bg-white/[0.06]

hover:border-white/30


hover:translate-x-2


hover:shadow-[0_0_30px_rgba(251,146,60,.25)]

"
>


<div

className="

relative

z-10

w-10

h-10


rounded-xl


bg-emerald-400/20


flex

items-center

justify-center

"

>

<Volume2

className="
w-5
h-5
text-emerald-300
"

/>


</div>



<span

className="

text-white/90

text-sm

tracking-wide

"

>AI实时发音评分与纠正
</span>

<span

className="

ml-auto

text-[10px]

font-black

tracking-widest

text-yellow-300/50

"

>

01
</span>



</div>







{/* 词汇 */}

<div

className="

group

relative

flex

items-center

gap-4

px-5

py-3

xl:py-4

rounded-2xl


bg-transparent


border

border-white/15


backdrop-blur-sm


shadow-[0_8px_30px_rgba(0,0,0,.12)]


transition-all

duration-300


hover:bg-white/[0.06]

hover:border-white/30


hover:translate-x-2


hover:shadow-[0_0_30px_rgba(251,146,60,.25)]

"

>


<div

className="

relative

z-10

w-10

h-10


rounded-xl


bg-yellow-400/20


flex

items-center

justify-center

"

>


<BookOpen

className="
w-5
h-5
text-yellow-300
"

/>


</div>



<span

className="

text-white/90

text-sm

tracking-wide

"

>智能词汇记忆系统
</span>

<span

className="

ml-auto

text-[10px]

font-black

tracking-widest

text-yellow-300/50

"

>

02
</span>



</div>








{/* 排行 */}

<div

className="

group

relative

flex

items-center

gap-4

px-5

py-3

xl:py-4

rounded-2xl


bg-transparent


border

border-white/15


backdrop-blur-sm


shadow-[0_8px_30px_rgba(0,0,0,.12)]


transition-all

duration-300


hover:bg-white/[0.06]

hover:border-white/30


hover:translate-x-2


hover:shadow-[0_0_30px_rgba(251,146,60,.25)]

"

>


<div

className="

relative

z-10

w-10

h-10


rounded-xl


bg-orange-400/20


flex

items-center

justify-center

"

>


<Trophy

className="
w-5
h-5
text-orange-300
"

/>


</div>



<span

className="

text-white/90

text-sm

tracking-wide

"

>学习挑战排行榜
</span>

<span

className="

ml-auto

text-[10px]

font-black

tracking-widest

text-yellow-300/50

"

>

03
</span>



</div>





</div>





{/* 品牌底部签名 */}

<div
style={{ animationDelay: "0.6s" }}

className="

hidden

lg:block

mt-10

xl:mt-14

pt-6

border-t

brand-enter

border-white/10


"

>        <p

className="

text-emerald-300/70

text-[10px]

tracking-[0.45em]

uppercase

"

>

THAI LANGUAGE JOURNEY

</p>



<ThaiDivider

compact

className="

mt-4

!w-64

"

/>



<p

className="

mt-3

text-white/60

text-sm

leading-relaxed

tracking-wide

"

>

🌌 ใต้ท้องฟ้าเดียวกัน

</p>



<p

className="

mt-1

text-white/40

text-xs

leading-relaxed

"

>

在同一片天空下，

我们通过语言认识世界。

</p>


</div>





</div>

</div>









{/* 右侧登录区域 */}

<div

className="
w-full

flex

items-center

justify-center


px-4

pt-3

pb-6

sm:px-6

md:w-1/2

md:pt-24

md:pb-8

lg:py-6

"

>


<div

className="
w-full

max-w-md

px-0

sm:px-2

"

>








{/* AI教师头像 */}

<div

className="flex

justify-center

mb-4

"

>


<div

className="
relative

"

>


<div

className="
absolute


inset-[-20px]
rounded-fullbg-emerald-400/20
blur-3xl
avatar-breathe
"/>

<div

className="

absolute

inset-[-25px]

rounded-full


border

border-emerald-300/30


animate-spin


[animation-duration:15s]

"

>
</div>

<div

className="

absolute

inset-[-42px]

rounded-full


border

border-dashed

border-yellow-300/25


animate-spin


[animation-duration:30s]

[animation-direction:reverse]

"

>
</div>





<img

src="/thai-teacher-modern.svg"

alt="AI Teacher"

className="

relative

w-28
h-28

xl:w-36
xl:h-36


rounded-full


object-cover


border-2

border-white/30


shadow-[0_0_100px_rgba(16,185,129,.7)]


hover:scale-105


transition-all

duration-700

"

/>






<div

className="
absolute

-bottom-3

left-1/2

-translate-x-1/2


px-4

py-1.5


rounded-full


bg-black/60


border

border-emerald-300/30


backdrop-blur-xl


text-white


text-xs


whitespace-nowrap

"

>

🟢 AI老师在线

</div>








{/* AI气泡 */}

<div

className="
absolute

top-[-10px]


z-20

left-1/2

-translate-x-[115%]


w-44
sm:w-48
text-center


px-5


py-2


rounded-2xl


bg-white/10


border

border-white/10


backdrop-blur-xl


text-white


text-xs


shadow-xl


animate-pulse

"

>

สวัสดี 👋

<br/>

今天一起学习泰语吧

</div>




</div>


</div>





{/* AI教师动态欢迎语 */}


<div

className="

flex

justify-center

mb-4

"

>


<div

className="

px-5

py-3


rounded-2xl


bg-white/[0.05]


border

border-white/15


backdrop-blur-xl


text-center


shadow-lg

"

>


<p

className="

text-emerald-300

text-xs

tracking-wide

font-medium

"

>

🤖 AI Teacher

</p>



<p

className="

mt-1

text-white/80

text-sm

"

>

{typedText}

<span

className="

inline-block

ml-1

w-[2px]

h-4

bg-emerald-300

animate-pulse

"

/>


</p>



</div>


</div>


{/* 登录标题 */}

<div

className="
text-center

mb-6

"

>


<div

className="
relative

inline-flex

items-center

justify-center


w-14

h-14


rounded-3xl


bg-gradient-to-br

from-emerald-400

to-emerald-700


shadow-[0_0_50px_rgba(16,185,129,.5)]


mb-4

"

>

<Icon

className="
w-7

h-7

text-white

"

/>


<div

className="

absolute

inset-[-7px]

rounded-[24px]

border

border-yellow-300/30

"

/>

</div>





<h1

className="
text-3xl

xl:text-4xl

font-black

text-white

"

>

{title}

</h1>




{

subtitle &&

<p

className="
mt-3

text-white/70

"

>

{subtitle}

</p>

}

</div>








{/* 品牌面板：金色渐变边框（桌面端） */}

<div

className="

relative

w-full

p-[0.5px]

rounded-[24px]

sm:rounded-[33px]

bg-gradient-to-br

from-yellow-300/25

via-white/10

to-emerald-300/20

shadow-[0_0_40px_rgba(250,204,21,.08)]

lg:p-px

lg:from-yellow-300/50

lg:via-white/20

lg:to-emerald-300/40

lg:shadow-[0_30px_100px_rgba(0,0,0,.55),0_0_60px_rgba(250,204,21,.15)]

"

>


{/* 金色描边流光（光弧沿边框缓慢环绕，桌面端） */}

<div

className="

border-flow

hidden

lg:block

"

/>


{/* 金色泰式角标（右上角，桌面端） */}

<div

className="

hidden

lg:block

absolute

-top-3

-right-3

z-20

pointer-events-none

drop-shadow-[0_0_8px_rgba(250,204,21,.45)]

"

>


<svg

width="38"

height="38"

viewBox="0 0 38 38"

fill="none"

aria-hidden="true"

>


<defs>

<linearGradient

id="cornerBadgeGold"

x1="0"

y1="0"

x2="38"

y2="38"

gradientUnits="userSpaceOnUse"

>

<stop offset="0" stopColor="#F6D365" />

<stop offset="0.5" stopColor="#D4AF37" />

<stop offset="1" stopColor="#B88A20" />

</linearGradient>

</defs>


{/* 外菱形 */}

<path

d="M 19 1.5 L 36.5 19 L 19 36.5 L 1.5 19 Z"

stroke="url(#cornerBadgeGold)"

strokeWidth="1.2"

fill="rgba(245,214,123,.05)"

/>


{/* 内方框 */}

<path

d="M 19 6.5 L 31.5 19 L 19 31.5 L 6.5 19 Z"

stroke="url(#cornerBadgeGold)"

strokeWidth="0.7"

opacity="0.55"

/>


{/* 中央莲花四瓣 */}

<path

d="M 19 10 C 20.6 14 20.6 16.4 19 19 C 17.4 16.4 17.4 14 19 10 Z"

fill="url(#cornerBadgeGold)"

opacity="0.9"

/>

<path

d="M 28 19 C 24 20.6 21.6 20.6 19 19 C 21.6 17.4 24 17.4 28 19 Z"

fill="url(#cornerBadgeGold)"

opacity="0.9"

/>

<path

d="M 19 28 C 17.4 24 17.4 21.6 19 19 C 20.6 21.6 20.6 24 19 28 Z"

fill="url(#cornerBadgeGold)"

opacity="0.9"

/>

<path

d="M 10 19 C 14 17.4 16.4 17.4 19 19 C 16.4 20.6 14 20.6 10 19 Z"

fill="url(#cornerBadgeGold)"

opacity="0.9"

/>


{/* 中心点 */}

<circle cx="19" cy="19" r="1.6" fill="#F6D365" />


</svg>

</div>




{/* 玻璃登录卡 */}

<div

className="

relative

overflow-hidden


rounded-[32px]


border

border-white/10


bg-white/[0.03]


backdrop-blur-3xl

shadow-[0_30px_100px_rgba(0,0,0,.55)]

p-5

xl:p-6

"

>





{/* 流光 */}

<div

className="

absolute

top-0

left-[-60%]


w-[45%]


h-full


bg-gradient-to-r


from-transparent


via-white/20


to-transparent


skew-x-12


animate-[glassMove_6s_infinite]

"

/>


{/* 金色顶边 */}

<div

className="

absolute

top-0

left-12

right-12

h-px


bg-gradient-to-r


from-transparent


via-yellow-300/60


to-transparent

"

/>


{/* 内高光 */}

<div

className="

absolute

inset-0

pointer-events-none

rounded-[32px]

shadow-[inset_0_1px_0_rgba(255,255,255,.10),inset_0_0_40px_rgba(16,185,129,.04)]

"

/>




{/* 内部光 */}

<div

className="

absolute

right-[-40px]


top-[-40px]


w-40


h-40


rounded-full


bg-emerald-400/20


blur-3xl

"

/>







<div

className="

relative

z-10

"

>

{children}

</div>





</div>

</div>





<div

className="

text-center

mt-4

space-y-2

"

>


<p

className="

text-emerald-300/70

text-[10px]

tracking-[0.45em]

"

>

AI THAI LANGUAGE ENGINE

</p>


<p

className="

text-white/40

text-xs

"

>

Powered by AI · Inspired by Thailand 🇹🇭

</p>


</div>



{/* footer */}

{

footer &&

<p

className="

text-center

mt-5

text-white/60

text-sm

"

>

{footer}

</p>

}





</div>

</div>

</div>

</div>

);

}