import { ImageResponse } from 'next/og';

export const alt = 'ChronoSleep — See your schedule gap. Align your week.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Brand card for social sharing (static text only — never user data). */
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 80,
          background: 'linear-gradient(135deg, #0b1220 0%, #164e63 55%, #4338ca 100%)',
          color: '#fff',
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 700, opacity: 0.9 }}>ChronoSleep</div>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, marginTop: 24 }}>See your schedule gap.</div>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, color: '#67e8f9' }}>Align your week.</div>
        <div style={{ fontSize: 30, marginTop: 36, opacity: 0.85 }}>Social jetlag calculator · Entiende tu desfase · Entenda seu descompasso</div>
      </div>
    ),
    size,
  );
}
