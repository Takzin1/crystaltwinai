/** Expand original user-uploaded Strathclyde induction-time evidence.
 * Never invent physical time units or claim this project's model predicted it.
 */
import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import {dirname} from "node:path";
import {gunzipSync} from "node:zlib";
import {createHash} from "node:crypto";
import {INDUCTION_EVIDENCE,validateInductionSource} from "../src/lib/induction-source";

export const INDUCTION_DATA_PATH="public/examples/induction-times-source-v1.json.gz.base64";
export function loadInductionSource(){
 const encoded=readFileSync(INDUCTION_DATA_PATH,"utf8").trim();
 if(encoded.length<200||encoded.length>16000||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
  throw new Error("Corrupt original induction dataset encoding.");
 const expanded=gunzipSync(Buffer.from(encoded,"base64"),{maxOutputLength:250000});
 const sourceSha256=createHash("sha256").update(expanded).digest("hex");
 if(sourceSha256!==INDUCTION_EVIDENCE.jsonSha256)
  throw new Error("Induction evidence SHA-256 mismatch.");
 const source=validateInductionSource(JSON.parse(expanded.toString("utf8")));
 return {source,sourceSha256};
}
function main(){
 const {source,sourceSha256}=loadInductionSource();
 const i=process.argv.indexOf("--out");
 if(i>=0){
  const path=process.argv[i+1];
  if(!path||path.startsWith("-"))throw new Error("Missing --out path");
  mkdirSync(dirname(path),{recursive:true});
  writeFileSync(path,JSON.stringify(source,null,2)+"\n","utf8");
 }
 console.log(JSON.stringify({
  sourceSha256,sourceXlsxSha256:source.sourceSha256,
  cases:source.data.length,
  train:source.data.filter(x=>x.partition==="train").length,
  heldout:source.heldoutSourceCdf.length,
  measurements:source.data.reduce((sum,x)=>sum+x.inductionTimesSource.length,0),
  models:"published/source-reported only",
  verifiedOriginalLaboratoryUnits:false,physicalPbePredictionsValidated:false,
 },null,2));
}
if(process.argv[1]?.replaceAll("\\","/").endsWith("/expand-induction-source.ts")){
 try{main();}catch(e){console.error(e instanceof Error?e.message:String(e));process.exitCode=1;}
}