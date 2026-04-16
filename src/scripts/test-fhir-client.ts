/*
 * 更新時間：2026-04-14 12:00
 * 作者：CDS Service
 * 摘要：驗證 fhirClient 與本機 HAPI FHIR
 */
import {
  getLatestCreatinine,
  getLatestEGFR,
  getObservationsByCode,
  getPatient,
} from '../fhir/fhirClient.js';

async function runTests(): Promise<void> {
  const targetPatientId = 'patient-ckd-001';
  console.log(`--- Starting FHIR Client Test for Patient: ${targetPatientId} ---`);

  try {
    const patient = await getPatient(targetPatientId);
    const name0 = Array.isArray(patient.name)
      ? (patient.name[0] as { family?: string; given?: string[] })
      : undefined;
    console.log(
      'Patient Found:',
      name0?.family,
      name0?.given?.join(' ') ?? '',
    );

    const egfr = await getLatestEGFR(targetPatientId);
    if (egfr) {
      const vq = egfr.valueQuantity as { value?: number; unit?: string } | undefined;
      console.log(
        'Latest eGFR:',
        vq?.value,
        vq?.unit,
        `(Date: ${(egfr as { effectiveDateTime?: string }).effectiveDateTime ?? ''})`,
      );
    } else {
      console.log('No eGFR record found.');
    }

    const crea = await getLatestCreatinine(targetPatientId);
    if (crea) {
      const vq = crea.valueQuantity as { value?: number; unit?: string } | undefined;
      console.log('Latest Creatinine:', vq?.value, vq?.unit);
    } else {
      console.log('No Creatinine record found.');
    }

    const obsList = await getObservationsByCode(targetPatientId, '62238-1', 5);
    const count = Array.isArray(obsList)
      ? obsList.length
      : obsList
        ? 1
        : 0;
    console.log(`Observation List count: ${count}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Test Failed:', msg);
    process.exitCode = 1;
  }
}

void runTests();
