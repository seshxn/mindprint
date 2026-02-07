import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import {
  buildCertificateSearchParams,
  getCyberpunkPalette,
  parseCertificatePayload,
} from '@/lib/certificate';
import { getCertificateRecord } from '@/lib/certificate-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WIDTH = 1200;
const HEIGHT = 630;
const QR_SIZE = 25;

const formatIssuedAt = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
    date.getUTCDate()
  ).padStart(2, '0')} ${String(date.getUTCHours()).padStart(2, '0')}:${String(
    date.getUTCMinutes()
  ).padStart(2, '0')} UTC`;
};

const hashString = (input: string) => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
};

const inFinder = (row: number, col: number, r0: number, c0: number) => {
  const r = row - r0;
  const c = col - c0;
  if (r < 0 || c < 0 || r > 6 || c > 6) return false;
  if (r === 0 || r === 6 || c === 0 || c === 6) return true;
  return r >= 2 && r <= 4 && c >= 2 && c <= 4;
};

const finderZone = (row: number, col: number) =>
  inFinder(row, col, 0, 0) || inFinder(row, col, 0, QR_SIZE - 7) || inFinder(row, col, QR_SIZE - 7, 0);

const buildQrMatrix = (seed: string) => {
  const matrix: boolean[][] = [];
  const base = hashString(seed);
  for (let row = 0; row < QR_SIZE; row += 1) {
    const cells: boolean[] = [];
    for (let col = 0; col < QR_SIZE; col += 1) {
      if (finderZone(row, col)) {
        cells.push(true);
        continue;
      }
      const h = hashString(`${base}:${row}:${col}`);
      cells.push(((h >> ((row + col) % 16)) & 1) === 1);
    }
    matrix.push(cells);
  }
  return matrix;
};

const toSparkBars = (values: number[]) => {
  const source = values.length ? values.slice(0, 18) : [2, 4, 6, 5, 7, 3, 8, 4, 2];
  const max = Math.max(...source, 1);
  return source.map((v) => Math.max(8, Math.round((v / max) * 90)));
};

export const GET = async (request: NextRequest) => {
  try {
    const url = new URL(request.url);
    const id = (url.searchParams.get('id') || '').trim();
    const dbPayload = id ? await getCertificateRecord(id) : null;
    const payload = dbPayload ?? parseCertificatePayload(url.searchParams);
    const palette = getCyberpunkPalette(payload.seed);

    const origin = url.searchParams.get('origin') || url.origin || 'https://mindprint.app';
    const verifyParams = buildCertificateSearchParams(payload, false);
    const verifyUrl = dbPayload
      ? `${origin}/verify/${encodeURIComponent(payload.id)}`
      : `${origin}/verify/${encodeURIComponent(payload.id)}?${verifyParams.toString()}`;
    const verifyHint = `${origin}/verify/${payload.id}`;

    const matrix = buildQrMatrix(verifyUrl);
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
                {matrix.map((row, rowIndex) => (
                  <div key={`r-${rowIndex}`} style={{ display: 'flex' }}>
                    {row.map((cell, colIndex) => (
                      <div
                        key={`c-${rowIndex}-${colIndex}`}
                        style={{
                          display: 'flex',
                          width: 6,
                          height: 6,
                          backgroundColor: cell ? '#020617' : '#FFFFFF',
                        }}
                      />
                    ))}
                  </div>
                ))}
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
