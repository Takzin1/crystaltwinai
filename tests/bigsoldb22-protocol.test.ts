import assert from "node:assert/strict";
import test from "node:test";
import {auditBigSolDB22SourceProtocol,BIGSOLDB22_PROTOCOL_VERSION} from "../src/lib/bigsoldb22-protocol";

const methodHeader="doi,solubility_type,method,equilibration_h,settling_h,agitation_type,agitation_rpm,temperature_control,pressure_kPa,replicates";
const formHeader="doi,CAS,SMILES_Solute,solid_form_label,solute_purity,purity_method,solute_supplier,solid_phase_control,phase_change_observed,solid_form,melting_point_K,melting_point_method,decomposition_temperature_K,fusion_enthalpy_kJ_mol,fusion_enthalpy_source";
const doi="10.1007/s10953-012-9951-z";
const select={doi,cas:"110-15-6",smilesSolute:"O=C(O)CCC(=O)O",solidFormLabel:"Form I"};
const method=(type="equilibrium",analytical="gravimetric_static",reps="3")=>
  methodHeader+"\n"+[doi,type,analytical,"24","4","stirring","250","thermostated","101.3",reps].join(",")+"\n";
const solid=(phase="none",characterization="xrd_before_after",cas=select.cas)=>
  formHeader+"\n"+[doi,cas,select.smilesSolute,select.solidFormLabel,
    "0.999","HPLC","supplier",characterization,phase,"polymorph","459.1","DSC","","","not_reported"].join(",")+"\n";
test("exact joint evidence preserves method and solid form, but refuses experimental certification",()=>{
 const r=auditBigSolDB22SourceProtocol(method(),solid(),select);
 assert.equal(r.version,BIGSOLDB22_PROTOCOL_VERSION);
 assert.equal(r.publishedMethod.method,"gravimetric_static");
 assert.equal(r.publishedMethod.equilibrationHours,24);
 assert.equal(r.publishedMethod.reportedReplicates,3);
 assert.equal(r.reportedForm.solidPhaseControl,"xrd_before_after");
 assert.equal(r.comparabilityGate.eligibleForFurtherReview,true);
 assert.equal(r.comparabilityGate.certifiedForPhysicalModelValidation,false);
 assert.equal(r.comparabilityGate.originalLabDataAuthenticated,false);
 assert.equal(r.comparabilityGate.auxiliaryCsvBytesAuthenticated,false);
 assert.match(r.unitWarning,/pure solvent, not solution/);
 assert.deepEqual(r.comparabilityGate.flags,[]);
});
test("phase transition and uncharacterized samples are not marked comparable",()=>{
 const changed=auditBigSolDB22SourceProtocol(method(),solid("polymorph_transition"),select);
 assert.equal(changed.comparabilityGate.eligibleForFurtherReview,false);
 assert.ok(changed.comparabilityGate.flags.includes("SOLID_PHASE_NOT_CONFIRMED_STABLE"));
 const uncharacterized=auditBigSolDB22SourceProtocol(method(),solid("not_checked","none"),select);
 assert.equal(uncharacterized.comparabilityGate.eligibleForFurtherReview,false);
 assert.ok(uncharacterized.comparabilityGate.flags.includes("LIMITED_SOLID_PHASE_CHARACTERIZATION"));
 const nonEquilibrium=auditBigSolDB22SourceProtocol(method("dynamic","laser_dynamic"),solid(),select);
 assert.equal(nonEquilibrium.comparabilityGate.eligibleForFurtherReview,false);
 assert.ok(nonEquilibrium.comparabilityGate.flags.includes("NOT_CONFIRMED_EQUILIBRIUM"));
});
test("missing repeats and equilibration time explicitly flagged without invented values",()=>{
 const meth=method("equilibrium","hplc_static","").replace(",24,4,",",,4,");
 const r=auditBigSolDB22SourceProtocol(meth,solid(),select);
 assert.equal(r.publishedMethod.reportedReplicates,null);
 assert.equal(r.publishedMethod.equilibrationHours,null);
 assert.ok(r.comparabilityGate.flags.includes("REPLICATES_UNSPECIFIED"));
 assert.ok(r.comparabilityGate.flags.includes("EQUILIBRATION_TIME_UNSPECIFIED"));
});
test("companion table selection refuses malformed joins, schema and metadata",()=>{
 assert.throws(()=>auditBigSolDB22SourceProtocol(method(),solid(),{...select,doi:"bad"}),/DOI/);
 assert.throws(()=>auditBigSolDB22SourceProtocol(method(),solid(),{...select,cas:"x"}),/Ambiguous or missing/);
 assert.throws(()=>auditBigSolDB22SourceProtocol(method(),solid(),{...select,smilesSolute:"?"}),/Ambiguous or missing/);
 assert.throws(()=>auditBigSolDB22SourceProtocol(method(),solid(),{...select,solidFormLabel:"Form II"}),/Ambiguous or missing/);
 assert.throws(()=>auditBigSolDB22SourceProtocol(method()+method().split("\n")[1]+"\n",solid(),select),/Exactly one method/);
 assert.throws(()=>auditBigSolDB22SourceProtocol(method(),solid()+solid().split("\n")[1]+"\n",select),/Ambiguous or missing/);
 assert.throws(()=>auditBigSolDB22SourceProtocol(methodHeader.replace("replicates","n_replicates")+"\n"+method().split("\n")[1],solid(),select),/exact official header/);
 assert.throws(()=>auditBigSolDB22SourceProtocol(method(),solid().replace("solid_phase_control","checked"),select),/exact official header/);
 assert.throws(()=>auditBigSolDB22SourceProtocol(method("equilibrium","hplc_static","3.5"),solid(),select),/Replicates must be an integer/);
 assert.throws(()=>auditBigSolDB22SourceProtocol(method(),solid().replace("0.999","1.2"),select),/Purity must be/);
 assert.throws(()=>auditBigSolDB22SourceProtocol(method(),solid(),{...select,solidFormLabel:""}),/Explicit CAS/);
});
