/** Expand the lossless public source-native bundle with Node.js.
 * No XLSX parsing at runtime, no physical kinetics calibration or claimed lab replication.
 */
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { gunzipSync } from "node:zlib";
import { STRUVITE_SOURCE,validateStruviteBundle } from "../src/lib/struvite-source";

export const STRUVITE_BUNDLE_PATH="public/examples/struvite-poiseuille-source-v1.json.gz.base64";
export function expandStruviteBundle(){
  const encoded=readFileSync(STRUVITE_BUNDLE_PATH,"utf8").trim();
  if(encoded.length>25000||encoded.length<1000||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
    throw new Error("Compressed public evidence has invalid encoding.");
  const inflated=gunzipSync(Buffer.from(encoded,"base64"),{maxOutputLength:200000});
  const observed=createHash("sha256").update(inflated).digest("hex");
  if(observed!==STRUVITE_SOURCE.normalizedJsonSha256)
    throw new Error("Normalized original workbook evidence SHA-256 mismatch.");
  const data=validateStruviteBundle(JSON.parse(inflated.toString("utf8")));
  return {data,jsonText:inflated.toString("utf8"),sha256:observed};
}
function main(){
  const {data,jsonText,sha256}=expandStruviteBundle();
  const index=process.argv.indexOf("--out");
  if(index!==-1){
    const path=process.argv[index+1];
    if(!path||path.startsWith("-"))throw new Error("--out needs a path");
    mkdirSync(dirname(path),{recursive:true});
    writeFileSync(path,JSON.stringify(data,null,2)+"\n",{flag:"w"});
  }
  const count=(values:(number|null)[])=>values.filter(x=>x!==null).length;
  console.log(JSON.stringify({
    schema:data.schema,sourceSheet:data.originalSheet,
    zipSha256:data.sourceZipSha256,xlsxSha256:data.sourceXlsxSha256,
    normalizedSourceSha256:sha256,sizeBins:data.sizeUm.length,
    conditions:["0.8","1.0","1.4"],
    observedPsdGroups:["rMeasured","ijMeasuredValidation"],
    simulatedPsdGroups:["rOptimizedModel","ijGalbraithModel"],
    phosphate:{
      measuredPointsBySI:{
        "0.8":count(data.phosphate.rMeasured.bySI["0.8"]),
        "1.0":count(data.phosphate.rMeasured.bySI["1.0"]),
        "1.4":count(data.phosphate.rMeasured.bySI["1.4"]),
      },
      modelTimeBins:15,
    },
    noKineticFittingPerformed:true,
  },null,2));
}
if(process.argv[1]?.replaceAll("\\","/").endsWith("/expand-struvite-evidence.ts")){
  try{main();}catch(e){console.error(e instanceof Error?e.message:String(e));process.exitCode=1;}
}
