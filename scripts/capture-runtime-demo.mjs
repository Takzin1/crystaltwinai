/**
 * Capture REAL LOCAL browser screenshots for the CrystalTwinAI demo.
 * Run only after installing optional dev tool: npm i --no-save --package-lock=false playwright
 * and npm run dev / start at localhost. No remote URLs, cookies or user data.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const base="http://127.0.0.1:3000";
const out=resolve("artifacts/runtime-demo");
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const page=await browser.newPage({
  viewport:{width:1440,height:900},deviceScaleFactor:1,
  reducedMotion:"reduce",colorScheme:"dark",
});
async function screenshot(n,label){
  await page.waitForTimeout(300);
  const path=resolve(out,"shot-"+String(n).padStart(2,"0")+".png");
  await page.screenshot({path,animations:"disabled"});
  console.log(label+": "+path);
}
try {
  await page.goto(base,{waitUntil:"networkidle",timeout:30000});
  await page.getByRole("button",{name:"EN",exact:true}).click();
  await screenshot(0,"Studio hero");
  await page.locator("#simulation").scrollIntoViewIfNeeded();
  await screenshot(1,"Educational twin");
  // Input changes should remain visibly hypothetical, not presented
  // as experimentally validated.
  const scenario=page.locator("select.scenario-select");
  if(await scenario.count())await scenario.selectOption({index:3});
  await screenshot(2,"Illustrative scenario change");
  await page.locator(".pbe-panel").scrollIntoViewIfNeeded();
  await page.locator(".pbe-panel button").first().click();
  await page.locator(".pbe-results").waitFor({timeout:10000});
  await screenshot(3,"Synthetic PBE software audit");
  await page.locator(".source-gallery-panel").scrollIntoViewIfNeeded();
  await screenshot(4,"Attributed external data gallery");
  await page.locator(".source-sample-card button").first().click();
  await page.locator(".source-readout").waitFor({timeout:10000});
  await screenshot(5,"Published viewer-derived observations");
  const manifest={
    isRuntimeCapture:true,
    base:"localhost_only",
    capturedAt:new Date().toISOString(),
    scenes:["Studio hero","Educational twin","Illustrative parameter change",
      "Synthetic PBE numerical audit","Attributed source catalog",
      "Published source-native solubility curve"],
    scientificLimitations:[
      "Educational simulation is not calibrated to experimental equipment.",
      "PBE parameters and distributions are synthetic, not verified physical predictions.",
      "BigSolDB source values are from a secondary compilation, not independent raw lab evidence.",
    ],
  };
  await writeFile(resolve(out,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
}finally{await browser.close();}
