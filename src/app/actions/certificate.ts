'use server';

import { ValidationStatus } from '@/lib/telemetry';
import { createCertificateRecord } from '@/lib/certificate-store';

interface CreateCertificateActionInput {
  title: string;
  subtitle: string;
  text: string;
  score: number;
  issuedAt: string;
  seed: string;
  sparkline: number[];
  validationStatus?: ValidationStatus;
}

export const createCertificate = async (input: CreateCertificateActionInput) => {
  const certificate = await createCertificateRecord(input);
  return { id: certificate.id };
};

