"use server";

import { ValidationStatus } from "@/lib/telemetry";
import { createCertificateRecord } from "@/lib/certificate-store";
import { ReplayOperation } from "@/lib/certificate";

interface CreateCertificateActionInput {
  title: string;
  subtitle: string;
  text: string;
  score: number;
  issuedAt: string;
  seed: string;
  sparkline: number[];
  replay: ReplayOperation[];
  validationStatus?: ValidationStatus;
  riskScore?: number;
  confidence?: number;
}

export const createCertificate = async (
  input: CreateCertificateActionInput,
) => {
  const certificate = await createCertificateRecord(input);
  return { id: certificate.id };
};
