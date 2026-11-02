/**
 * Explicit local BigSolDB v2.1 CSV -> Research Schema v2 converter.
 * Copyright 2026 CrystalTwinAI contributors.
 * BigSolDB v2.1 is a separate CC BY 4.0 work by Krasnov et al.
 * Never automatically download, redistribute the full dataset, or mix
 * unlike solute, solvent, article or concentration bases.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { parseResearchDataset } from "../src/lib/research-schema";

export const BIGSOLDB21_SOURCE = {
  repository:"levakrasnovs/mcp-bigsoldb",
  commit:"a29e91061dc2d3d543343c5cd2cdd5e539165915",
  filename:"BigSolDBv2_1.csv",
  sizeBytes:19675205,
  gitBlobSha1:"4a6f2af6819507bae9cfd690e927fe349927d8c5",
} as const;
export const BIGSOLDB21_ORIGINAL_URL =
  "https://raw.githubusercontent.com/levakrasnovs/mcp-bigsoldb/a29e91061dc2d3d543343c5cd2cdd5e539165915/BigSolDBv2_1.csv";

/** Verify a selected CSV matches the author's exact Git blob, then fingerprint with SHA-256. */
export function verifyBigSolDB21Blob(bytes: Uint8Array): string {
  if (bytes.byteLength !== BIGSOLDB21_SOURCE.sizeBytes) {
    throw new Error("Pinned BigSolDB v2.1 source file byte length mismatch.");
  }
  const gitHash=createHash("sha1").update("blob "+bytes.byteLength+"\\0")
    .update(bytes).digest("hex");
  if (gitHash !== BIGSOLDB21_SOURCE.gitBlobSha1) {
    throw new Error("Pinned BigSolDB v2.1 Git blob SHA-1 mismatch.");
  }
  return createHash("sha256").update(bytes).digest("hex");
}
const COLUMNS=[
  "SMILES_Solute","Temperature_K","Solvent","SMILES_Solvent",
  "Solubility(mole_fraction)","Solubility(mol/L)","LogS(mol/L)",
  "Compound_Name","CAS","PubChem_CID","FDA_Approved","Source",
] as const;
const MAX_CSV_BYTES=32*1024*1024;
const DOI=/^10\.\d{4,9}\/\S+$/i;

/** Basic RFC 4180 double-quote aware CSV parser, no unbounded field splitting. */
export function readCsvTable(content:string) {
  if(content.length>MAX_CSV_BYTES)throw Error("CSV exceeds 32 MiB.");
  const rows:string[][]=[];
  let record:string[]=[],current="",insideQuotes=false;
  for(let i=0;i<content.length;i++){
    const ch=content[i];
    if(ch==='"'){
      if(insideQuotes&&content[i+1]==='"'){current+='"';i++;}
      else if(insideQuotes){insideQuotes=false;}
      else if(current===""){insideQuotes=true;}
      else throw Error("Unexpected CSV quote.");
    }else if(ch===","&&!insideQuotes){
      record.push(current);current="";
    }else if((ch==="\n"||ch==="\r")&&!insideQuotes){
      if(ch==="\r"&&content[i+1]==="\n")i++;
      record.push(current);
      if(record.some(s=>s.trim()))rows.push(record);
      record=[];current="";
    }else{current+=ch;}
    if(current.length>4096)throw Error("CSV field exceeds 4096 characters.");
    if(rows.length>150000)throw Error("CSV row count exceeds 150000.");
  }
  if(insideQuotes)throw Error("Unclosed CSV quote.");
  if(current||record.length){record.push(current);rows.push(record);}
  if(rows.length===0)throw Error("Empty CSV.");
  if(rows[0][0].charCodeAt(0)===65279)rows[0][0]=rows[0][0].slice(1);
  if(rows.some(row=>row.length!==rows[0].length))throw Error("Inconsistent CSV row length.");
  return rows;
}

