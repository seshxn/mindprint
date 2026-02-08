import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import QRCode from 'qrcode';
import {
  getCyberpunkPalette,
} from '@/lib/certificate';
import { getCertificateRecord, verifyCertificatePayload } from '@/lib/certificate-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WIDTH = 1200;
const HEIGHT = 630;
const QR_IMAGE_SIZE = 168;

const formatIssuedAt = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
    date.getUTCDate()
  ).padStart(2, '0')} ${String(date.getUTCHours()).padStart(2, '0')}:${String(
    date.getUTCMinutes()
  ).padStart(2, '0')} UTC`;
};

const toSparkBars = (values: number[]) => {
  const source = values.length ? values.slice(0, 18) : [2, 4, 6, 5, 7, 3, 8, 4, 2];
  const max = Math.max(...source, 1);
  return source.map((v) => Math.max(8, Math.round((v / max) * 90)));
};

const safeGetCertificateRecord = async (id: string) => {
  try {
    return await getCertificateRecord(id);
  } catch (error) {
    console.error('[api/og] Failed to load certificate record from database:', error);
    return null;
  }
};

export const GET = async (request: NextRequest) => {
  try {
    const url = new URL(request.url);
    const id = (url.searchParams.get('id') || '').trim();
    if (!id) {
      throw new Error('Missing certificate id for trusted OG rendering.');
    }

    const payload = await safeGetCertificateRecord(id);
    if (!payload) {
      throw new Error('Certificate not found in trusted store.');
    }

    const verification = await verifyCertificatePayload(payload);
    if (!verification.isValid) {
      throw new Error(`Certificate verification failed: ${verification.reason || 'invalid proof.'}`);
    }

    const palette = getCyberpunkPalette(payload.seed);

    const origin = url.searchParams.get('origin') || url.origin || 'https://mindprint.app';
    const verifyUrl = `${origin}/verify/${encodeURIComponent(payload.id)}`;
    const verifyHint = `${origin}/verify/${payload.id}`;

    const qrCodeDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: QR_IMAGE_SIZE,
      margin: 1,
      color: {
        dark: '#020617',
        light: '#FFFFFF',
      },
    });
    const bars = toSparkBars(payload.sparkline);
    const excerpt = payload.text.length > 260 ? `${payload.text.slice(0, 257)}...` : payload.text;
    const idLine = `ID ${payload.id} | Issued ${formatIssuedAt(payload.issuedAt)}`;

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'row',
            backgroundColor: '#060B1F',
            color: '#E5EDFF',
            fontFamily: 'Arial',
            padding: 32,
          }}
        >
          <div
            style={{
              width: 860,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#0A132F',
              border: `2px solid ${palette.border}`,
              borderRadius: 20,
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', color: '#7DD3FC', fontSize: 18, letterSpacing: 3 }}>
              MINDPRINT CERTIFICATE
            </div>
            <div style={{ display: 'flex', marginTop: 10, fontSize: 40, fontWeight: 700 }}>{payload.title}</div>
            <div style={{ display: 'flex', marginTop: 8, fontSize: 24, color: '#BFDBFE' }}>{payload.subtitle}</div>
            <div style={{ display: 'flex', marginTop: 10, fontSize: 16, color: '#C7D2FE' }}>{idLine}</div>

            <div
              style={{
                display: 'flex',
                marginTop: 18,
                padding: 14,
                borderRadius: 12,
                border: '1px solid #334155',
                backgroundColor: '#0D173A',
                fontSize: 22,
                lineHeight: 1.35,
              }}
            >
              {excerpt}
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                marginTop: 18,
                padding: 14,
                borderRadius: 12,
                border: '1px solid #155E75',
                backgroundColor: '#08122D',
              }}
            >
              <div style={{ display: 'flex', fontSize: 14, color: '#67E8F9', letterSpacing: 1.4 }}>
                TYPING VELOCITY SPARKLINE
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  marginTop: 10,
                  height: 120,
                  borderRadius: 8,
                  border: '1px solid #1E3A8A',
                  backgroundColor: '#020617',
                  padding: 8,
                }}
              >
                {bars.map((h, i) => (
                  <div
                    key={`${h}-${i}`}
                    style={{
                      display: 'flex',
                      width: 16,
                      height: h,
                      borderRadius: 99,
                      marginRight: i === bars.length - 1 ? 0 : 6,
                      backgroundColor: i % 3 === 0 ? '#22D3EE' : i % 3 === 1 ? '#A78BFA' : '#F472B6',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              marginLeft: 20,
              width: 256,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              backgroundColor: '#0A132F',
              border: `2px solid ${palette.border}`,
              borderRadius: 20,
              padding: 18,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', color: '#93C5FD', fontSize: 15, letterSpacing: 1.2 }}>HUMAN SCORE</div>
              <div style={{ display: 'flex', marginTop: 8, fontSize: 92, fontWeight: 700, lineHeight: 1 }}>
                {payload.score}
              </div>
              <div style={{ display: 'flex', marginTop: 6, fontSize: 14, color: '#C7D2FE' }}>Behavior verified</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', fontSize: 13, color: '#A5F3FC', letterSpacing: 1.2 }}>QR VERIFY</div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  marginTop: 10,
                  width: 188,
                  height: 188,
                  border: '1px solid #7DD3FC',
                  borderRadius: 10,
                  backgroundColor: '#FFFFFF',
                  padding: 10,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrCodeDataUrl}
                  alt="Verification QR code"
                  width={QR_IMAGE_SIZE}
                  height={QR_IMAGE_SIZE}
                  style={{
                    display: 'flex',
                    width: QR_IMAGE_SIZE,
                    height: QR_IMAGE_SIZE,
                  }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  marginTop: 8,
                  fontSize: 10,
                  color: '#C4B5FD',
                  textAlign: 'center',
                  maxWidth: 220,
                  lineHeight: 1.2,
                }}
              >
                {verifyHint}
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: WIDTH,
        height: HEIGHT,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown OG rendering error';
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#050816',
            color: '#E5E7EB',
            fontFamily: 'Arial',
          }}
        >
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 700 }}>Mindprint Certificate</div>
          <div style={{ display: 'flex', marginTop: 10, fontSize: 18, color: '#7DD3FC' }}>OG render fallback</div>
          <div style={{ display: 'flex', marginTop: 12, fontSize: 14, maxWidth: 1000, textAlign: 'center' }}>
            {message}
          </div>
        </div>
      ),
      {
        width: WIDTH,
        height: HEIGHT,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  }
};
