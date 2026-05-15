'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from '@/app/hooks/useTheme';

export default function Home() {
  const [theme, toggleTheme] = useTheme();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700&display=swap');

        .gg-home-root {
          --bg: linear-gradient(135deg, #1a0b2e 0%, #2d1b4e 50%, #1a0b2e 100%);
          --text: #ffffff;
          --subtitle: #c77dff;
          --card-bg: rgba(255,255,255,0.08);
          --card-border: rgba(199,125,255,0.3);
          --card-desc: #c77dff;
          --toggle-bg: rgba(255,255,255,0.1);
          --toggle-hover: rgba(255,255,255,0.2);
          --toggle-color: #c77dff;
        }

        .gg-home-root.light {
          --bg: linear-gradient(135deg, #fdf4ff 0%, #f0e6ff 50%, #fdf4ff 100%);
          --text: #2d1b4e;
          --subtitle: #7b2cbf;
          --card-bg: rgba(255,255,255,0.85);
          --card-border: rgba(157,78,221,0.25);
          --card-desc: #7b2cbf;
          --toggle-bg: rgba(157,78,221,0.1);
          --toggle-hover: rgba(157,78,221,0.18);
          --toggle-color: #7b2cbf;
        }

        .gg-home-root {
          font-family: 'Nunito', sans-serif;
          background: var(--bg);
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          padding: 20px;
          color: var(--text);
          transition: background 0.3s ease, color 0.3s ease;
        }

        .gg-home-topbar {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 0;
        }

        .gg-theme-toggle {
          background: var(--toggle-bg);
          border: 1px solid rgba(199,125,255,0.3);
          border-radius: 20px;
          padding: 8px 16px;
          color: var(--toggle-color);
          font-family: 'Nunito', sans-serif;
          font-weight: 700;
          font-size: 0.9em;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .gg-theme-toggle:hover {
          background: var(--toggle-hover);
        }

        .gg-home-inner {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          max-width: 600px;
          margin: 0 auto;
          padding: 40px 0;
        }

        .gg-logo {
          animation: gg-home-float 3s ease-in-out infinite;
          margin-bottom: 20px;
        }

        @keyframes gg-home-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }

        .gg-home-title {
          font-family: 'Fredoka One', cursive;
          font-size: 3em;
          background: linear-gradient(135deg, #ff6ec7 0%, #c77dff 50%, #9d4edd 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 12px;
        }

        .gg-home-subtitle {
          font-size: 1.15em;
          color: var(--subtitle);
          margin-bottom: 48px;
          opacity: 0.9;
        }

        .gg-tool-card {
          display: block;
          background: var(--card-bg);
          border: 2px solid var(--card-border);
          border-radius: 20px;
          padding: 32px;
          text-decoration: none;
          color: inherit;
          transition: all 0.3s ease;
          width: 100%;
        }

        .gg-tool-card:hover {
          background: var(--card-bg);
          border-color: #ff6ec7;
          transform: translateY(-6px);
          box-shadow: 0 12px 40px rgba(255,110,199,0.25);
        }

        .gg-tool-icon {
          font-size: 2.5em;
          margin-bottom: 12px;
          display: block;
        }

        .gg-tool-name {
          font-family: 'Fredoka One', cursive;
          font-size: 1.6em;
          color: #ff6ec7;
          margin-bottom: 8px;
        }

        .gg-tool-desc {
          color: var(--card-desc);
          font-size: 1em;
          opacity: 0.85;
          line-height: 1.6;
        }

        .gg-tool-cta {
          display: inline-block;
          margin-top: 20px;
          background: linear-gradient(135deg, #ff6ec7, #c77dff);
          color: white;
          border-radius: 25px;
          padding: 12px 28px;
          font-weight: 700;
          font-size: 0.95em;
          transition: box-shadow 0.3s ease;
        }

        .gg-tool-card:hover .gg-tool-cta {
          box-shadow: 0 6px 20px rgba(255,110,199,0.4);
        }
      `}</style>

      <div className={`gg-home-root${theme === 'light' ? ' light' : ''}`}>
        <div className="gg-home-topbar">
          <button className="gg-theme-toggle" onClick={toggleTheme}>
            {theme === 'dark' ? '☀️ Light mode' : '🌙 Dark mode'}
          </button>
        </div>

        <div className="gg-home-inner">
          <Image
            src="/ghostygals-logo.png"
            alt="Ghosty Gals"
            width={160}
            height={160}
            className="gg-logo"
            priority
          />
          <h1 className="gg-home-title">Ghosty Gals Tools</h1>
          <p className="gg-home-subtitle">Admin utilities for ghostygals.vercel.app</p>

          <Link href="/tools/layers" className="gg-tool-card">
            <span className="gg-tool-icon">📁✨</span>
            <div className="gg-tool-name">Layer Extractor</div>
            <p className="gg-tool-desc">
              Upload a Procreate PSD, name your layers, and export each one as an individual PNG.
            </p>
            <span className="gg-tool-cta">Open Tool →</span>
          </Link>
        </div>
      </div>
    </>
  );
}