export interface Selection {compound:string;solvent:string;doi:string}
export function convertBigSolDB21(csv:string,selection:Selection,upstreamSha256:string) {
  if(!DOI.test(selection.doi)||!selection.compound||!selection.solvent) {
    throw Error("Exact compound, solvent and DOI are required.");
  }
  if(!/^[a-f0-9]{64}$/i.test(upstreamSha256))throw Error("Invalid source sha256.");
  const records=readCsvTable(csv);
  const header=records.shift()!;
  if(header.length!==COLUMNS.length || COLUMNS.some((name,i)=>header[i]!==name)) {
    throw Error("Not the declared BigSolDB v2.1 12-column schema.");
  }
  const matches=records.filter(row=>
    row[7]===selection.compound&&row[2]===selection.solvent&&
    row[11].toLowerCase()===selection.doi.toLowerCase());
  if(matches.length<5||matches.length>1000)throw Error("Selection needs 5–1000 records.");
  const smiles=new Set(matches.map(row=>row[0]));
  const solventSmiles=new Set(matches.map(row=>row[3]));
  if(smiles.size!==1||solventSmiles.size!==1) {
    throw Error("Mixed solute or solvent chemical identities.");
  }
  const measurements=matches.map(row=>{
    const temperature=Number(row[1]);
    const solubility=Number(row[4]);
    if(!row[1]||!row[4]||!Number.isFinite(temperature)||temperature<=0||
       !Number.isFinite(solubility)||solubility<=0||solubility>=1){
      throw Error("Invalid native K or mole fraction.");
    }
    return {temperature,solubility};
  }).sort((a,b)=>a.temperature-b.temperature);
  for(let i=1;i<measurements.length;i++){
    if(measurements[i].temperature-measurements[i-1].temperature<1e-9)
      throw Error("Duplicate or nearly identical temperatures; don't mix replicates.");
  }
  const result={
    schemaVersion:2,
    metadata:{
      title:`BigSolDB v2.1: ${selection.compound} / ${selection.solvent} (article: ${selection.doi})`,
      sourceUrl:BIGSOLDB21_ORIGINAL_URL,
      doi:selection.doi,
      authors:["Krasnov, Lev","Malikov, Dmitry","Kiseleva, Marina",
        "Tatarin, Sergei","Sosnin, Sergey","Bezzubov, Stanislav"],
      license:"CC BY 4.0 (BigSolDB v2.1 compilation; original article rights not verified)",
      provenance:"measured",
      experimentMode:"equilibrium_curve",
      material:selection.compound,
      solvent:selection.solvent,
      processType:"published experimental equilibrium solubility (compilation)",
      concentrationBasis:"mole_fraction",
      temperatureSource:"unknown",
      measurementMethod:"underlying article method not independently verified",
      units:{temperature:"K",solubility:"mole_fraction"},
      sourceFileSha256:upstreamSha256,
      transformations:[{
        operation:"source_mapping",
        software:"CrystalTwinAI BigSolDBv2.1 converter",
        version:"1.0",
        inputSha256:upstreamSha256,
        notes:"Exact DOI, compound, solvent and SMILES grouping; source-native K/mole fraction only.",
      }],
      notes:"BigSolDB compilation reports measurements; original experiment not independently authenticated. Authors refer to dataset compilers, not original paper. Solid form and replicate variance unspecified. Source SHA-256 binds the full BigSolDBv2.1 CSV; the resulting JSON is a transformed subset. Do not project into educational kinetic simulator.",
    },
    measurements,
  };
  return parseResearchDataset(JSON.stringify(result));
}
function execute(){
  const args=process.argv.slice(2);
  const value=(flag:string)=>{
    const pos=args.indexOf(flag);
    if(pos<0||!args[pos+1])throw Error("Missing "+flag);
    return args[pos+1];
  };
  const path=value("--source");
  const data=readFileSync(path);
  if(data.byteLength>MAX_CSV_BYTES)throw Error("Full CSV too large.");
  const checksum=verifyBigSolDB21Blob(data);
  const selection={compound:value("--compound"),solvent:value("--solvent"),doi:value("--doi")};
  const converted=convertBigSolDB21(new TextDecoder("utf-8",{fatal:true}).decode(data),selection,checksum);
  const serialized=JSON.stringify(converted,null,2)+"\n";
  if(Buffer.byteLength(serialized)>1024*1024)throw Error("Research JSON exceeds 1 MiB.");
  writeFileSync(value("--out"),serialized,{flag:"wx"});
  process.stdout.write(`Converted ${converted.measurements.length} rows with source SHA-256 ${checksum}\n`);
}
if(process.argv[1]?.replaceAll("\\","/").endsWith("/import-bigsoldb21.ts")){
  try{execute();}catch(error){console.error(error instanceof Error?error.message:error);process.exitCode=1;}
}
