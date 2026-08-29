/** @type {import('tailwindcss').Config} */

module.exports = {

darkMode: ["class"],

content: [
	"./index.html",
	"./src/**/*.{ts,tsx,js,jsx}"
],


theme: {

extend: {


borderRadius: {

lg: 'var(--radius)',

md: 'calc(var(--radius) - 2px)',

sm: 'calc(var(--radius) - 4px)'

},



colors: {

background:'hsl(var(--background))',

foreground:'hsl(var(--foreground))',


border:'hsl(var(--border))',

input:'hsl(var(--input))',

ring:'hsl(var(--ring))',



primary:{

DEFAULT:'hsl(var(--primary))',

foreground:'hsl(var(--primary-foreground))'

},



secondary:{

DEFAULT:'hsl(var(--secondary))',

foreground:'hsl(var(--secondary-foreground))'

},



muted:{

DEFAULT:'hsl(var(--muted))',

foreground:'hsl(var(--muted-foreground))'

},



accent:{

DEFAULT:'hsl(var(--accent))',

foreground:'hsl(var(--accent-foreground))'

},



destructive:{

DEFAULT:'hsl(var(--destructive))',

foreground:'hsl(var(--destructive-foreground))'

},



card:{

DEFAULT:'hsl(var(--card))',

foreground:'hsl(var(--card-foreground))'

},



popover:{

DEFAULT:'hsl(var(--popover))',

foreground:'hsl(var(--popover-foreground))'

},



thai: {

gold:'hsl(var(--thai-gold))',

'gold-light':'hsl(var(--thai-gold-light))',

green:'hsl(var(--thai-green))',

'green-light':'hsl(var(--thai-green-light))',

blue:'hsl(var(--thai-blue))',

ivory:'hsl(var(--thai-ivory))',

cream:'hsl(var(--thai-cream))',

temple:'hsl(var(--thai-temple))'

}


},



fontFamily: {

heading:['var(--font-heading)'],

body:['var(--font-body)'],

display:['var(--font-display)'],

mono:['var(--font-mono)'],

thai:['var(--font-thai)']

},



keyframes:{


'accordion-down':{

from:{
height:'0'
},

to:{
height:'var(--radix-accordion-content-height)'
}

},



'accordion-up':{

from:{
height:'var(--radix-accordion-content-height)'
},

to:{
height:'0'
}

},



// 泰语背景斜向移动

thaiMove:{

'0%':{

transform:
'translateX(-30%) translateY(0) rotate(-18deg)'

},


'50%':{

transform:
'translateX(40%) translateY(-40px) rotate(-18deg)'

},


'100%':{

transform:
'translateX(120%) translateY(-80px) rotate(-18deg)'

}

},



// 漂浮动画

float:{

'0%,100%':{

transform:'translateY(0)'

},

'50%':{

transform:'translateY(-15px)'

}

},



// 光扫过

shine:{

'0%':{

transform:'translateX(-120%)'

},

'100%':{

transform:'translateX(120%)'

}

}



},




animation:{


'accordion-down':
'accordion-down 0.2s ease-out',


'accordion-up':
'accordion-up 0.2s ease-out',



// 泰语文字移动

thaiMove:
'thaiMove 35s linear infinite',



// AI头像漂浮

float:
'float 4s ease-in-out infinite',



// 按钮流光

shine:
'shine 3s linear infinite'


}



}

},



plugins:[

require("tailwindcss-animate")

]


}