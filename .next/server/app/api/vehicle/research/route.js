"use strict";(()=>{var e={};e.id=287,e.ids=[287],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},2637:(e,t,i)=>{i.r(t),i.d(t,{originalPathname:()=>A,patchFetch:()=>S,requestAsyncStorage:()=>E,routeModule:()=>m,serverHooks:()=>g,staticGenerationAsyncStorage:()=>v});var s={};i.r(s),i.d(s,{POST:()=>d});var r=i(9303),o=i(8716),a=i(670),n=i(7070),c=i(7410);function l(e){let t=process.env[e],i="phase-production-build"===process.env.NEXT_PHASE;if(!t&&!i)throw Error(`Required environment variable "${e}" is not set.`);return t??""}let p={nodeEnv:"production",appUrl:"http://localhost:3000",apiUrl:"/api",databaseUrl:l("DATABASE_URL"),jwtSecret:l("JWT_SECRET"),jwtAccessExpiresIn:process.env.JWT_ACCESS_EXPIRES_IN??"15m",jwtRefreshExpiresIn:process.env.JWT_REFRESH_EXPIRES_IN??"30d",stripeSecretKey:process.env.STRIPE_SECRET_KEY??"",stripeWebhookSecret:process.env.STRIPE_WEBHOOK_SECRET??"",stripePublishableKey:"pk_test_placeholder",carVerticalApiKey:process.env.CARVERTICAL_API_KEY??"",carVerticalBaseUrl:process.env.CARVERTICAL_BASE_URL??"https://api.carvertical.com/v1",carVerticalUseMock:"true"===process.env.CARVERTICAL_USE_MOCK,storageEndpoint:process.env.STORAGE_ENDPOINT??"",storageAccessKey:process.env.STORAGE_ACCESS_KEY??"",storageSecretKey:process.env.STORAGE_SECRET_KEY??"",storageBucket:process.env.STORAGE_BUCKET??"uci-photos",openaiApiKey:process.env.OPENAI_API_KEY??"",features:{realTimeMessaging:"true"===process.env.FEATURE_REALTIME_MESSAGING,aiDeepScan:"true"===process.env.FEATURE_AI_DEEP_SCAN}},h=c.z.object({make:c.z.string().min(1).max(60),model:c.z.string().min(1).max(80),year:c.z.number().int().min(1980).max(new Date().getFullYear()+1),engine:c.z.string().max(100).optional(),trim:c.z.string().max(80).optional()});async function u(e){let t=p.openaiApiKey;if(!t)throw Error("OPENAI_API_KEY is not configured");let i=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({model:"gpt-4o",max_tokens:4096,temperature:.3,messages:[{role:"system",content:"You are an expert automotive advisor. Always respond with valid JSON only — no markdown, no prose, no code fences."},{role:"user",content:e}]})});if(!i.ok){let e=await i.text();throw Error(`OpenAI API error ${i.status}: ${e}`)}let s=await i.json(),r=(s.choices?.[0]?.message?.content??"").replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"").trim();try{return JSON.parse(r)}catch{throw Error("Failed to parse AI response as JSON")}}async function d(e){let t;try{t=await e.json()}catch{return n.NextResponse.json({message:"Invalid JSON body",code:"BAD_REQUEST"},{status:400})}let i=h.safeParse(t);if(!i.success)return n.NextResponse.json({message:"Validation failed",code:"VALIDATION_ERROR",details:i.error.flatten().fieldErrors},{status:422});let{make:s,model:r,year:o,engine:a,trim:c}=i.data;try{let e=function(e,t,i,s,r){let o=[i,e,t,r,s].filter(Boolean).join(" ");return`You are an expert automotive advisor helping a buyer inspect a used car before purchase.

The buyer is about to inspect a **${o}**.

Your task: Generate a comprehensive, practical pre-inspection guide based on real-world known issues, owner reports, recall data, and expert knowledge for this exact vehicle.

IMPORTANT RULES:
- Be specific to this exact make/model/year generation
- Use language like "commonly reported", "owners often note", "this generation may be prone to" — never present as absolute facts
- Prioritize issues that are actually common, not just theoretically possible
- Focus on what a buyer physically checking this car should look for
- Include repair cost context where it's genuinely a financial risk
- Be concise and actionable

Respond ONLY with valid JSON matching this exact structure:

{
  "vehicleKey": "${o}",
  "generatedAt": "${new Date().toISOString()}",
  "confidence": "high" | "medium" | "low",
  "overallRiskLevel": "low" | "moderate" | "high",
  "summary": "1–2 sentence overview of this model's general reliability and what buyers should know",
  "sections": {
    "commonProblems": {
      "id": "commonProblems",
      "title": "Common Problems",
      "items": [
        {
          "title": "Short problem title",
          "description": "Practical description of the issue and what to look for",
          "severity": "high" | "medium" | "low",
          "tags": ["COMMON_ISSUE"]
        }
      ]
    },
    "highPriorityChecks": {
      "id": "highPriorityChecks",
      "title": "High-Priority Checks",
      "items": [
        {
          "title": "Check item title",
          "description": "Specific thing to inspect and how",
          "severity": "high" | "medium" | "low",
          "tags": ["HIGH_ATTENTION"]
        }
      ]
    },
    "visualAttention": {
      "id": "visualAttention",
      "title": "Visual Attention Areas",
      "items": [
        {
          "title": "Area to inspect",
          "description": "What to look for visually",
          "severity": "high" | "medium" | "low",
          "tags": ["VISUAL_CHECK"]
        }
      ]
    },
    "mechanicalWatchouts": {
      "id": "mechanicalWatchouts",
      "title": "Mechanical Watchouts",
      "items": [
        {
          "title": "Mechanical issue",
          "description": "What it means and how to detect it",
          "severity": "high" | "medium" | "low",
          "tags": ["COMMON_ISSUE", "EXPENSIVE_RISK"]
        }
      ]
    },
    "testDriveFocus": {
      "id": "testDriveFocus",
      "title": "Test Drive Focus",
      "items": [
        {
          "title": "What to listen/feel for",
          "description": "Specific sensation or sound and what it may indicate",
          "severity": "high" | "medium" | "low",
          "tags": ["TEST_DRIVE"]
        }
      ]
    },
    "costAwareness": {
      "id": "costAwareness",
      "title": "Severity & Cost Awareness",
      "items": [
        {
          "title": "Expensive risk item",
          "description": "Why it's costly and what to negotiate on",
          "severity": "high" | "medium" | "low",
          "tags": ["EXPENSIVE_RISK"]
        }
      ]
    }
  },
  "disclaimer": "This guide is AI-generated based on commonly reported issues for this vehicle. Use as inspection guidance only — always verify findings with a qualified mechanic."
}

Generate 3–5 items per section. Be specific to the ${o}. Prioritize the most genuinely common and impactful issues real owners face.`}(s,r,o,a,c),t=await u(e);return n.NextResponse.json({data:t})}catch(i){let e=i instanceof Error?i.message:"Research failed";console.error("[vehicle/research] Error:",i);let t=e.includes("not configured");return n.NextResponse.json({message:t?"AI research is not available (API key not configured)":e,code:"RESEARCH_ERROR"},{status:t?503:500})}}let m=new r.AppRouteRouteModule({definition:{kind:o.x.APP_ROUTE,page:"/api/vehicle/research/route",pathname:"/api/vehicle/research",filename:"route",bundlePath:"app/api/vehicle/research/route"},resolvedPagePath:"C:\\Users\\Dusan\\car-inspector-ai\\src\\app\\api\\vehicle\\research\\route.ts",nextConfigOutput:"",userland:s}),{requestAsyncStorage:E,staticGenerationAsyncStorage:v,serverHooks:g}=m,A="/api/vehicle/research/route";function S(){return(0,a.patchFetch)({serverHooks:g,staticGenerationAsyncStorage:v})}}};var t=require("../../../../webpack-runtime.js");t.C(e);var i=e=>t(t.s=e),s=t.X(0,[948,972,410],()=>i(2637));module.exports=s})();