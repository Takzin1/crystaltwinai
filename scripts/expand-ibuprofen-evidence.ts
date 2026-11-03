/** Offline reproducibility tool for the source-native ibuprofen size distributions.
 * Exports rows without silently converting bin-normalized percentages into
 * number/volume/intensity PSD or claiming any crystal kinetic parameters.
 */
import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import {dirname} from "node:path";
import {gunzipSync} from "node:zlib";
import {createHash} from "node:crypto";
import {
 IBUPROFEN_SOURCE,validateIbuprofenSource,ibuprofenCurveForCondition
} from "../src/lib/ibuprofen-source";

export const IBUPROFEN_BUNDLE_PATH=
 "public/examples/ibuprofen-psd-sparse-v1.json.gz.base64";
export function loadIbuprofenSource(){
 const encoded=readFileSync(IBUPROFEN_BUNDLE_PATH,"utf8").trim();
 if(encoded.length<1000||encoded.length>25000||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
    throw new Error("Unexpected source bundle encoding.");
 const decoded=gunzipSync(Buffer.from(encoded,"base64"),{maxOutputLength:500000});
 const sha=createHash("sha256").update(decoded).digest("hex");
 if(sha!==IBUPROFEN_SOURCE.normalizedSparseJsonSha256)
    throw new Error("Ibuprofen numeric-transcription SHA-256 does not match source.");
 const source=validateIbuprofenSource(JSON.parse(decoded.toString("utf8")));
 return {source,normalizedJsonSha256:sha};
}
function main(){
 const {source,normalizedJsonSha256}=loadIbuprofenSource();
 const index=process.argv.indexOf("--out");
 if(index>=0){
   const path=process.argv[index+1];
   if(!path||path.startsWith("-"))throw new Error("--out path missing");
   const expanded={
    schema:"crystaltwin-ibuprofen-expanded-observed-psd/1",
    sourceUrl:source.sourceUrl,
    sourceZipSha256:source.sourceZipSha256,
    sourceXlsxSha256:source.sourceXlsxSha256,
    particleDiameterUnit:source.particleDiameterUnit,
    sourceReportedBasis:source.reportedDistributionBasis,
    sizeNm:source.sizeNm,
    conditions:source.conditions.map(c=>({
      ...c,reportedPercentByBin:ibuprofenCurveForCondition(source,c.id).distribution
    })),
    researchClaims:{physicalPbeValidated:false,numberOrVolumeWeighted:false,
      trueIndependentReplicateCountKnown:false},
   };
   mkdirSync(dirname(path),{recursive:true});
   writeFileSync(path,JSON.stringify(expanded,null,2)+"\n","utf8");
 }
 console.log(JSON.stringify({
   source:source.schema,originalSourceZipSha256:source.sourceZipSha256,
   sourceWorkbookSha256:source.sourceXlsxSha256,normalizedJsonSha256,
   sizeBins:source.sizeNm.length,conditions:source.conditions.length,
   uniqueDistributionTraces:source.curves.length,
   exactOriginalMissingCells:source.curves.reduce((n,c)=>n+c.missing.length,0),
   sourceBasis:source.reportedDistributionBasis,
   physicalModelValidation:false,
 },null,2));
}
if(process.argv[1]?.replaceAll("\\","/").endsWith("/expand-ibuprofen-evidence.ts")){
  try{main();}catch(err){
   console.error(err instanceof Error?err.message:String(err));process.exitCode=1;
  }
}