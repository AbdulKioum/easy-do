
const SPLASH_CSS = `
  .asl-wrap {
    position: fixed;
    inset: 0;
    background: #f8fafc;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    font-family: system-ui, -apple-system, sans-serif;
    user-select: none;
  }
  .asl-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    animation: aslFadeIn 0.35s ease-out forwards;
  }
  .asl-logo-box {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
  }
  .asl-glow {
    position: absolute;
    width: 76px;
    height: 76px;
    background: radial-gradient(circle, rgba(37, 99, 235, 0.12) 0%, rgba(37, 99, 235, 0) 70%);
    border-radius: 50%;
    animation: aslPulse 2s infinite ease-in-out;
  }
  .asl-logo {
    width: 105px;
    height: auto;
    object-fit: contain;
    position: relative;
    z-index: 2;
    animation: aslFloat 2.2s infinite ease-in-out;
  }
  .asl-bar-track {
    width: 110px;
    height: 3px;
    background: #e2e8f0;
    border-radius: 99px;
    overflow: hidden;
    position: relative;
    margin-bottom: 8px;
  }
  .asl-bar-fill {
    width: 45%;
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #2563eb);
    border-radius: 99px;
    animation: aslSlide 1.15s infinite ease-in-out;
  }
  .asl-sub {
    font-size: 10px;
    font-weight: 700;
    color: #94a3b8;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  @keyframes aslFadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes aslFloat {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.03); }
  }
  @keyframes aslPulse {
    0%, 100% { transform: scale(0.95); opacity: 0.6; }
    50% { transform: scale(1.25); opacity: 1; }
  }
  @keyframes aslSlide {
    0% { transform: translateX(-110%); }
    100% { transform: translateX(240%); }
  }
`;

export default function AppSplashLoader() {
  return (
    <div className="asl-wrap">
      <style>{SPLASH_CSS}</style>
      <div className="asl-card">
        <div className="asl-logo-box">
          <div className="asl-glow" />
          <img src="/easy_do_logo.png" alt="Easy D/O" className="asl-logo" />
        </div>
        <div className="asl-bar-track">
          <div className="asl-bar-fill" />
        </div>
        <span className="asl-sub">By Team Mymensingh</span>
      </div>
    </div>
  );
}